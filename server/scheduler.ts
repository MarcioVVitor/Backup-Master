import { storage } from "./storage";
import type { BackupPolicy, Equipment } from "@shared/schema";
import { workerPool } from "./backup-worker-pool";

const SCHEDULER_INTERVAL = 60000; // Check every minute
const TIMEZONE = "America/Sao_Paulo"; // Brazil timezone

const DEFAULT_CONCURRENCY = 50;
const MAX_CONCURRENCY = 100;

let schedulerInterval: NodeJS.Timeout | null = null;
let executeBackupFn: ((equipmentId: number, companyId: number) => Promise<void>) | null = null;

function log(message: string, ...args: any[]) {
  const now = new Date().toLocaleString("pt-BR", { timeZone: TIMEZONE });
  console.log(`[scheduler] ${now} - ${message}`, ...args);
}

function getCurrentTimeInTimezone(): { hour: number; minute: number; dayOfWeek: number; dayOfMonth: number } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    weekday: "short",
    day: "numeric"
  });
  
  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find(p => p.type === "hour")?.value || "0");
  const minute = parseInt(parts.find(p => p.type === "minute")?.value || "0");
  const day = parseInt(parts.find(p => p.type === "day")?.value || "1");
  const weekday = parts.find(p => p.type === "weekday")?.value || "Mon";
  
  const weekdayMap: Record<string, number> = {
    "Sun": 0, "Mon": 1, "Tue": 2, "Wed": 3, "Thu": 4, "Fri": 5, "Sat": 6
  };
  
  return {
    hour,
    minute,
    dayOfWeek: weekdayMap[weekday] ?? 1,
    dayOfMonth: day
  };
}

function shouldRunPolicy(policy: BackupPolicy, currentTime: ReturnType<typeof getCurrentTimeInTimezone>): boolean {
  if (!policy.enabled) return false;
  
  const policyTime = policy.time || "02:00";
  const [policyHour, policyMinute] = policyTime.split(":").map(Number);
  
  if (currentTime.hour !== policyHour || currentTime.minute !== policyMinute) {
    return false;
  }
  
  const lastRun = policy.lastRunAt ? new Date(policy.lastRunAt) : null;
  const now = new Date();
  
  if (lastRun) {
    const minutesSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60);
    if (minutesSinceLastRun < 2) {
      return false;
    }
  }
  
  switch (policy.frequencyType) {
    case "hourly":
      return true;
      
    case "daily":
      return true;
      
    case "weekly":
      if (!policy.daysOfWeek || policy.daysOfWeek.length === 0) {
        return currentTime.dayOfWeek === 1;
      }
      return policy.daysOfWeek.includes(currentTime.dayOfWeek.toString());
      
    case "monthly":
      const targetDay = policy.dayOfMonth || 1;
      return currentTime.dayOfMonth === targetDay;
      
    default:
      return false;
  }
}

async function getEquipmentForPolicy(policy: BackupPolicy): Promise<Equipment[]> {
  let equipment: Equipment[] = [];
  
  if (policy.equipmentIds && policy.equipmentIds.length > 0) {
    const allEquipment = policy.companyId 
      ? await storage.getEquipmentByCompany(policy.companyId)
      : await storage.getEquipment();
    equipment = allEquipment.filter(e => policy.equipmentIds!.includes(e.id));
  } else {
    equipment = policy.companyId 
      ? await storage.getEquipmentByCompany(policy.companyId)
      : await storage.getEquipment();
    
    if (policy.manufacturerFilters && policy.manufacturerFilters.length > 0) {
      equipment = equipment.filter(e => policy.manufacturerFilters!.includes(e.manufacturer));
    }
    
    if (policy.modelFilters && policy.modelFilters.length > 0) {
      equipment = equipment.filter(e => 
        e.model && policy.modelFilters!.some(f => e.model!.toLowerCase().includes(f.toLowerCase()))
      );
    }
  }
  
  return equipment.filter(e => e.enabled);
}

async function runPolicy(policy: BackupPolicy): Promise<void> {
  log(`Running policy: ${policy.name} (ID: ${policy.id})`);
  
  try {
    const equipment = await getEquipmentForPolicy(policy);
    log(`Policy ${policy.name}: Found ${equipment.length} equipment to backup`);
    
    if (equipment.length === 0) {
      log(`Policy ${policy.name}: No equipment matched filters`);
      await storage.updateBackupPolicy(policy.id, { lastRunAt: new Date() });
      return;
    }
    
    const jobs = equipment.map(equip => ({
      equipmentId: equip.id,
      companyId: equip.companyId || 1,
      policyId: policy.id,
    }));
    
    workerPool.enqueueBatchWithCallback(jobs, 0, async (results) => {
      log(`Policy ${policy.name}: Batch completed - Success: ${results.success}, Failed: ${results.failed}`);
      
      const nextRun = calculateNextRun(policy);
      const status = results.failed === 0 ? "success" : (results.success > 0 ? "partial" : "failed");
      
      await storage.updateBackupPolicy(policy.id, { 
        lastRunAt: new Date(),
        nextRunAt: nextRun,
        lastStatus: status,
      });
      
      log(`Policy ${policy.name}: Updated status to ${status}, next run at ${nextRun.toISOString()}`);
    });
    
    log(`Policy ${policy.name}: Enqueued ${jobs.length} backup jobs for parallel processing`);
    
  } catch (err: any) {
    log(`Policy ${policy.name}: Error running policy: ${err.message}`);
  }
}

