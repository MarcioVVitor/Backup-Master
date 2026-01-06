import WebSocket from "ws";
import { Client as SSHClient } from "ssh2";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import "dotenv/config";

interface AgentConfig {
  serverUrl: string;
  agentToken: string;
  agentId: string;
  heartbeatInterval: number;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  logLevel: "debug" | "info" | "warn" | "error";
}

interface JobPayload {
  jobId: string;
  equipmentId: number;
  equipmentName: string;
  host: string;
  port: number;
  protocol: "ssh" | "telnet";
  username: string;
  password: string;
  manufacturer: string;
  commands: string[];
  timeout: number;
}

interface JobResult {
  jobId: string;
  status: "success" | "failed";
  output?: string;
  error?: string;
  startedAt: string;
  completedAt: string;
  metrics?: {
    duration: number;
    bytesReceived: number;
  };
}

class NBMAgent {
  private config: AgentConfig;
  private ws: WebSocket | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private isShuttingDown = false;
  private activeJobs = new Map<string, AbortController>();

  constructor() {
    this.config = this.loadConfig();
    this.setupSignalHandlers();
  }

  private loadConfig(): AgentConfig {
    const configPath = process.env.NBM_CONFIG_PATH || "/etc/nbm-agent/config.json";
    
    let fileConfig: Partial<AgentConfig> = {};
    if (fs.existsSync(configPath)) {
      try {
        fileConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      } catch (e) {
        this.log("warn", `Failed to parse config file: ${e}`);
      }
    }

    return {
      serverUrl: process.env.NBM_SERVER_URL || fileConfig.serverUrl || "",
      agentToken: process.env.NBM_AGENT_TOKEN || fileConfig.agentToken || "",
      agentId: process.env.NBM_AGENT_ID || fileConfig.agentId || "",
      heartbeatInterval: parseInt(process.env.NBM_HEARTBEAT_INTERVAL || "30000") || fileConfig.heartbeatInterval || 30000,
      reconnectInterval: parseInt(process.env.NBM_RECONNECT_INTERVAL || "5000") || fileConfig.reconnectInterval || 5000,
      maxReconnectAttempts: parseInt(process.env.NBM_MAX_RECONNECT || "0") || fileConfig.maxReconnectAttempts || 0,
      logLevel: (process.env.NBM_LOG_LEVEL as AgentConfig["logLevel"]) || fileConfig.logLevel || "info",
    };
  }

  private log(level: "debug" | "info" | "warn" | "error", message: string, data?: any) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    if (levels[level] < levels[this.config.logLevel]) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    if (data) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  private setupSignalHandlers() {
    const shutdown = async (signal: string) => {
      this.log("info", `Received ${signal}, shutting down gracefully...`);
      this.isShuttingDown = true;
      
      for (const [jobId, controller] of this.activeJobs) {
        this.log("info", `Cancelling job ${jobId}`);
        controller.abort();
      }
      
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
      }
      
      if (this.ws) {
        this.ws.close(1000, "Agent shutdown");
      }
      
      setTimeout(() => process.exit(0), 2000);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  }

  async start() {
    this.log("info", "NBM Agent starting...");
    this.log("info", `Agent ID: ${this.config.agentId}`);
    this.log("info", `Server URL: ${this.config.serverUrl}`);

    if (!this.config.serverUrl || !this.config.agentToken || !this.config.agentId) {
      this.log("error", "Missing required configuration. Please set NBM_SERVER_URL, NBM_AGENT_TOKEN, and NBM_AGENT_ID");
      process.exit(1);
    }

    await this.connect();
  }

