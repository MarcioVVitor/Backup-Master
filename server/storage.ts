import { db } from "./db";
import { 
  files, 
  equipment, 
  users, 
  backupHistory, 
  settings,
  vendorScripts,
  manufacturers,
  systemUpdates,
  firmware,
  backupPolicies,
  agents,
  agentTokens,
  agentJobs,
  agentJobEvents,
  agentMetrics,
  equipmentAgents,
  companies,
  serverAdmins,
  userCompanies,
  credentialGroups,
  credentials,
  DEFAULT_MANUFACTURERS,
  type InsertFile, 
  type InsertEquipment, 
  type Equipment, 
  type FileRecord,
  type BackupHistoryRecord,
  type InsertBackupHistory,
  type Setting,
  type InsertSetting,
  type VendorScript,
  type InsertVendorScript,
  type Manufacturer,
  type InsertManufacturer,
  type SystemUpdate,
  type InsertSystemUpdate,
  type Firmware,
  type InsertFirmware,
  type BackupPolicy,
  type InsertBackupPolicy,
  type User,
  type Agent,
  type InsertAgent,
  type AgentToken,
  type InsertAgentToken,
  type AgentJob,
  type InsertAgentJob,
  type AgentJobEvent,
  type InsertAgentJobEvent,
  type AgentMetric,
  type InsertAgentMetric,
  type EquipmentAgent,
  type InsertEquipmentAgent,
  type Company,
  type InsertCompany,
  type ServerAdmin,
  type InsertServerAdmin,
  type UserCompany,
  type InsertUserCompany,
  type CredentialGroup,
  type InsertCredentialGroup,
  type Credential,
  type InsertCredential
} from "@shared/schema";
import { eq, desc, sql, and, gte, lt, inArray } from "drizzle-orm";

export interface IStorage {
  getUserIdByReplitId(replitId: string): Promise<number | null>;
  getUsers(): Promise<User[]>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(data: { username: string; name?: string; email?: string; role?: string; isAdmin?: boolean; active?: boolean; passwordHash?: string; passwordSalt?: string }): Promise<User>;
  updateUser(id: number, data: Partial<{ role: string; isAdmin: boolean; active: boolean; name: string; email: string }>): Promise<User | undefined>;
  deleteUser(id: number): Promise<void>;

  getEquipment(): Promise<Equipment[]>;
  getEquipmentById(id: number): Promise<Equipment | undefined>;
  getEquipmentByCompany(companyId: number): Promise<Equipment[]>;
  createEquipment(data: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: number, data: Partial<InsertEquipment>): Promise<Equipment | undefined>;
  updateEquipmentScoped(id: number, companyId: number, data: Partial<InsertEquipment>): Promise<Equipment | undefined>;
  deleteEquipment(id: number): Promise<void>;
  deleteEquipmentScoped(id: number, companyId: number): Promise<void>;

  getBackups(): Promise<FileRecord[]>;
  getBackup(id: number): Promise<FileRecord | undefined>;
  getBackupsByCompany(companyId: number): Promise<FileRecord[]>;
  createBackup(data: InsertFile): Promise<FileRecord>;
  deleteBackup(id: number): Promise<void>;
  deleteBackupScoped(id: number, companyId: number): Promise<void>;

  getBackupHistory(): Promise<BackupHistoryRecord[]>;
  getBackupHistoryByCompany(companyId: number): Promise<BackupHistoryRecord[]>;
  createBackupHistory(data: InsertBackupHistory): Promise<BackupHistoryRecord>;
  updateBackupHistory(id: number, data: Partial<InsertBackupHistory>): Promise<BackupHistoryRecord | undefined>;
  updateBackupHistoryScoped(id: number, companyId: number, data: Partial<InsertBackupHistory>): Promise<BackupHistoryRecord | undefined>;

  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  getAllSettings(): Promise<Setting[]>;

  getVendorScripts(): Promise<VendorScript[]>;
  getVendorScriptsByManufacturer(manufacturer: string): Promise<VendorScript[]>;
  getVendorScriptById(id: number): Promise<VendorScript | undefined>;
  createVendorScript(data: InsertVendorScript): Promise<VendorScript>;
  updateVendorScript(id: number, data: Partial<InsertVendorScript>): Promise<VendorScript | undefined>;
  deleteVendorScript(id: number): Promise<void>;

  getManufacturers(): Promise<Manufacturer[]>;
  createManufacturer(data: InsertManufacturer): Promise<Manufacturer>;
  updateManufacturer(id: number, data: Partial<InsertManufacturer>): Promise<Manufacturer | undefined>;
  deleteManufacturer(id: number): Promise<void>;
  seedManufacturers(): Promise<void>;

  getSystemUpdates(): Promise<SystemUpdate[]>;
  createSystemUpdate(data: InsertSystemUpdate): Promise<SystemUpdate>;

  getFirmware(): Promise<Firmware[]>;
  getFirmwareById(id: number): Promise<Firmware | undefined>;
  createFirmware(data: InsertFirmware): Promise<Firmware>;
  deleteFirmware(id: number): Promise<void>;

  getBackupPolicies(): Promise<BackupPolicy[]>;
  getBackupPolicyById(id: number): Promise<BackupPolicy | undefined>;
  createBackupPolicy(data: InsertBackupPolicy): Promise<BackupPolicy>;
  updateBackupPolicy(id: number, data: Partial<InsertBackupPolicy> & { lastRunAt?: Date; nextRunAt?: Date; lastStatus?: string }): Promise<BackupPolicy | undefined>;
  deleteBackupPolicy(id: number): Promise<void>;

  importData(data: any): Promise<void>;
  seedDefaultScripts(): Promise<void>;

