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
  type InsertSystemUpdate
} from "@shared/schema";
import { eq, desc, sql, and, gte } from "drizzle-orm";

export interface IStorage {
  getUserIdByReplitId(replitId: string): Promise<number | null>;

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
  getVendorScript(manufacturer: string): Promise<VendorScript | undefined>;
  upsertVendorScript(data: InsertVendorScript): Promise<VendorScript>;
  deleteVendorScript(manufacturer: string): Promise<void>;

  getManufacturers(): Promise<Manufacturer[]>;
  createManufacturer(data: InsertManufacturer): Promise<Manufacturer>;
  updateManufacturer(id: number, data: Partial<InsertManufacturer>): Promise<Manufacturer | undefined>;
  deleteManufacturer(id: number): Promise<void>;
  seedManufacturers(): Promise<void>;

  getSystemUpdates(): Promise<SystemUpdate[]>;
  createSystemUpdate(data: InsertSystemUpdate): Promise<SystemUpdate>;

  importData(data: any): Promise<void>;

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
    return await db.select().from(vendorScripts).orderBy(vendorScripts.manufacturer);
  }

  async getVendorScript(manufacturer: string): Promise<VendorScript | undefined> {
    const [script] = await db.select().from(vendorScripts).where(eq(vendorScripts.manufacturer, manufacturer));
    return script;
  }

  async upsertVendorScript(data: InsertVendorScript): Promise<VendorScript> {
    const [script] = await db
      .insert(vendorScripts)
      .values(data)
      .onConflictDoUpdate({
        target: vendorScripts.manufacturer,
        set: { 
          command: data.command,
          description: data.description,
          fileExtension: data.fileExtension,
          useShell: data.useShell,
          timeout: data.timeout,
          updatedAt: new Date(),
        },
      })
      .returning();
    return script;
  }

  async deleteVendorScript(manufacturer: string): Promise<void> {
    await db.delete(vendorScripts).where(eq(vendorScripts.manufacturer, manufacturer));
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