  private async connect() {
    if (this.isShuttingDown) return;

    // Remove trailing slash from serverUrl before building WebSocket URL
    const baseUrl = this.config.serverUrl.replace(/\/+$/, '');
    const wsUrl = `${baseUrl.replace(/^http/, "ws")}/ws/agents`;
    this.log("info", `Connecting to ${wsUrl}...`);

    try {
      this.ws = new WebSocket(wsUrl, {
        headers: {
          "Authorization": `Bearer ${this.config.agentToken}`,
          "X-Agent-ID": this.config.agentId,
        },
      });

      this.ws.on("open", () => {
        this.log("info", "Connected to NBM server, sending authentication...");
        this.reconnectAttempts = 0;
        // First authenticate with token
        this.sendAuth();
      });

      this.ws.on("message", (data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on("close", (code, reason) => {
        this.log("warn", `Disconnected from server: ${code} - ${reason}`);
        this.stopHeartbeat();
        this.scheduleReconnect();
      });

      this.ws.on("error", (error) => {
        this.log("error", "WebSocket error:", error.message);
      });

    } catch (error) {
      this.log("error", "Connection failed:", error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.isShuttingDown) return;

    if (this.config.maxReconnectAttempts > 0 && this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.log("error", "Max reconnection attempts reached. Exiting.");
      process.exit(1);
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1), 60000);
    
    this.log("info", `Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts})...`);
    setTimeout(() => this.connect(), delay);
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        const metrics = this.getSystemMetrics();
        // Send heartbeat in format server expects
        this.ws.send(JSON.stringify({
          type: "heartbeat",
          metrics: {
            cpu: parseFloat(metrics.memoryUsage as string),
            memory: parseFloat(metrics.memoryUsage as string),
            activeSessions: this.activeJobs.size,
            queuedJobs: 0,
          }
        }));
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private sendAuth() {
    // Send authentication message with token
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ 
        type: 'auth', 
        token: this.config.agentToken 
      }));
    }
  }

  private sendSystemInfo() {
    this.send("register", {
      agentId: this.config.agentId,
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      agentVersion: "1.0.0",
      capabilities: ["ssh", "telnet", "backup"],
      systemInfo: this.getSystemMetrics(),
    });
  }

  private getSystemMetrics() {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      uptime: os.uptime(),
      loadAvg: os.loadavg(),
      cpuCount: cpus.length,
      cpuModel: cpus[0]?.model || "unknown",
      totalMemory: totalMem,
      freeMemory: freeMem,
      memoryUsage: ((totalMem - freeMem) / totalMem * 100).toFixed(2),
    };
  }

  private send(type: string, payload: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  private handleMessage(data: string) {
    try {
      const message = JSON.parse(data);
      this.log("debug", `Received message: ${message.type}`);

      switch (message.type) {
        case "auth_success":
          this.log("info", `Authentication successful! Agent ID: ${message.agentId}`);
          // Now start heartbeat and send system info
          this.startHeartbeat();
          this.sendSystemInfo();
          break;
        case "auth_error":
          this.log("error", `Authentication failed: ${message.message}`);
          break;
        case "job":
          this.executeJob(message.payload || message.job);
          break;
        case "jobs_pending":
          this.log("info", `${message.count} jobs pending, requesting...`);
          this.send("job_request", {});
          break;
        case "no_jobs":
          this.log("debug", "No jobs in queue");
          break;
        case "heartbeat_ack":
          this.log("debug", `Heartbeat acknowledged at ${message.timestamp}`);
          break;
        case "cancel_job":
          this.cancelJob(message.payload?.jobId || message.jobId);
          break;
        case "config_update":
          this.handleConfigUpdate(message.payload);
          break;
        case "ping":
          this.send("pong", { timestamp: new Date().toISOString() });
          break;
        case "ack":
          this.log("debug", "Server acknowledged registration");
          break;
        default:
          this.log("warn", `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.log("error", "Failed to parse message:", error);
    }
  }

  private async executeJob(job: JobPayload) {
    this.log("info", `Starting job ${job.jobId} for ${job.equipmentName} (${job.host})`);
    
    const controller = new AbortController();
    this.activeJobs.set(job.jobId, controller);

    const startedAt = new Date().toISOString();
    let result: JobResult;

    try {
      this.send("job_status", { jobId: job.jobId, status: "running" });

      const output = await this.executeSSH(job, controller.signal);
      
      result = {
        jobId: job.jobId,
        status: "success",
        output,
        startedAt,
        completedAt: new Date().toISOString(),
        metrics: {
          duration: Date.now() - new Date(startedAt).getTime(),
          bytesReceived: Buffer.byteLength(output, "utf-8"),
        },
      };

      this.log("info", `Job ${job.jobId} completed successfully`);

    } catch (error: any) {
      result = {
        jobId: job.jobId,
        status: "failed",
        error: error.message,
        startedAt,
        completedAt: new Date().toISOString(),
      };

      this.log("error", `Job ${job.jobId} failed: ${error.message}`);
    }

    this.activeJobs.delete(job.jobId);
    this.send("job_result", result);
  }

  private executeSSH(job: JobPayload, signal: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
      const conn = new SSHClient();
      let output = "";
      let commandIndex = 0;
      let stream: any;

      const timeout = setTimeout(() => {
        conn.end();
        reject(new Error(`Job timeout after ${job.timeout}ms`));
      }, job.timeout || 120000);

      signal.addEventListener("abort", () => {
        clearTimeout(timeout);
        conn.end();
        reject(new Error("Job cancelled"));
      });

      conn.on("ready", () => {
        this.log("debug", `SSH connected to ${job.host}`);
        
        conn.shell((err, sh) => {
          if (err) {
            clearTimeout(timeout);
            reject(err);
            return;
          }

          stream = sh;

          stream.on("data", (data: Buffer) => {
            output += data.toString();
          });

          stream.on("close", () => {
            clearTimeout(timeout);
            conn.end();
            resolve(output);
          });

          const sendNextCommand = () => {
            if (commandIndex < job.commands.length) {
              const cmd = job.commands[commandIndex];
              this.log("debug", `Executing command: ${cmd}`);
              stream.write(cmd + "\n");
              commandIndex++;
              setTimeout(sendNextCommand, 1000);
            } else {
              setTimeout(() => stream.end(), 2000);
            }
          };

          setTimeout(sendNextCommand, 1000);
        });
      });

      conn.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      conn.connect({
        host: job.host,
        port: job.port || 22,
        username: job.username,
        password: job.password,
        readyTimeout: 30000,
        algorithms: {
          kex: [
            "ecdh-sha2-nistp256",
            "ecdh-sha2-nistp384",
            "ecdh-sha2-nistp521",
            "diffie-hellman-group-exchange-sha256",
            "diffie-hellman-group14-sha256",
            "diffie-hellman-group14-sha1",
            "diffie-hellman-group1-sha1",
          ],
          cipher: [
            "aes128-ctr",
            "aes192-ctr",
            "aes256-ctr",
            "aes128-gcm@openssh.com",
            "aes256-gcm@openssh.com",
            "aes256-cbc",
            "aes128-cbc",
            "3des-cbc",
          ],
        },
      });
    });
  }

  private cancelJob(jobId: string) {
    const controller = this.activeJobs.get(jobId);
    if (controller) {
      this.log("info", `Cancelling job ${jobId}`);
      controller.abort();
    }
  }

  private handleConfigUpdate(config: any) {
    this.log("info", "Received configuration update");
  }
}

const agent = new NBMAgent();
agent.start().catch(console.error);
