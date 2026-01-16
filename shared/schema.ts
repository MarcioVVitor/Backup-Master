import { pgTable, text, serial, integer, timestamp, boolean, varchar, jsonb, index, real, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// Session storage table (Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// ============================================
// MULTI-TENANCY - EMPRESAS E ISOLAMENTO
// ============================================

// Roles de servidor (NBM CLOUD Server admins)
export const SERVER_ROLES = ["server_admin", "support_engineer"] as const;
export type ServerRole = typeof SERVER_ROLES[number];

// Roles de empresa (dentro de cada tenant)
export const COMPANY_ROLES = ["company_admin", "operator", "viewer"] as const;
export type CompanyRole = typeof COMPANY_ROLES[number];

// Roles de usuario (compatibilidade legada)
export const USER_ROLES = ["admin", "operator", "viewer"] as const;
export type UserRole = typeof USER_ROLES[number];

// Tabela de Empresas (Tenants)
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  logo: text("logo"),
  active: boolean("active").default(true),
  maxUsers: integer("max_users").default(10),
  maxEquipment: integer("max_equipment").default(100),
  maxAgents: integer("max_agents").default(5),
  settings: jsonb("settings").$type<{
    timezone?: string;
    language?: string;
    retentionDays?: number;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabela de Administradores do Servidor (NBM CLOUD Server)
export const serverAdmins = pgTable("server_admins", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  role: text("role").notNull().default("support_engineer"),
  permissions: jsonb("permissions").$type<{
    canCreateCompanies?: boolean;
    canDeleteCompanies?: boolean;
    canAccessAllCompanies?: boolean;
    canManageProxies?: boolean;
    canRestartProxies?: boolean;
    canPerformMaintenance?: boolean;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tabela de Vinculação Usuário-Empresa (multi-empresa)
export const userCompanies = pgTable("user_companies", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  role: text("role").notNull().default("viewer"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("user_company_unique").on(table.userId, table.companyId)
]);

// User storage table (matches existing DB)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  replitId: text("replit_id").unique(),
  username: text("username").notNull(),
  name: text("name"),
  email: text("email"),
  passwordHash: text("password_hash"),
  passwordSalt: text("password_salt"),
  isAdmin: boolean("is_admin").default(false),
  role: text("role").default("viewer"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tabela de Equipamentos de Rede
export const equipment = pgTable("equipment", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id),
  name: text("name").notNull(),
  ip: text("ip").notNull(),
  manufacturer: text("manufacturer").notNull(),
  model: text("model"),
  credentialId: integer("credential_id"),
  username: text("username"),
  password: text("password"),
  enablePassword: text("enable_password"),
  port: integer("port").default(22),
  protocol: text("protocol").default("ssh"),
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_equipment_company").on(table.companyId),
  index("idx_equipment_manufacturer").on(table.manufacturer),
]);

// Tabela de Arquivos/Backups (integrada com Object Storage)
export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id),
  userId: integer("user_id").references(() => users.id).notNull(),
  equipmentId: integer("equipment_id").references(() => equipment.id),
  filename: text("filename").notNull(),
  objectName: text("object_name").notNull(),
  size: integer("size").notNull(),
  mimeType: text("mime_type"),
  status: text("status").default("success"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_files_company").on(table.companyId),
  index("idx_files_equipment").on(table.equipmentId),
  index("idx_files_created_at").on(table.createdAt),
  index("idx_files_company_created").on(table.companyId, table.createdAt),
]);

// Tabela de Histórico de Backups (logs de execução)
export const backupHistory = pgTable("backup_history", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id),
  equipmentId: integer("equipment_id").references(() => equipment.id),
  equipmentName: text("equipment_name"),
  manufacturer: text("manufacturer"),
  ip: text("ip"),
  fileId: integer("file_id").references(() => files.id),
  status: text("status").notNull().default("pending"),
  duration: real("duration"),
  errorMessage: text("error_message"),
  executedBy: integer("executed_by").references(() => users.id),
  executedAt: timestamp("executed_at").defaultNow(),
}, (table) => [
  index("idx_backup_history_company").on(table.companyId),
  index("idx_backup_history_equipment").on(table.equipmentId),
  index("idx_backup_history_executed_at").on(table.executedAt),
  index("idx_backup_history_company_executed").on(table.companyId, table.executedAt),
  index("idx_backup_history_status").on(table.status),
]);

