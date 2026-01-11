import { storage } from "./storage";
import type { Equipment } from "@shared/schema";

const TIMEZONE = "America/Sao_Paulo";

export interface BackupJob {
  id: string;
  equipmentId: number;
  companyId: number;
  policyId?: number;
  priority: number;
  status: "pending" | "running" | "completed" | "failed";
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface WorkerPoolConfig {
  maxConcurrency: number;
  batchSize: number;
  retryDelay: number;
  maxRetries: number;
}

interface WorkerPoolMetrics {
  totalJobs: number;
  pendingJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  avgDuration: number;
  jobsPerMinute: number;
  startTime: Date;
}

type BackupExecutorFn = (equipmentId: number, companyId: number) => Promise<void>;

type BatchCompletionCallback = (results: { success: number; failed: number; jobIds: string[] }) => void | Promise<void>;

interface BatchTracker {
  jobIds: Set<string>;
  successCount: number;
  failedCount: number;
  callback: BatchCompletionCallback;
}

class BackupWorkerPool {
  private config: WorkerPoolConfig;
  private queue: BackupJob[] = [];
  private runningJobs: Map<string, BackupJob> = new Map();
  private completedCount = 0;
  private failedCount = 0;
  private totalDuration = 0;
  private startTime = new Date();
  private isProcessing = false;
  private executeBackupFn: BackupExecutorFn | null = null;
  private batchTrackers: Map<string, BatchTracker> = new Map();
  private jobToBatch: Map<string, string> = new Map();

  constructor(config: Partial<WorkerPoolConfig> = {}) {
    this.config = {
      maxConcurrency: config.maxConcurrency || 10,
      batchSize: config.batchSize || 100,
      retryDelay: config.retryDelay || 5000,
      maxRetries: config.maxRetries || 3,
    };
    this.log(`Worker pool initialized with concurrency: ${this.config.maxConcurrency}`);
  }

  private log(message: string, ...args: any[]) {
    const now = new Date().toLocaleString("pt-BR", { timeZone: TIMEZONE });
    console.log(`[worker-pool] ${now} - ${message}`, ...args);
  }

  setExecutor(fn: BackupExecutorFn) {
    this.executeBackupFn = fn;
  }

  setConfig(config: Partial<WorkerPoolConfig>) {
    Object.assign(this.config, config);
    this.log(`Config updated: concurrency=${this.config.maxConcurrency}, batchSize=${this.config.batchSize}`);
  }

  getConfig(): WorkerPoolConfig {
    return { ...this.config };
  }

  enqueue(equipmentId: number, companyId: number, policyId?: number, priority = 0): string {
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const job: BackupJob = {
      id: jobId,
      equipmentId,
      companyId,
      policyId,
      priority,
      status: "pending",
      attempts: 0,
      maxAttempts: this.config.maxRetries,
      createdAt: new Date(),
    };
    
    this.queue.push(job);
    this.queue.sort((a, b) => b.priority - a.priority);
    
    if (!this.isProcessing) {
      this.processQueue();
    }
    
    return jobId;
  }

  enqueueBatch(items: Array<{ equipmentId: number; companyId: number; policyId?: number }>, priority = 0): string[] {
    const jobIds: string[] = [];
    
    for (const item of items) {
      const jobId = this.enqueue(item.equipmentId, item.companyId, item.policyId, priority);
      jobIds.push(jobId);
    }
    
    this.log(`Enqueued batch of ${items.length} jobs`);
    return jobIds;
  }

  enqueueBatchWithCallback(
    items: Array<{ equipmentId: number; companyId: number; policyId?: number }>,
    priority = 0,
    onComplete: BatchCompletionCallback
  ): string[] {
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const jobIds: string[] = [];
    
    for (const item of items) {
      const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      jobIds.push(jobId);
      this.jobToBatch.set(jobId, batchId);
    }
    
    this.batchTrackers.set(batchId, {
      jobIds: new Set(jobIds),
      successCount: 0,
      failedCount: 0,
      callback: onComplete,
    });
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const jobId = jobIds[i];
      const job: BackupJob = {
        id: jobId,
        equipmentId: item.equipmentId,
        companyId: item.companyId,
        policyId: item.policyId,
        priority,
        status: "pending",
        attempts: 0,
        maxAttempts: this.config.maxRetries,
        createdAt: new Date(),
      };
      
      this.queue.push(job);
    }
    
    this.queue.sort((a, b) => b.priority - a.priority);
    
    if (!this.isProcessing) {
      this.processQueue();
    }
    
    this.log(`Enqueued batch ${batchId} with ${items.length} jobs`);
    return jobIds;
  }