  getStats(): Promise<{
    totalEquipment: number;
    totalBackups: number;
    successRate: number;
    totalSize: number;
    recentBackups: number;
    manufacturerStats: { manufacturer: string; count: number }[];
  }>;

  // Agentes (proxies locais)
  getAgents(): Promise<Agent[]>;
  getAgentsByCompany(companyId: number): Promise<Agent[]>;
  getAgentById(id: number): Promise<Agent | undefined>;
  createAgent(data: InsertAgent): Promise<Agent>;
  updateAgent(id: number, data: Partial<InsertAgent>): Promise<Agent | undefined>;
  deleteAgent(id: number): Promise<void>;
  updateAgentStatus(id: number, status: string, ipAddress?: string): Promise<void>;
  updateAgentHeartbeat(id: number, ipAddress?: string): Promise<void>;

  // Tokens de Agentes
  getAgentTokens(agentId: number): Promise<AgentToken[]>;
  createAgentToken(data: InsertAgentToken): Promise<AgentToken>;
  getAgentByToken(tokenHash: string): Promise<Agent | undefined>;
  revokeAgentToken(id: number): Promise<void>;

  // Jobs de Agentes
  getAgentJobs(agentId?: number): Promise<AgentJob[]>;
  getAgentJobById(id: number): Promise<AgentJob | undefined>;
  createAgentJob(data: InsertAgentJob): Promise<AgentJob>;
  updateAgentJob(id: number, data: Partial<AgentJob>): Promise<AgentJob | undefined>;
  getQueuedJobsForAgent(agentId: number): Promise<AgentJob[]>;

  // Eventos de Jobs
  createAgentJobEvent(data: InsertAgentJobEvent): Promise<AgentJobEvent>;
  getAgentJobEvents(jobId: number): Promise<AgentJobEvent[]>;

  // Métricas de Agentes
  createAgentMetric(data: InsertAgentMetric): Promise<AgentMetric>;
  getAgentMetrics(agentId: number, limit?: number): Promise<AgentMetric[]>;

  // Vinculação Equipamento-Agente
  getEquipmentAgents(equipmentId: number): Promise<EquipmentAgent[]>;
  getAllEquipmentAgents(companyId: number): Promise<EquipmentAgent[]>;
  getAllEquipmentAgentsAdmin(): Promise<EquipmentAgent[]>;
  setEquipmentAgent(data: InsertEquipmentAgent): Promise<EquipmentAgent>;
  removeEquipmentAgent(equipmentId: number, agentId: number): Promise<void>;
  getAgentForEquipment(equipmentId: number): Promise<Agent | undefined>;

  // Grupos de Credenciais
  getCredentialGroupsByCompany(companyId: number): Promise<CredentialGroup[]>;
  getCredentialGroupById(id: number, companyId: number): Promise<CredentialGroup | undefined>;
  createCredentialGroup(data: InsertCredentialGroup): Promise<CredentialGroup>;
  updateCredentialGroup(id: number, companyId: number, data: Partial<InsertCredentialGroup>): Promise<CredentialGroup | undefined>;
  deleteCredentialGroup(id: number, companyId: number): Promise<void>;

