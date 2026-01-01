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
  type User
} from "@shared/schema";
import { eq, desc, sql, and, gte } from "drizzle-orm";

export interface IStorage {
  getUserIdByReplitId(replitId: string): Promise<number | null>;
  getUsers(): Promise<User[]>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(data: { username: string; name?: string; email?: string; role?: string; active?: boolean }): Promise<User>;
  updateUser(id: number, data: Partial<{ role: string; active: boolean; name: string; email: string }>): Promise<User | undefined>;
  deleteUser(id: number): Promise<void>;

  getEquipment(): Promise<Equipment[]>;
  getEquipmentById(id: number): Promise<Equipment | undefined>;
  createEquipment(data: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: number, data: Partial<InsertEquipment>): Promise<Equipment | undefined>;
  deleteEquipment(id: number): Promise<void>;

  getBackups(): Promise<FileRecord[]>;
  getBackup(id: number): Promise<FileRecord | undefined>;
  createBackup(data: InsertFile): Promise<FileRecord>;
  deleteBackup(id: number): Promise<void>;

  getBackupHistory(): Promise<BackupHistoryRecord[]>;
  createBackupHistory(data: InsertBackupHistory): Promise<BackupHistoryRecord>;
  updateBackupHistory(id: number, data: Partial<InsertBackupHistory>): Promise<BackupHistoryRecord | undefined>;

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

  async createUser(data: { username: string; name?: string; email?: string; role?: string; active?: boolean }): Promise<User> {
    const [created] = await db.insert(users).values({
      username: data.username,
      name: data.name || null,
      email: data.email || null,
      role: data.role || 'viewer',
      active: data.active !== false,
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

  async deleteEquipment(id: number): Promise<void> {
    await db.delete(equipment).where(eq(equipment.id, id));
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
    await db.delete(files).where(eq(files.id, id));
  }

  async getBackupHistory(): Promise<BackupHistoryRecord[]> {
    return await db.select().from(backupHistory).orderBy(desc(backupHistory.executedAt));
  }

  async createBackupHistory(data: InsertBackupHistory): Promise<BackupHistoryRecord> {
    const [record] = await db.insert(backupHistory).values(data).returning();
    return record;
  }

  async updateBackupHistory(id: number, data: Partial<InsertBackupHistory>): Promise<BackupHistoryRecord | undefined> {
    const [updated] = await db.update(backupHistory).set(data).where(eq(backupHistory.id, id)).returning();
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
}

export const storage = new DatabaseStorage();