function calculateNextRun(policy: BackupPolicy): Date {
  const now = new Date();
  const [hour, minute] = (policy.time || "02:00").split(":").map(Number);
  
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  
  switch (policy.frequencyType) {
    case "hourly":
      if (next <= now) {
        next.setHours(next.getHours() + 1);
      }
      break;
      
    case "daily":
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      break;
      
    case "weekly":
      if (policy.daysOfWeek && policy.daysOfWeek.length > 0) {
        const targetDays = policy.daysOfWeek.map(d => parseInt(d)).sort((a, b) => a - b);
        const currentDay = now.getDay();
        
        let foundNext = false;
        for (const targetDay of targetDays) {
          if (targetDay > currentDay || (targetDay === currentDay && next > now)) {
            const daysUntil = targetDay - currentDay;
            next.setDate(now.getDate() + daysUntil);
            foundNext = true;
            break;
          }
        }
        
        if (!foundNext) {
          const daysUntil = 7 - currentDay + targetDays[0];
          next.setDate(now.getDate() + daysUntil);
        }
      } else {
        if (next <= now) {
          next.setDate(next.getDate() + 7);
        }
      }
      break;
      
    case "monthly":
      const targetDay = policy.dayOfMonth || 1;
      next.setDate(targetDay);
      
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
        next.setDate(targetDay);
      }
      
      const lastDayOfMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      if (targetDay > lastDayOfMonth) {
        next.setDate(lastDayOfMonth);
      }
      break;
  }
  
  return next;
}

async function checkAndRunPolicies(): Promise<void> {
  try {
    const currentTime = getCurrentTimeInTimezone();
    const currentTimeStr = `${currentTime.hour.toString().padStart(2, "0")}:${currentTime.minute.toString().padStart(2, "0")}`;
    const policies = await storage.getBackupPolicies();
    const enabledPolicies = policies.filter(p => p.enabled);
    
    if (enabledPolicies.length === 0) {
      return;
    }
    
    log(`Checking ${enabledPolicies.length} policies at ${currentTimeStr} (DOW:${currentTime.dayOfWeek}, DOM:${currentTime.dayOfMonth})`);
    
    for (const policy of enabledPolicies) {
      const shouldRun = shouldRunPolicy(policy, currentTime);
      log(`Policy "${policy.name}": time=${policy.time}, freq=${policy.frequencyType}, shouldRun=${shouldRun}`);
      if (shouldRun) {
        await runPolicy(policy);
      }
    }
  } catch (err: any) {
    log(`Error checking policies: ${err.message}`);
  }
}

export async function runPolicyNow(policyId: number): Promise<{ success: boolean; message: string }> {
  try {
    const policy = await storage.getBackupPolicyById(policyId);
    if (!policy) {
      return { success: false, message: "Política não encontrada" };
    }
    
    log(`Manual execution requested for policy: ${policy.name}`);
    await runPolicy(policy);
    return { success: true, message: `Política "${policy.name}" executada` };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export function setBackupExecutor(fn: (equipmentId: number, companyId: number) => Promise<void>): void {
  executeBackupFn = fn;
  workerPool.setExecutor(fn);
  log("Backup executor registered for scheduler and worker pool");
}

export function setWorkerPoolConcurrency(concurrency: number): void {
  const safeConcurrency = Math.min(Math.max(1, concurrency), MAX_CONCURRENCY);
  workerPool.setConfig({ maxConcurrency: safeConcurrency });
  log(`Worker pool concurrency set to ${safeConcurrency}`);
}

export function getWorkerPoolMetrics() {
  return workerPool.getMetrics();
}

export function getWorkerPoolStatus() {
  return workerPool.getQueueStatus();
}

export function clearWorkerQueue() {
  workerPool.clearQueue();
}

export function startScheduler(): void {
  if (schedulerInterval) {
    log("Scheduler already running");
    return;
  }
  
  log("Starting backup scheduler...");
  log(`Timezone: ${TIMEZONE}`);
  log(`Check interval: ${SCHEDULER_INTERVAL / 1000} seconds`);
  log(`Worker pool concurrency: ${workerPool.getConfig().maxConcurrency}`);
  
  const currentTime = getCurrentTimeInTimezone();
  log(`Current time: ${currentTime.hour}:${currentTime.minute.toString().padStart(2, "0")}, Day of week: ${currentTime.dayOfWeek}, Day of month: ${currentTime.dayOfMonth}`);
  
  checkAndRunPolicies();
  
  schedulerInterval = setInterval(checkAndRunPolicies, SCHEDULER_INTERVAL);
  log("Scheduler started successfully");
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    log("Scheduler stopped");
  }
}

export async function getSchedulerStatus(): Promise<{
  running: boolean;
  timezone: string;
  currentTime: string;
  concurrency: number;
  workerPool: {
    pending: number;
    running: number;
    completed: number;
    failed: number;
  };
  metrics: {
    totalJobs: number;
    avgDuration: number;
    jobsPerMinute: number;
  };
  nextChecks: Array<{ policyName: string; nextRunAt: string | null }>;
}> {
  const currentTime = getCurrentTimeInTimezone();
  const policies = await storage.getBackupPolicies();
  const poolStatus = workerPool.getQueueStatus();
  const poolMetrics = workerPool.getMetrics();
  
  return {
    running: schedulerInterval !== null,
    timezone: TIMEZONE,
    currentTime: `${currentTime.hour}:${currentTime.minute.toString().padStart(2, "0")}`,
    concurrency: workerPool.getConfig().maxConcurrency,
    workerPool: poolStatus,
    metrics: {
      totalJobs: poolMetrics.totalJobs,
      avgDuration: Math.round(poolMetrics.avgDuration),
      jobsPerMinute: Math.round(poolMetrics.jobsPerMinute * 100) / 100,
    },
    nextChecks: policies.filter(p => p.enabled).map(p => ({
      policyName: p.name,
      nextRunAt: p.nextRunAt?.toISOString() || null
    }))
  };
}