  // Credenciais
  getCredentialsByCompany(companyId: number): Promise<Credential[]>;
  getCredentialsByGroup(companyId: number, groupId: number): Promise<Credential[]>;
  getCredentialsByManufacturer(companyId: number, manufacturer: string): Promise<Credential[]>;
  getCredentialById(id: number, companyId: number): Promise<Credential | undefined>;
  createCredential(data: InsertCredential): Promise<Credential>;
  updateCredential(id: number, companyId: number, data: Partial<InsertCredential>): Promise<Credential | undefined>;
  deleteCredential(id: number, companyId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUserIdByReplitId(replitId: string): Promise<number | null> {
    const [user] = await db.select().from(users).where(eq(users.replitId, replitId));
    return user?.id || null;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(data: { username: string; name?: string; email?: string; role?: string; isAdmin?: boolean; active?: boolean; passwordHash?: string; passwordSalt?: string }): Promise<User> {
    const [created] = await db.insert(users).values({
      username: data.username,
      name: data.name || null,
      email: data.email || null,
      role: data.role || 'viewer',
      isAdmin: data.isAdmin || false,
      active: data.active !== false,
      passwordHash: data.passwordHash || null,
      passwordSalt: data.passwordSalt || null,
    }).returning();
    return created;
  }

  async updateUser(id: number, data: Partial<{ role: string; active: boolean; name: string; email: string }>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getEquipment(): Promise<Equipment[]> {
    return await db.select().from(equipment).orderBy(desc(equipment.createdAt));
  }

  async getEquipmentById(id: number): Promise<Equipment | undefined> {
    const [equip] = await db.select().from(equipment).where(eq(equipment.id, id));
    return equip;
  }

  async createEquipment(data: InsertEquipment): Promise<Equipment> {
    const [newEquip] = await db.insert(equipment).values(data).returning();
    return newEquip;
  }

  async updateEquipment(id: number, data: Partial<InsertEquipment>): Promise<Equipment | undefined> {
    const [updated] = await db.update(equipment).set(data).where(eq(equipment.id, id)).returning();
    return updated;
  }
  
  async updateEquipmentScoped(id: number, companyId: number, data: Partial<InsertEquipment>): Promise<Equipment | undefined> {
    const [updated] = await db.update(equipment).set(data)
      .where(and(eq(equipment.id, id), eq(equipment.companyId, companyId)))
      .returning();
    return updated;
  }

  async deleteEquipment(id: number): Promise<void> {
    await db.delete(equipment).where(eq(equipment.id, id));
  }
  
  async deleteEquipmentScoped(id: number, companyId: number): Promise<void> {
    await db.delete(equipment).where(and(eq(equipment.id, id), eq(equipment.companyId, companyId)));
  }

  async getBackups(): Promise<FileRecord[]> {
    return await db.select().from(files).orderBy(desc(files.createdAt));
  }

  async getBackup(id: number): Promise<FileRecord | undefined> {
    const [file] = await db.select().from(files).where(eq(files.id, id));
    return file;
  }

  async createBackup(data: InsertFile): Promise<FileRecord> {
    const [newFile] = await db.insert(files).values(data).returning();
    return newFile;
  }

  async deleteBackup(id: number): Promise<void> {
    // First, remove file reference from backup_history to avoid foreign key constraint
    await db.update(backupHistory).set({ fileId: null }).where(eq(backupHistory.fileId, id));
    // Then delete the file
    await db.delete(files).where(eq(files.id, id));
  }
  
  async deleteBackupScoped(id: number, companyId: number): Promise<void> {
    // First, remove file reference from backup_history to avoid foreign key constraint
    await db.update(backupHistory).set({ fileId: null }).where(eq(backupHistory.fileId, id));
    // Then delete the file
    await db.delete(files).where(and(eq(files.id, id), eq(files.companyId, companyId)));
  }

  async getBackupHistory(): Promise<BackupHistoryRecord[]> {
    return await db.select().from(backupHistory).orderBy(desc(backupHistory.executedAt));
  }
  
  async getBackupHistoryByCompany(companyId: number): Promise<BackupHistoryRecord[]> {
    return await db.select().from(backupHistory).where(eq(backupHistory.companyId, companyId)).orderBy(desc(backupHistory.executedAt));
  }

  async createBackupHistory(data: InsertBackupHistory): Promise<BackupHistoryRecord> {
    const [record] = await db.insert(backupHistory).values(data).returning();
    return record;
  }

  async updateBackupHistory(id: number, data: Partial<InsertBackupHistory>): Promise<BackupHistoryRecord | undefined> {
    const [updated] = await db.update(backupHistory).set(data).where(eq(backupHistory.id, id)).returning();
    return updated;
  }
  
  async updateBackupHistoryScoped(id: number, companyId: number, data: Partial<InsertBackupHistory>): Promise<BackupHistoryRecord | undefined> {
    const [updated] = await db.update(backupHistory).set(data)
      .where(and(eq(backupHistory.id, id), eq(backupHistory.companyId, companyId)))
      .returning();
    return updated;
  }

  async getSetting(key: string): Promise<string | null> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting?.value || null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value, updatedAt: new Date() },
      });
  }

  async getAllSettings(): Promise<Setting[]> {
    return await db.select().from(settings);
  }

  async getVendorScripts(): Promise<VendorScript[]> {
    return await db.select().from(vendorScripts).orderBy(vendorScripts.manufacturer, vendorScripts.name);
  }

  async getVendorScriptsByManufacturer(manufacturer: string): Promise<VendorScript[]> {
    return await db.select().from(vendorScripts).where(eq(vendorScripts.manufacturer, manufacturer)).orderBy(vendorScripts.name);
  }

  async getVendorScriptById(id: number): Promise<VendorScript | undefined> {
    const [script] = await db.select().from(vendorScripts).where(eq(vendorScripts.id, id));
    return script;
  }

  async createVendorScript(data: InsertVendorScript): Promise<VendorScript> {
    const [script] = await db.insert(vendorScripts).values(data).returning();
    return script;
  }

  async updateVendorScript(id: number, data: Partial<InsertVendorScript>): Promise<VendorScript | undefined> {
    const [script] = await db.update(vendorScripts).set({ ...data, updatedAt: new Date() }).where(eq(vendorScripts.id, id)).returning();
    return script;
  }

  async deleteVendorScript(id: number): Promise<void> {
    await db.delete(vendorScripts).where(eq(vendorScripts.id, id));
  }

  async getManufacturers(): Promise<Manufacturer[]> {
    return await db.select().from(manufacturers).orderBy(manufacturers.label);
  }

  async createManufacturer(data: InsertManufacturer): Promise<Manufacturer> {
    const [mfr] = await db.insert(manufacturers).values(data).returning();
    return mfr;
  }

  async updateManufacturer(id: number, data: Partial<InsertManufacturer>): Promise<Manufacturer | undefined> {
    const [updated] = await db.update(manufacturers).set(data).where(eq(manufacturers.id, id)).returning();
    return updated;
  }

  async deleteManufacturer(id: number): Promise<void> {
    await db.delete(manufacturers).where(eq(manufacturers.id, id));
  }

  async seedManufacturers(): Promise<void> {
    const existing = await this.getManufacturers();
    if (existing.length === 0) {
      for (const mfr of DEFAULT_MANUFACTURERS) {
        await db.insert(manufacturers).values({
          value: mfr.value,
          label: mfr.label,
          color: mfr.color,
        }).onConflictDoNothing();
      }
    }
  }

  async getStats(): Promise<{
    totalEquipment: number;
    totalBackups: number;
    successRate: number;
    totalSize: number;
    recentBackups: number;
    manufacturerStats: { manufacturer: string; count: number }[];
  }> {
    const [equipCount] = await db.select({ count: sql<number>`count(*)` }).from(equipment);
    const [backupCount] = await db.select({ count: sql<number>`count(*)` }).from(files);
    const [successCount] = await db.select({ count: sql<number>`count(*)` }).from(files).where(eq(files.status, 'success'));
    const [sizeSum] = await db.select({ total: sql<number>`coalesce(sum(size), 0)` }).from(files);
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [recentCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(files)
      .where(gte(files.createdAt, oneDayAgo));

    const manufacturerStats = await db
      .select({
        manufacturer: equipment.manufacturer,
        count: sql<number>`count(*)`,
      })
      .from(equipment)
      .groupBy(equipment.manufacturer);

    const total = Number(backupCount?.count || 0);
    const success = Number(successCount?.count || 0);

    return {
      totalEquipment: Number(equipCount?.count || 0),
      totalBackups: total,
      successRate: total > 0 ? Math.round((success / total) * 100) : 100,
      totalSize: Number(sizeSum?.total || 0),
      recentBackups: Number(recentCount?.count || 0),
      manufacturerStats: manufacturerStats.map(s => ({
        manufacturer: s.manufacturer,
        count: Number(s.count),
      })),
    };
  }

  async getSystemUpdates(): Promise<SystemUpdate[]> {
    return await db.select().from(systemUpdates).orderBy(desc(systemUpdates.appliedAt));
  }

  async createSystemUpdate(data: InsertSystemUpdate): Promise<SystemUpdate> {
    const [update] = await db.insert(systemUpdates).values(data).returning();
    return update;
  }

  async getFirmware(): Promise<Firmware[]> {
    return await db.select().from(firmware).orderBy(desc(firmware.createdAt));
  }

  async getFirmwareById(id: number): Promise<Firmware | undefined> {
    const [fw] = await db.select().from(firmware).where(eq(firmware.id, id));
    return fw;
  }

  async createFirmware(data: InsertFirmware): Promise<Firmware> {
    const [fw] = await db.insert(firmware).values(data).returning();
    return fw;
  }

  async deleteFirmware(id: number): Promise<void> {
    await db.delete(firmware).where(eq(firmware.id, id));
  }

  async seedDefaultScripts(): Promise<void> {
    const defaultUpdateScripts: Record<string, { command: string; description: string; fileExtension: string }> = {
      huawei: { command: `# Script de Atualizacao Huawei\n# Placeholders: {{SERVER_IP}}, {{FIRMWARE_FILE}}, {{EQUIPMENT_IP}}\nftp {{SERVER_IP}}\nget {{FIRMWARE_FILE}}\nquit\nsystem-view\nupgrade startup {{FIRMWARE_FILE}}\nreturn\nsave\ny\nreboot\ny`, description: "Script padrao de atualizacao via FTP para equipamentos Huawei", fileExtension: ".cc" },
      mikrotik: { command: `# Script de Atualizacao Mikrotik\n# Placeholders: {{SERVER_IP}}, {{FIRMWARE_FILE}}, {{EQUIPMENT_IP}}\n/tool fetch url="http://{{SERVER_IP}}/firmware/{{FIRMWARE_FILE}}" mode=http\n/system routerboard upgrade\n/system reboot`, description: "Script padrao de atualizacao via HTTP para roteadores Mikrotik", fileExtension: ".npk" },
      cisco: { command: `# Script de Atualizacao Cisco IOS\n# Placeholders: {{SERVER_IP}}, {{FIRMWARE_FILE}}, {{EQUIPMENT_IP}}\ncopy http://{{SERVER_IP}}/firmware/{{FIRMWARE_FILE}} flash:\nconfigure terminal\nboot system flash:{{FIRMWARE_FILE}}\nend\nwrite memory\nreload`, description: "Script padrao de atualizacao via HTTP para equipamentos Cisco", fileExtension: ".bin" },
      nokia: { command: `# Script de Atualizacao Nokia SR\n# Placeholders: {{SERVER_IP}}, {{FIRMWARE_FILE}}, {{EQUIPMENT_IP}}\nfile copy ftp://{{SERVER_IP}}/firmware/{{FIRMWARE_FILE}} cf3:/\nadmin software-management package install {{FIRMWARE_FILE}}\nadmin reboot now`, description: "Script padrao de atualizacao via FTP para equipamentos Nokia", fileExtension: ".tim" },
      zte: { command: `# Script de Atualizacao ZTE\n# Placeholders: {{SERVER_IP}}, {{FIRMWARE_FILE}}, {{EQUIPMENT_IP}}\nupgrade patch http://{{SERVER_IP}}/firmware/{{FIRMWARE_FILE}}\nreboot system`, description: "Script padrao de atualizacao via HTTP para equipamentos ZTE", fileExtension: ".bin" },
      datacom: { command: `# Script de Atualizacao Datacom\n# Placeholders: {{SERVER_IP}}, {{FIRMWARE_FILE}}, {{EQUIPMENT_IP}}\ncopy tftp://{{SERVER_IP}}/firmware/{{FIRMWARE_FILE}} flash:\nimage install {{FIRMWARE_FILE}}\nsave\nreload`, description: "Script padrao de atualizacao via TFTP para switches Datacom", fileExtension: ".bin" },
      "datacom-dmos": { command: `# Script de Atualizacao Datacom DMOS\n# Placeholders: {{SERVER_IP}}, {{FIRMWARE_FILE}}, {{EQUIPMENT_IP}}\nsystem download ftp://{{SERVER_IP}}/firmware/{{FIRMWARE_FILE}}\nsystem install {{FIRMWARE_FILE}}\nwrite memory\nreload`, description: "Script padrao de atualizacao via FTP para Datacom DMOS", fileExtension: ".pkg" },
      juniper: { command: `# Script de Atualizacao Juniper Junos\n# Placeholders: {{SERVER_IP}}, {{FIRMWARE_FILE}}, {{EQUIPMENT_IP}}\nfile copy http://{{SERVER_IP}}/firmware/{{FIRMWARE_FILE}} /var/tmp/\nrequest system software add /var/tmp/{{FIRMWARE_FILE}} no-validate\nrequest system reboot`, description: "Script padrao de atualizacao via HTTP para roteadores Juniper", fileExtension: ".tgz" },
    };

    const defaultBackupScripts: Record<string, { command: string; description: string; fileExtension: string }> = {
      huawei: { command: `# Script de Backup Huawei\n# Placeholders: {{EQUIPMENT_IP}}\ndisplay current-configuration`, description: "Script padrao de backup para equipamentos Huawei", fileExtension: ".cfg" },
      mikrotik: { command: `# Script de Backup Mikrotik\n# Placeholders: {{EQUIPMENT_IP}}\n/export`, description: "Script padrao de backup para roteadores Mikrotik", fileExtension: ".rsc" },
      cisco: { command: `# Script de Backup Cisco IOS\n# Placeholders: {{EQUIPMENT_IP}}\nshow running-config`, description: "Script padrao de backup para equipamentos Cisco", fileExtension: ".cfg" },
      nokia: { command: `# Script de Backup Nokia SR\n# Placeholders: {{EQUIPMENT_IP}}\nadmin display-config`, description: "Script padrao de backup para equipamentos Nokia", fileExtension: ".cfg" },
      zte: { command: `# Script de Backup ZTE\n# Placeholders: {{EQUIPMENT_IP}}\nshow running-config`, description: "Script padrao de backup para equipamentos ZTE", fileExtension: ".cfg" },
      datacom: { command: `# Script de Backup Datacom\n# Placeholders: {{EQUIPMENT_IP}}\nshow running-config`, description: "Script padrao de backup para switches Datacom", fileExtension: ".cfg" },
      "datacom-dmos": { command: `# Script de Backup Datacom DMOS\n# Placeholders: {{EQUIPMENT_IP}}\nshow configuration`, description: "Script padrao de backup para Datacom DMOS", fileExtension: ".cfg" },
      juniper: { command: `# Script de Backup Juniper Junos\n# Placeholders: {{EQUIPMENT_IP}}\nshow configuration | display set`, description: "Script padrao de backup para roteadores Juniper", fileExtension: ".cfg" },
    };

    const existingScripts = await this.getVendorScripts();
    
    for (const [manufacturer, script] of Object.entries(defaultUpdateScripts)) {
      const exists = existingScripts.some(s => s.manufacturer === manufacturer && s.name === "Script de Atualizacao");
      if (!exists) {
        await db.insert(vendorScripts).values({
          manufacturer,
          name: "Script de Atualizacao",
          command: script.command,
          description: script.description,
          fileExtension: script.fileExtension,
          timeout: 300000,
          isDefault: true,
        }).onConflictDoNothing();
      }
    }

    for (const [manufacturer, script] of Object.entries(defaultBackupScripts)) {
      const exists = existingScripts.some(s => s.manufacturer === manufacturer && s.name === "Script de Backup");
      if (!exists) {
        await db.insert(vendorScripts).values({
          manufacturer,
          name: "Script de Backup",
          command: script.command,
          description: script.description,
          fileExtension: script.fileExtension,
          timeout: 60000,
          isDefault: true,
        }).onConflictDoNothing();
      }
    }
  }

  async importData(data: any): Promise<void> {
    if (data.manufacturers && Array.isArray(data.manufacturers)) {
      for (const mfr of data.manufacturers) {
        await db.insert(manufacturers).values({
          value: mfr.value,
          label: mfr.label,
          color: mfr.color,
        }).onConflictDoNothing();
      }
    }

    if (data.equipment && Array.isArray(data.equipment)) {
      for (const equip of data.equipment) {
        const { id, createdAt, ...equipData } = equip;
        await db.insert(equipment).values(equipData).onConflictDoNothing();
      }
    }

    if (data.scripts && Array.isArray(data.scripts)) {
      for (const script of data.scripts) {
        const { id, updatedAt, ...scriptData } = script;
        await db.insert(vendorScripts).values(scriptData).onConflictDoNothing();
      }
    }

    if (data.settings && Array.isArray(data.settings)) {
      for (const setting of data.settings) {
        await db.insert(settings).values({
          key: setting.key,
          value: setting.value,
        }).onConflictDoNothing();
      }
    }

    if (data.updates && Array.isArray(data.updates)) {
      for (const update of data.updates) {
        const { id, appliedAt, ...updateData } = update;
        await db.insert(systemUpdates).values(updateData).onConflictDoNothing();
      }
    }
  }

  async getBackupPolicies(): Promise<BackupPolicy[]> {
    return await db.select().from(backupPolicies).orderBy(desc(backupPolicies.createdAt));
  }

  async getBackupPolicyById(id: number): Promise<BackupPolicy | undefined> {
    const [policy] = await db.select().from(backupPolicies).where(eq(backupPolicies.id, id));
    return policy;
  }

  async createBackupPolicy(data: InsertBackupPolicy): Promise<BackupPolicy> {
    const [policy] = await db.insert(backupPolicies).values(data).returning();
    return policy;
  }

  async updateBackupPolicy(id: number, data: Partial<InsertBackupPolicy> & { lastRunAt?: Date; nextRunAt?: Date; lastStatus?: string }): Promise<BackupPolicy | undefined> {
    const [updated] = await db.update(backupPolicies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(backupPolicies.id, id))
      .returning();
    return updated;
  }

  async deleteBackupPolicy(id: number): Promise<void> {
    await db.delete(backupPolicies).where(eq(backupPolicies.id, id));
  }

  // ============================================
  // AGENTES (PROXIES LOCAIS)
  // ============================================

  async getAgents(): Promise<Agent[]> {
    return await db.select().from(agents).orderBy(desc(agents.createdAt));
  }

  async getAgentById(id: number): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    return agent;
  }

  async createAgent(data: InsertAgent): Promise<Agent> {
    const [agent] = await db.insert(agents).values(data).returning();
    return agent;
  }

  async updateAgent(id: number, data: Partial<InsertAgent>): Promise<Agent | undefined> {
    const [updated] = await db.update(agents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(agents.id, id))
      .returning();
    return updated;
  }

  async deleteAgent(id: number): Promise<void> {
    await db.delete(agentTokens).where(eq(agentTokens.agentId, id));
    await db.delete(agentJobs).where(eq(agentJobs.agentId, id));
    await db.delete(agentMetrics).where(eq(agentMetrics.agentId, id));
    await db.delete(equipmentAgents).where(eq(equipmentAgents.agentId, id));
    await db.delete(agents).where(eq(agents.id, id));
  }

  async updateAgentStatus(id: number, status: string, ipAddress?: string): Promise<void> {
    await db.update(agents)
      .set({ 
        status, 
        ipAddress: ipAddress || undefined,
        updatedAt: new Date() 
      })
      .where(eq(agents.id, id));
  }

  async updateAgentHeartbeat(id: number, ipAddress?: string): Promise<void> {
    await db.update(agents)
      .set({ 
        status: 'online',
        lastHeartbeat: new Date(),
        ipAddress: ipAddress || undefined,
        updatedAt: new Date()
      })
      .where(eq(agents.id, id));
  }

  // ============================================
  // TOKENS DE AGENTES
  // ============================================

  async getAgentTokens(agentId: number): Promise<AgentToken[]> {
    return await db.select().from(agentTokens)
      .where(eq(agentTokens.agentId, agentId))
      .orderBy(desc(agentTokens.createdAt));
  }

  async createAgentToken(data: InsertAgentToken): Promise<AgentToken> {
    const [token] = await db.insert(agentTokens).values(data).returning();
    return token;
  }

  async getAgentByToken(tokenHash: string): Promise<Agent | undefined> {
    const [tokenRecord] = await db.select().from(agentTokens)
      .where(and(
        eq(agentTokens.tokenHash, tokenHash),
        sql`${agentTokens.revokedAt} IS NULL`,
        sql`(${agentTokens.expiresAt} IS NULL OR ${agentTokens.expiresAt} > NOW())`
      ));
    
    if (!tokenRecord) return undefined;
    
    await db.update(agentTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(agentTokens.id, tokenRecord.id));
    
    return await this.getAgentById(tokenRecord.agentId);
  }

  async revokeAgentToken(id: number): Promise<void> {
    await db.update(agentTokens)
      .set({ revokedAt: new Date() })
      .where(eq(agentTokens.id, id));
  }

  // ============================================
  // JOBS DE AGENTES
  // ============================================

  async getAgentJobs(agentId?: number): Promise<AgentJob[]> {
    if (agentId) {
      return await db.select().from(agentJobs)
        .where(eq(agentJobs.agentId, agentId))
        .orderBy(desc(agentJobs.queuedAt));
    }
    return await db.select().from(agentJobs).orderBy(desc(agentJobs.queuedAt));
  }

  async getAgentJobById(id: number): Promise<AgentJob | undefined> {
    const [job] = await db.select().from(agentJobs).where(eq(agentJobs.id, id));
    return job;
  }

  async createAgentJob(data: InsertAgentJob): Promise<AgentJob> {
    const [job] = await db.insert(agentJobs).values(data as any).returning();
    return job;
  }

  async updateAgentJob(id: number, data: Partial<AgentJob>): Promise<AgentJob | undefined> {
    const [updated] = await db.update(agentJobs)
      .set(data)
      .where(eq(agentJobs.id, id))
      .returning();
    return updated;
  }

  async getQueuedJobsForAgent(agentId: number): Promise<AgentJob[]> {
    return await db.select().from(agentJobs)
      .where(and(
        eq(agentJobs.agentId, agentId),
        eq(agentJobs.status, 'queued')
      ))
      .orderBy(agentJobs.priority, agentJobs.queuedAt);
  }

  // ============================================
  // EVENTOS DE JOBS
  // ============================================

  async createAgentJobEvent(data: InsertAgentJobEvent): Promise<AgentJobEvent> {
    const [event] = await db.insert(agentJobEvents).values(data).returning();
    return event;
  }

  async getAgentJobEvents(jobId: number): Promise<AgentJobEvent[]> {
    return await db.select().from(agentJobEvents)
      .where(eq(agentJobEvents.jobId, jobId))
      .orderBy(agentJobEvents.timestamp);
  }

  // ============================================
  // MÉTRICAS DE AGENTES
  // ============================================

  async createAgentMetric(data: InsertAgentMetric): Promise<AgentMetric> {
    const [metric] = await db.insert(agentMetrics).values(data).returning();
    return metric;
  }

  async getAgentMetrics(agentId: number, limit: number = 100): Promise<AgentMetric[]> {
    return await db.select().from(agentMetrics)
      .where(eq(agentMetrics.agentId, agentId))
      .orderBy(desc(agentMetrics.collectedAt))
      .limit(limit);
  }

  // ============================================
  // VINCULAÇÃO EQUIPAMENTO-AGENTE
  // ============================================

  async getEquipmentAgents(equipmentId: number): Promise<EquipmentAgent[]> {
    return await db.select().from(equipmentAgents)
      .where(eq(equipmentAgents.equipmentId, equipmentId))
      .orderBy(equipmentAgents.priority);
  }

  async getAllEquipmentAgents(companyId: number): Promise<EquipmentAgent[]> {
    const companyEquipment = await db.select({ id: equipment.id })
      .from(equipment)
      .where(eq(equipment.companyId, companyId));
    
    const equipmentIds = companyEquipment.map(e => e.id);
    if (equipmentIds.length === 0) return [];
    
    return await db.select().from(equipmentAgents)
      .where(inArray(equipmentAgents.equipmentId, equipmentIds))
      .orderBy(equipmentAgents.equipmentId, equipmentAgents.priority);
  }

  async getAllEquipmentAgentsAdmin(): Promise<EquipmentAgent[]> {
    return await db.select().from(equipmentAgents)
      .orderBy(equipmentAgents.equipmentId, equipmentAgents.priority);
  }

  async setEquipmentAgent(data: InsertEquipmentAgent): Promise<EquipmentAgent> {
    const existing = await db.select().from(equipmentAgents)
      .where(and(
        eq(equipmentAgents.equipmentId, data.equipmentId),
        eq(equipmentAgents.agentId, data.agentId)
      ));
    
    if (existing.length > 0) {
      const [updated] = await db.update(equipmentAgents)
        .set({ priority: data.priority })
        .where(eq(equipmentAgents.id, existing[0].id))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(equipmentAgents).values(data).returning();
    return created;
  }

  async removeEquipmentAgent(equipmentId: number, agentId: number): Promise<void> {
    await db.delete(equipmentAgents)
      .where(and(
        eq(equipmentAgents.equipmentId, equipmentId),
        eq(equipmentAgents.agentId, agentId)
      ));
  }

  async getAgentForEquipment(equipmentId: number): Promise<Agent | undefined> {
    const [mapping] = await db.select().from(equipmentAgents)
      .where(eq(equipmentAgents.equipmentId, equipmentId))
      .orderBy(equipmentAgents.priority)
      .limit(1);
    
    if (!mapping) return undefined;
    
    const agent = await this.getAgentById(mapping.agentId);
    if (agent && agent.status === 'online') {
      return agent;
    }
    return undefined;
  }

  // ============================================
  // MULTI-TENANCY - EMPRESAS
  // ============================================

  async getCompanies(): Promise<Company[]> {
    return await db.select().from(companies).orderBy(companies.name);
  }

  async getCompanyById(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }

  async getCompanyBySlug(slug: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.slug, slug));
    return company;
  }

  async createCompany(data: InsertCompany): Promise<Company> {
    const insertData: any = {
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      logo: data.logo ?? null,
      active: data.active ?? true,
      maxUsers: data.maxUsers ?? 10,
      maxEquipment: data.maxEquipment ?? 100,
      maxAgents: data.maxAgents ?? 5,
      settings: data.settings ?? null,
    };
    const [company] = await db.insert(companies).values(insertData).returning();
    return company;
  }

  async updateCompany(id: number, data: Partial<InsertCompany>): Promise<Company | undefined> {
    const updateData: any = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.logo !== undefined) updateData.logo = data.logo;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.maxUsers !== undefined) updateData.maxUsers = data.maxUsers;
    if (data.maxEquipment !== undefined) updateData.maxEquipment = data.maxEquipment;
    if (data.maxAgents !== undefined) updateData.maxAgents = data.maxAgents;
    if (data.settings !== undefined) updateData.settings = data.settings;
    
    const [company] = await db.update(companies)
      .set(updateData)
      .where(eq(companies.id, id))
      .returning();
    return company;
  }

  async deleteCompany(id: number): Promise<void> {
    await db.delete(companies).where(eq(companies.id, id));
  }

  // ============================================
  // MULTI-TENANCY - SERVER ADMINS
  // ============================================

  async getServerAdmins(): Promise<ServerAdmin[]> {
    return await db.select().from(serverAdmins);
  }

  async getServerAdminsWithUserInfo(): Promise<(ServerAdmin & { username?: string; email?: string })[]> {
    const admins = await db.select({
      id: serverAdmins.id,
      userId: serverAdmins.userId,
      role: serverAdmins.role,
      permissions: serverAdmins.permissions,
      createdAt: serverAdmins.createdAt,
      username: users.username,
      email: users.email,
    })
    .from(serverAdmins)
    .leftJoin(users, eq(serverAdmins.userId, users.id));
    
    return admins.map(a => ({
      id: a.id,
      userId: a.userId,
      role: a.role,
      permissions: a.permissions,
      createdAt: a.createdAt,
      username: a.username || undefined,
      email: a.email || undefined,
    }));
  }

  async getAllUsers(): Promise<{ id: number; username: string; email: string | null }[]> {
    return await db.select({
      id: users.id,
      username: users.username,
      email: users.email,
    }).from(users);
  }

  async getServerAdminByUserId(userId: number): Promise<ServerAdmin | undefined> {
    const [admin] = await db.select().from(serverAdmins).where(eq(serverAdmins.userId, userId));
    return admin;
  }

  async createServerAdmin(data: InsertServerAdmin): Promise<ServerAdmin> {
    const insertData: any = {
      userId: data.userId,
      role: data.role ?? "support_engineer",
      permissions: data.permissions ?? null,
    };
    const [admin] = await db.insert(serverAdmins).values(insertData).returning();
    return admin;
  }

  async updateServerAdmin(id: number, data: Partial<InsertServerAdmin>): Promise<ServerAdmin | undefined> {
    const updateData: any = {};
    if (data.role !== undefined) updateData.role = data.role;
    if (data.permissions !== undefined) updateData.permissions = data.permissions;
    
    const [admin] = await db.update(serverAdmins)
      .set(updateData)
      .where(eq(serverAdmins.id, id))
      .returning();
    return admin;
  }

  async deleteServerAdmin(id: number): Promise<void> {
    await db.delete(serverAdmins).where(eq(serverAdmins.id, id));
  }

  // ============================================
  // MULTI-TENANCY - USER COMPANIES
  // ============================================

  async getUserCompanies(userId: number): Promise<UserCompany[]> {
    return await db.select().from(userCompanies).where(eq(userCompanies.userId, userId));
  }

  async getCompanyUsers(companyId: number): Promise<UserCompany[]> {
    return await db.select().from(userCompanies).where(eq(userCompanies.companyId, companyId));
  }

  async addUserToCompany(data: InsertUserCompany): Promise<UserCompany> {
    const [uc] = await db.insert(userCompanies).values(data).returning();
    return uc;
  }

  async updateUserCompanyRole(userId: number, companyId: number, role: string): Promise<UserCompany | undefined> {
    const [uc] = await db.update(userCompanies)
      .set({ role })
      .where(and(eq(userCompanies.userId, userId), eq(userCompanies.companyId, companyId)))
      .returning();
    return uc;
  }

  async removeUserFromCompany(userId: number, companyId: number): Promise<void> {
    await db.delete(userCompanies)
      .where(and(eq(userCompanies.userId, userId), eq(userCompanies.companyId, companyId)));
  }

  async setDefaultCompany(userId: number, companyId: number): Promise<void> {
    await db.update(userCompanies)
      .set({ isDefault: false })
      .where(eq(userCompanies.userId, userId));
    await db.update(userCompanies)
      .set({ isDefault: true })
      .where(and(eq(userCompanies.userId, userId), eq(userCompanies.companyId, companyId)));
  }

  // ============================================
  // TENANT-SCOPED QUERIES
  // ============================================

  async getEquipmentByCompany(companyId: number): Promise<Equipment[]> {
    return await db.select().from(equipment).where(eq(equipment.companyId, companyId));
  }

  async getAgentsByCompany(companyId: number): Promise<Agent[]> {
    return await db.select().from(agents).where(eq(agents.companyId, companyId));
  }

  async getBackupsByCompany(companyId: number): Promise<FileRecord[]> {
    return await db.select().from(files)
      .where(eq(files.companyId, companyId))
      .orderBy(desc(files.createdAt));
  }

  async getBackupPoliciesByCompany(companyId: number): Promise<BackupPolicy[]> {
    return await db.select().from(backupPolicies).where(eq(backupPolicies.companyId, companyId));
  }

  async getAllAgentsWithCompany(): Promise<(Agent & { companyName: string | null })[]> {
    const result = await db
      .select({
        id: agents.id,
        companyId: agents.companyId,
        name: agents.name,
        siteName: agents.siteName,
        description: agents.description,
        publicIp: agents.publicIp,
        status: agents.status,
        version: agents.version,
        ipAddress: agents.ipAddress,
        lastHeartbeat: agents.lastHeartbeat,
        capabilities: agents.capabilities,
        config: agents.config,
        createdBy: agents.createdBy,
        createdAt: agents.createdAt,
        updatedAt: agents.updatedAt,
        companyName: companies.name,
      })
      .from(agents)
      .leftJoin(companies, eq(agents.companyId, companies.id))
      .orderBy(agents.status, agents.name);
    
    return result.map(r => ({
      ...r,
      companyName: r.companyName || null,
    }));
  }

  // ============================================
  // CREDENCIAIS - Grupos de Credenciais
  // ============================================

  async getCredentialGroupsByCompany(companyId: number): Promise<CredentialGroup[]> {
    return await db.select().from(credentialGroups)
      .where(eq(credentialGroups.companyId, companyId))
      .orderBy(credentialGroups.name);
  }

  async getCredentialGroupById(id: number, companyId: number): Promise<CredentialGroup | undefined> {
    const [group] = await db.select().from(credentialGroups)
      .where(and(eq(credentialGroups.id, id), eq(credentialGroups.companyId, companyId)));
    return group;
  }

  async createCredentialGroup(data: InsertCredentialGroup): Promise<CredentialGroup> {
    const [created] = await db.insert(credentialGroups).values(data).returning();
    return created;
  }

  async updateCredentialGroup(id: number, companyId: number, data: Partial<InsertCredentialGroup>): Promise<CredentialGroup | undefined> {
    const [updated] = await db.update(credentialGroups)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(credentialGroups.id, id), eq(credentialGroups.companyId, companyId)))
      .returning();
    return updated;
  }

  async deleteCredentialGroup(id: number, companyId: number): Promise<void> {
    await db.delete(credentialGroups)
      .where(and(eq(credentialGroups.id, id), eq(credentialGroups.companyId, companyId)));
  }

  // ============================================
  // CREDENCIAIS - Credenciais Individuais
  // ============================================

  async getCredentialsByCompany(companyId: number): Promise<Credential[]> {
    return await db.select().from(credentials)
      .where(eq(credentials.companyId, companyId))
      .orderBy(credentials.name);
  }

  async getCredentialsByGroup(companyId: number, groupId: number): Promise<Credential[]> {
    return await db.select().from(credentials)
      .where(and(eq(credentials.companyId, companyId), eq(credentials.groupId, groupId)))
      .orderBy(credentials.name);
  }

  async getCredentialsByManufacturer(companyId: number, manufacturer: string): Promise<Credential[]> {
    return await db.select().from(credentials)
      .where(and(eq(credentials.companyId, companyId), eq(credentials.manufacturer, manufacturer)))
      .orderBy(credentials.name);
  }

  async getCredentialById(id: number, companyId: number): Promise<Credential | undefined> {
    const [cred] = await db.select().from(credentials)
      .where(and(eq(credentials.id, id), eq(credentials.companyId, companyId)));
    return cred;
  }

  async createCredential(data: InsertCredential): Promise<Credential> {
    const [created] = await db.insert(credentials).values(data).returning();
    return created;
  }

  async updateCredential(id: number, companyId: number, data: Partial<InsertCredential>): Promise<Credential | undefined> {
    const [updated] = await db.update(credentials)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(credentials.id, id), eq(credentials.companyId, companyId)))
      .returning();
    return updated;
  }

  async deleteCredential(id: number, companyId: number): Promise<void> {
    await db.delete(credentials)
      .where(and(eq(credentials.id, id), eq(credentials.companyId, companyId)));
  }
}

export const storage = new DatabaseStorage();