  private checkBatchCompletion(jobId: string, success: boolean): void {
    const batchId = this.jobToBatch.get(jobId);
    if (!batchId) return;
    
    const tracker = this.batchTrackers.get(batchId);
    if (!tracker) return;
    
    tracker.jobIds.delete(jobId);
    if (success) {
      tracker.successCount++;
    } else {
      tracker.failedCount++;
    }
    
    if (tracker.jobIds.size === 0) {
      this.log(`Batch ${batchId} completed: ${tracker.successCount} success, ${tracker.failedCount} failed`);
      
      const allJobIds = Array.from(this.jobToBatch.entries())
        .filter(([_, bid]) => bid === batchId)
        .map(([jid, _]) => jid);
      
      try {
        const callbackResult = tracker.callback({
          success: tracker.successCount,
          failed: tracker.failedCount,
          jobIds: allJobIds,
        });
        
        if (callbackResult && typeof (callbackResult as any).catch === 'function') {
          (callbackResult as Promise<any>).catch((err: any) => {
            this.log(`Batch ${batchId} callback error: ${err.message}`);
          });
        }
      } catch (err: any) {
        this.log(`Batch ${batchId} callback error: ${err.message}`);
      }
      
      this.batchTrackers.delete(batchId);
      
      for (const jid of allJobIds) {
        this.jobToBatch.delete(jid);
      }
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    
    this.log(`Starting queue processing. Queue size: ${this.queue.length}`);
    
    while (this.queue.length > 0 || this.runningJobs.size > 0) {
      while (this.runningJobs.size < this.config.maxConcurrency && this.queue.length > 0) {
        const job = this.queue.shift()!;
        this.runJob(job);
      }
      
      if (this.runningJobs.size > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    this.isProcessing = false;
    this.log(`Queue processing completed. Total: ${this.completedCount + this.failedCount}, Success: ${this.completedCount}, Failed: ${this.failedCount}`);
  }

  private async runJob(job: BackupJob): Promise<void> {
    job.status = "running";
    job.startedAt = new Date();
    job.attempts++;
    this.runningJobs.set(job.id, job);
    
    try {
      if (!this.executeBackupFn) {
        throw new Error("No backup executor configured");
      }
      
      await this.executeBackupFn(job.equipmentId, job.companyId);
      
      job.status = "completed";
      job.completedAt = new Date();
      const duration = job.completedAt.getTime() - job.startedAt.getTime();
      this.totalDuration += duration;
      this.completedCount++;
      this.checkBatchCompletion(job.id, true);
      
    } catch (err: any) {
      job.error = err.message;
      
      if (job.attempts < job.maxAttempts) {
        job.status = "pending";
        this.log(`Job ${job.id} failed (attempt ${job.attempts}/${job.maxAttempts}), retrying...`);
        setTimeout(() => {
          this.queue.unshift(job);
          if (!this.isProcessing) {
            this.processQueue();
          }
        }, this.config.retryDelay);
      } else {
        job.status = "failed";
        job.completedAt = new Date();
        this.failedCount++;
        this.log(`Job ${job.id} failed permanently: ${err.message}`);
        this.checkBatchCompletion(job.id, false);
      }
    } finally {
      this.runningJobs.delete(job.id);
    }
  }

  getMetrics(): WorkerPoolMetrics {
    const elapsed = (Date.now() - this.startTime.getTime()) / 60000;
    const total = this.completedCount + this.failedCount;
    
    return {
      totalJobs: total,
      pendingJobs: this.queue.length,
      runningJobs: this.runningJobs.size,
      completedJobs: this.completedCount,
      failedJobs: this.failedCount,
      avgDuration: total > 0 ? this.totalDuration / this.completedCount : 0,
      jobsPerMinute: elapsed > 0 ? total / elapsed : 0,
      startTime: this.startTime,
    };
  }

  getQueueStatus(): { pending: number; running: number; completed: number; failed: number } {
    return {
      pending: this.queue.length,
      running: this.runningJobs.size,
      completed: this.completedCount,
      failed: this.failedCount,
    };
  }

  clearQueue(): void {
    const cleared = this.queue.length;
    this.queue = [];
    this.log(`Cleared ${cleared} pending jobs from queue`);
  }

  resetMetrics(): void {
    this.completedCount = 0;
    this.failedCount = 0;
    this.totalDuration = 0;
    this.startTime = new Date();
    this.log("Metrics reset");
  }
}

export const workerPool = new BackupWorkerPool({
  maxConcurrency: 10,
  batchSize: 100,
  retryDelay: 5000,
  maxRetries: 3,
});
