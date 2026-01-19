import { storage } from "./storage";
import type { BackupPolicy, Equipment, ArchivePolicy, FileRecord } from "@shared/schema";
import { workerPool } from "./backup-worker-pool";

const SCHEDULER_INTERVAL = 60000; // Check every minute
const ARCHIVE_CHECK_INTERVAL = 3600000; // Check archive policies every hour

// High capacity configuration for 2000+ backups per company, up to 10,000 hosts
const DEFAULT_CONCURRENCY = 50;
const MAX_CONCURRENCY = 100;

let schedulerInterval: NodeJS.Timeout | null = null;
let archiveInterval: NodeJS.Timeout | null = null;
let executeBackupFn: ((equipmentId: number, companyId: number) => Promise<void>) | null = null;
let lastArchiveCheck: Date | null = null;

function log(message: string, ...args: any[]) {
  const now = new Date().toLocaleString("pt-BR");
  console.log(`[scheduler] ${now} - ${message}`, ...args);
}

function getCurrentTimeFromSystem(): { hour: number; minute: number; dayOfWeek: number; dayOfMonth: number } {
  const now = new Date();
  
  return {
    hour: now.getHours(),
    minute: now.getMinutes(),
    dayOfWeek: now.getDay(),
    dayOfMonth: now.getDate()
  };
}