// Tabela de Configurações do Sistema
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabela de Scripts por Fabricante (backup, atualizacao, reboot, etc.)
export const vendorScripts = pgTable("vendor_scripts", {
  id: serial("id").primaryKey(),
  manufacturer: text("manufacturer").notNull(),
  name: text("name").notNull(),
  command: text("command").notNull(),
  description: text("description"),
  fileExtension: text("file_extension").default(".cfg"),
  useShell: boolean("use_shell").default(true),
  timeout: integer("timeout").default(30000),
  isDefault: boolean("is_default").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabela de Fabricantes
export const manufacturers = pgTable("manufacturers", {
  id: serial("id").primaryKey(),
  value: text("value").notNull().unique(),
  label: text("label").notNull(),
  color: text("color").default("#6b7280"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tabela de Atualizacoes do Sistema
export const systemUpdates = pgTable("system_updates", {
  id: serial("id").primaryKey(),
  version: text("version").notNull(),
  changelog: text("changelog"),
  status: text("status").default("success"),
  appliedAt: timestamp("applied_at").defaultNow(),
  appliedBy: text("applied_by").notNull(),
});

// Tabela de Firmware
export const firmware = pgTable("firmware", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id),
  name: text("name").notNull(),
  manufacturer: text("manufacturer").notNull(),
  model: text("model"),
  version: text("version"),
  filename: text("filename").notNull(),
  objectName: text("object_name").notNull(),
  size: integer("size").notNull(),
  description: text("description"),
  uploadedBy: integer("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tabela de Políticas de Backup Automático (Scheduler)
export const FREQUENCY_TYPES = ["hourly", "daily", "weekly", "monthly"] as const;
export type FrequencyType = typeof FREQUENCY_TYPES[number];

export const backupPolicies = pgTable("backup_policies", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id),
  name: text("name").notNull(),
  description: text("description"),
  enabled: boolean("enabled").default(true),
  frequencyType: text("frequency_type").notNull().default("daily"),
  time: text("time").default("02:00"),
  daysOfWeek: text("days_of_week").array(),
  dayOfMonth: integer("day_of_month"),
  manufacturerFilters: text("manufacturer_filters").array(),
  modelFilters: text("model_filters").array(),
  equipmentIds: integer("equipment_ids").array(),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  lastStatus: text("last_status"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_backup_policies_company").on(table.companyId),
  index("idx_backup_policies_enabled").on(table.enabled),
  index("idx_backup_policies_next_run").on(table.nextRunAt),
]);

// Tabela de Execuções de Políticas de Backup
export const backupPolicyRuns = pgTable("backup_policy_runs", {
  id: serial("id").primaryKey(),
  policyId: integer("policy_id").references(() => backupPolicies.id).notNull(),
  status: text("status").notNull().default("running"),
  equipmentCount: integer("equipment_count").default(0),
  successCount: integer("success_count").default(0),
  failedCount: integer("failed_count").default(0),
  startedAt: timestamp("started_at").defaultNow(),
  finishedAt: timestamp("finished_at"),
  errorMessage: text("error_message"),
});

// ============================================
// ARQUITETURA DISTRIBUÍDA - AGENTES REMOTOS
// ============================================

// Status possíveis dos agentes
export const AGENT_STATUS = ["online", "offline", "connecting", "error"] as const;
export type AgentStatus = typeof AGENT_STATUS[number];

// Status possíveis dos jobs
export const JOB_STATUS = ["queued", "running", "success", "failed", "cancelled", "timeout"] as const;
export type JobStatus = typeof JOB_STATUS[number];

// Tabela de Agentes (proxies locais em redes remotas)
export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id),
  name: text("name").notNull(),
  siteName: text("site_name").notNull(),
  description: text("description"),
  publicIp: text("public_ip"),
  status: text("status").notNull().default("offline"),
  version: text("version"),
  ipAddress: text("ip_address"),
  lastHeartbeat: timestamp("last_heartbeat"),
  capabilities: jsonb("capabilities").$type<{
    ssh: boolean;
    telnet: boolean;
    maxConcurrentJobs: number;
  }>(),
  config: jsonb("config").$type<{
    heartbeatInterval: number;
    jobTimeout: number;
    autoUpdate: boolean;
  }>(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_agents_company").on(table.companyId),
  index("idx_agents_status").on(table.status),
]);

// Tabela de Tokens de Autenticação dos Agentes
export const agentTokens = pgTable("agent_tokens", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  tokenHash: text("token_hash").notNull(),
  name: text("name").default("default"),
  expiresAt: timestamp("expires_at"),
  revokedAt: timestamp("revoked_at"),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tabela de Jobs para Agentes (fila de tarefas)
export const agentJobs = pgTable("agent_jobs", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  equipmentId: integer("equipment_id").references(() => equipment.id),
  scriptId: integer("script_id").references(() => vendorScripts.id),
  jobType: text("job_type").notNull().default("backup"),
  status: text("status").notNull().default("queued"),
  priority: integer("priority").default(5),
  payload: jsonb("payload").$type<{
    command?: string;
    timeout?: number;
    retries?: number;
  }>(),
  result: jsonb("result").$type<{
    output?: string;
    fileId?: number;
    objectName?: string;
    size?: number;
    duration?: number;
  }>(),
  errorMessage: text("error_message"),
  queuedAt: timestamp("queued_at").defaultNow(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  requestedBy: integer("requested_by").references(() => users.id),
});

// Tabela de Eventos/Logs dos Jobs
export const agentJobEvents = pgTable("agent_job_events", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => agentJobs.id).notNull(),
  eventType: text("event_type").notNull(),
  message: text("message"),
  payload: jsonb("payload"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Tabela de Métricas dos Agentes
export const agentMetrics = pgTable("agent_metrics", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  cpuUsage: real("cpu_usage"),
  memoryUsage: real("memory_usage"),
  activeSessions: integer("active_sessions").default(0),
  queuedJobs: integer("queued_jobs").default(0),
  collectedAt: timestamp("collected_at").defaultNow(),
});

// Vinculação de Equipamentos a Agentes Preferenciais
export const equipmentAgents = pgTable("equipment_agents", {
  id: serial("id").primaryKey(),
  equipmentId: integer("equipment_id").references(() => equipment.id).notNull(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  priority: integer("priority").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// GERENCIAMENTO DE CREDENCIAIS (Similar Termius)
// ============================================

// Grupos de Credenciais (ex: "Senhas Huawei Fibra", "Senhas Cisco Core")
export const credentialGroups = pgTable("credential_groups", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("#6b7280"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_credential_groups_company").on(table.companyId),
]);

// Credenciais Individuais (podem pertencer a um grupo)
export const credentials = pgTable("credentials", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id),
  groupId: integer("group_id").references(() => credentialGroups.id),
  name: text("name").notNull(),
  description: text("description"),
  manufacturer: text("manufacturer"),
  model: text("model"),
  username: text("username").notNull(),
  password: text("password").notNull(),
  enablePassword: text("enable_password"),
  port: integer("port").default(22),
  protocol: text("protocol").default("ssh"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_credentials_company").on(table.companyId),
  index("idx_credentials_group").on(table.groupId),
  index("idx_credentials_manufacturer").on(table.manufacturer),
]);

// Fabricantes padrão (usados para seed inicial)
export const DEFAULT_MANUFACTURERS = [
  { value: "mikrotik", label: "Mikrotik", color: "#ff6b6b" },
  { value: "huawei", label: "Huawei", color: "#fd79a8" },
  { value: "cisco", label: "Cisco", color: "#0077b6" },
  { value: "nokia", label: "Nokia", color: "#124191" },
  { value: "zte", label: "ZTE", color: "#00a0e9" },
  { value: "datacom", label: "Datacom", color: "#4ecdc4" },
  { value: "datacom-dmos", label: "Datacom DMOS", color: "#45b7d1" },
  { value: "juniper", label: "Juniper", color: "#84bc41" },
] as const;

// Compatibilidade com código existente
export const SUPPORTED_MANUFACTURERS = DEFAULT_MANUFACTURERS;

// Schemas de inserção - Multi-tenancy
export const insertCompanySchema = createInsertSchema(companies).omit({ id: true, createdAt: true, updatedAt: true });
export const updateCompanySchema = insertCompanySchema.partial();
export const insertServerAdminSchema = createInsertSchema(serverAdmins).omit({ id: true, createdAt: true });
export const insertUserCompanySchema = createInsertSchema(userCompanies).omit({ id: true, createdAt: true });

// Schemas de inserção
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, replitId: true, isAdmin: true });
export const insertEquipmentSchema = createInsertSchema(equipment).omit({ id: true, createdAt: true });
export const insertFileSchema = createInsertSchema(files).omit({ id: true });
export const insertBackupHistorySchema = createInsertSchema(backupHistory).omit({ id: true, executedAt: true });
export const insertSettingSchema = createInsertSchema(settings).omit({ updatedAt: true });
export const insertVendorScriptSchema = createInsertSchema(vendorScripts).omit({ id: true, updatedAt: true });
export const updateVendorScriptSchema = createInsertSchema(vendorScripts).omit({ id: true, updatedAt: true, manufacturer: true }).partial();
export const insertManufacturerSchema = createInsertSchema(manufacturers).omit({ id: true, createdAt: true });
export const insertSystemUpdateSchema = createInsertSchema(systemUpdates).omit({ id: true, appliedAt: true, status: true });
export const insertFirmwareSchema = createInsertSchema(firmware).omit({ id: true, createdAt: true });
export const updateUserSchema = createInsertSchema(users).omit({ id: true, replitId: true, createdAt: true }).partial();
export const insertBackupPolicySchema = createInsertSchema(backupPolicies).omit({ id: true, createdAt: true, updatedAt: true, lastRunAt: true, nextRunAt: true, lastStatus: true });
export const updateBackupPolicySchema = insertBackupPolicySchema.partial();
export const insertBackupPolicyRunSchema = createInsertSchema(backupPolicyRuns).omit({ id: true, startedAt: true });

// Schemas para Agentes
export const insertAgentSchema = createInsertSchema(agents).omit({ id: true, createdAt: true, updatedAt: true, lastHeartbeat: true, status: true });
export const updateAgentSchema = insertAgentSchema.partial();
export const insertAgentTokenSchema = createInsertSchema(agentTokens).omit({ id: true, createdAt: true, lastUsedAt: true, revokedAt: true });
export const insertAgentJobSchema = createInsertSchema(agentJobs).omit({ id: true, queuedAt: true, startedAt: true, finishedAt: true, status: true, result: true, errorMessage: true });
export const insertAgentJobEventSchema = createInsertSchema(agentJobEvents).omit({ id: true, timestamp: true });
export const insertAgentMetricsSchema = createInsertSchema(agentMetrics).omit({ id: true, collectedAt: true });
export const insertEquipmentAgentSchema = createInsertSchema(equipmentAgents).omit({ id: true, createdAt: true });

// Schemas para Credenciais
export const insertCredentialGroupSchema = createInsertSchema(credentialGroups).omit({ id: true, createdAt: true, updatedAt: true });
export const updateCredentialGroupSchema = insertCredentialGroupSchema.partial();
export const insertCredentialSchema = createInsertSchema(credentials).omit({ id: true, createdAt: true, updatedAt: true });
export const updateCredentialSchema = insertCredentialSchema.partial();

// Tipos
export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;
export type Equipment = typeof equipment.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type FileRecord = typeof files.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;
export type BackupHistoryRecord = typeof backupHistory.$inferSelect;
export type InsertBackupHistory = z.infer<typeof insertBackupHistorySchema>;
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type VendorScript = typeof vendorScripts.$inferSelect;
export type InsertVendorScript = z.infer<typeof insertVendorScriptSchema>;
export type Manufacturer = typeof manufacturers.$inferSelect;
export type InsertManufacturer = z.infer<typeof insertManufacturerSchema>;
export type SystemUpdate = typeof systemUpdates.$inferSelect;
export type InsertSystemUpdate = z.infer<typeof insertSystemUpdateSchema>;
export type Firmware = typeof firmware.$inferSelect;
export type InsertFirmware = z.infer<typeof insertFirmwareSchema>;
export type BackupPolicy = typeof backupPolicies.$inferSelect;
export type InsertBackupPolicy = z.infer<typeof insertBackupPolicySchema>;
export type BackupPolicyRun = typeof backupPolicyRuns.$inferSelect;
export type InsertBackupPolicyRun = z.infer<typeof insertBackupPolicyRunSchema>;

// Tipos para Agentes
export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type AgentToken = typeof agentTokens.$inferSelect;
export type InsertAgentToken = z.infer<typeof insertAgentTokenSchema>;
export type AgentJob = typeof agentJobs.$inferSelect;
export type InsertAgentJob = z.infer<typeof insertAgentJobSchema>;
export type AgentJobEvent = typeof agentJobEvents.$inferSelect;
export type InsertAgentJobEvent = z.infer<typeof insertAgentJobEventSchema>;
export type AgentMetric = typeof agentMetrics.$inferSelect;
export type InsertAgentMetric = z.infer<typeof insertAgentMetricsSchema>;
export type EquipmentAgent = typeof equipmentAgents.$inferSelect;
export type InsertEquipmentAgent = z.infer<typeof insertEquipmentAgentSchema>;

// Tipos Multi-tenancy
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type ServerAdmin = typeof serverAdmins.$inferSelect;
export type InsertServerAdmin = z.infer<typeof insertServerAdminSchema>;
export type UserCompany = typeof userCompanies.$inferSelect;
export type InsertUserCompany = z.infer<typeof insertUserCompanySchema>;

// Tipos para Credenciais
export type CredentialGroup = typeof credentialGroups.$inferSelect;
export type InsertCredentialGroup = z.infer<typeof insertCredentialGroupSchema>;
export type Credential = typeof credentials.$inferSelect;
export type InsertCredential = z.infer<typeof insertCredentialSchema>;