function shouldRunPolicy(policy: BackupPolicy, currentTime: ReturnType<typeof getCurrentTimeFromSystem>): boolean {
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
    const currentTime = getCurrentTimeFromSystem();
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

// ============================================
// ARQUIVAMENTO AUTOMÁTICO DE BACKUPS
// ============================================

async function getBackupsForArchivePolicy(policy: ArchivePolicy, companyId: number): Promise<FileRecord[]> {
  const allBackups = await storage.getActiveBackupsByCompany(companyId);
  const allEquipment = await storage.getEquipmentByCompany(companyId);
  
  // Create equipment lookup map
  const equipmentMap = new Map(allEquipment.map(e => [e.id, e]));
  
  let filteredBackups = allBackups;
  
  // Filter by manufacturer if specified
  if (policy.manufacturerFilters && policy.manufacturerFilters.length > 0) {
    filteredBackups = filteredBackups.filter(backup => {
      if (!backup.equipmentId) return false;
      const equip = equipmentMap.get(backup.equipmentId);
      return equip && policy.manufacturerFilters!.includes(equip.manufacturer);
    });
  }
  
  // Filter by model if specified
  if (policy.modelFilters && policy.modelFilters.length > 0) {
    filteredBackups = filteredBackups.filter(backup => {
      if (!backup.equipmentId) return false;
      const equip = equipmentMap.get(backup.equipmentId);
      return equip && equip.model && policy.modelFilters!.some(m => 
        equip.model!.toLowerCase().includes(m.toLowerCase())
      );
    });
  }
  
  // Filter by equipment name pattern if specified
  if (policy.equipmentNamePattern) {
    const pattern = new RegExp(policy.equipmentNamePattern, 'i');
    filteredBackups = filteredBackups.filter(backup => {
      if (!backup.equipmentId) return false;
      const equip = equipmentMap.get(backup.equipmentId);
      return equip && pattern.test(equip.name);
    });
  }
  
  return filteredBackups;
}

async function runArchivePolicy(policy: ArchivePolicy): Promise<{ archived: number; deleted: number }> {
  log(`[archive] Running archive policy: ${policy.name} (ID: ${policy.id})`);
  
  const companyId = policy.companyId;
  if (!companyId) {
    log(`[archive] Policy ${policy.name} has no company ID`);
    return { archived: 0, deleted: 0 };
  }
  
  const backups = await getBackupsForArchivePolicy(policy, companyId);
  log(`[archive] Policy ${policy.name}: Found ${backups.length} backups to evaluate`);
  
  const now = new Date();
  const toArchive: number[] = [];
  const toDelete: number[] = [];
  
  if (policy.criteria === 'age') {
    // Archive backups older than retentionDays
    const retentionDays = policy.retentionDays || 90;
    const cutoffDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
    
    for (const backup of backups) {
      if (backup.createdAt && new Date(backup.createdAt) < cutoffDate) {
        toArchive.push(backup.id);
      }
    }
  } else if (policy.criteria === 'count') {
    // Keep only maxBackupsPerEquipment per equipment, archive the rest
    const maxBackups = policy.maxBackupsPerEquipment || 10;
    const byEquipment = new Map<number, FileRecord[]>();
    
    for (const backup of backups) {
      if (backup.equipmentId) {
        if (!byEquipment.has(backup.equipmentId)) {
          byEquipment.set(backup.equipmentId, []);
        }
        byEquipment.get(backup.equipmentId)!.push(backup);
      }
    }
    
    for (const equipId of Array.from(byEquipment.keys())) {
      const equipBackups = byEquipment.get(equipId)!;
      // Sort by date descending (newest first)
      equipBackups.sort((a: FileRecord, b: FileRecord) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      
      // Archive backups beyond the limit
      if (equipBackups.length > maxBackups) {
        const toArchiveFromEquip = equipBackups.slice(maxBackups);
        toArchive.push(...toArchiveFromEquip.map((b: FileRecord) => b.id));
      }
    }
  }
  
  // Check for auto-delete of archived backups
  if (policy.autoDelete && policy.deleteAfterDays) {
    const archivedBackups = await storage.getArchivedBackupsByCompany(companyId);
    const deleteAfterMs = policy.deleteAfterDays * 24 * 60 * 60 * 1000;
    
    for (const backup of archivedBackups) {
      if (backup.archivedAt) {
        const archivedAt = new Date(backup.archivedAt);
        if (now.getTime() - archivedAt.getTime() > deleteAfterMs) {
          toDelete.push(backup.id);
        }
      }
    }
  }
  
  // Execute archiving
  if (toArchive.length > 0) {
    log(`[archive] Archiving ${toArchive.length} backups for policy ${policy.name}`);
    await storage.archiveBackupsBulk(toArchive, 0); // System user (0)
  }
  
  // Execute deletion (would need to implement actual file deletion)
  // For now, just log the count
  if (toDelete.length > 0) {
    log(`[archive] Would delete ${toDelete.length} archived backups for policy ${policy.name}`);
    // TODO: Implement actual deletion of files from storage
  }
  
  return { archived: toArchive.length, deleted: toDelete.length };
}

async function checkAndRunArchivePolicies(): Promise<void> {
  try {
    log(`[archive] Checking archive policies...`);
    
    // Get all companies and their archive policies
    const companies = await storage.getCompanies();
    
    for (const company of companies) {
      const policies = await storage.getArchivePoliciesByCompany(company.id);
      const enabledPolicies = policies.filter(p => p.enabled);
      
      if (enabledPolicies.length === 0) continue;
      
      log(`[archive] Company ${company.name}: Found ${enabledPolicies.length} enabled archive policies`);
      
      for (const policy of enabledPolicies) {
        try {
          const result = await runArchivePolicy(policy);
          log(`[archive] Policy ${policy.name}: Archived ${result.archived}, Deleted ${result.deleted}`);
        } catch (err: any) {
          log(`[archive] Error running policy ${policy.name}: ${err.message}`);
        }
      }
    }
    
    lastArchiveCheck = new Date();
  } catch (err: any) {
    log(`[archive] Error checking archive policies: ${err.message}`);
  }
}

export async function runArchivePolicyNow(policyId: number, companyId: number): Promise<{ success: boolean; message: string; archived?: number }> {
  try {
    const policy = await storage.getArchivePolicyById(policyId, companyId);
    if (!policy) {
      return { success: false, message: "Política de arquivamento não encontrada" };
    }
    
    log(`[archive] Manual execution requested for archive policy: ${policy.name}`);
    const result = await runArchivePolicy(policy);
    return { success: true, message: `Arquivados ${result.archived} backups`, archived: result.archived };
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
  log("Timezone: System (Linux)");
  log(`Check interval: ${SCHEDULER_INTERVAL / 1000} seconds`);
  log(`Worker pool concurrency: ${workerPool.getConfig().maxConcurrency}`);
  
  const currentTime = getCurrentTimeFromSystem();
  log(`Current time: ${currentTime.hour}:${currentTime.minute.toString().padStart(2, "0")}, Day of week: ${currentTime.dayOfWeek}, Day of month: ${currentTime.dayOfMonth}`);
  
  checkAndRunPolicies();
  
  schedulerInterval = setInterval(checkAndRunPolicies, SCHEDULER_INTERVAL);
  
  // Start archive scheduler (runs every hour)
  log("Starting archive scheduler...");
  archiveInterval = setInterval(checkAndRunArchivePolicies, ARCHIVE_CHECK_INTERVAL);
  // Run initial check after 5 minutes
  setTimeout(checkAndRunArchivePolicies, 300000);
  
  log("Scheduler started successfully");
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    log("Backup scheduler stopped");
  }
  if (archiveInterval) {
    clearInterval(archiveInterval);
    archiveInterval = null;
    log("Archive scheduler stopped");
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
  const currentTime = getCurrentTimeFromSystem();
  const policies = await storage.getBackupPolicies();
  const poolStatus = workerPool.getQueueStatus();
  const poolMetrics = workerPool.getMetrics();
  
  return {
    running: schedulerInterval !== null,
    timezone: "System",
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
