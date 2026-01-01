import { db } from "./db";
import { files, equipment, users, type InsertFile, type InsertEquipment, type Equipment, type FileRecord } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUserIdByReplitId(replitId: string): Promise<number | null>;

  // Equipment
  getEquipment(): Promise<Equipment[]>;
  getEquipmentById(id: number): Promise<Equipment | undefined>;
  createEquipment(data: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: number, data: Partial<InsertEquipment>): Promise<Equipment | undefined>;
  deleteEquipment(id: number): Promise<void>;

  // Backups
  getBackups(): Promise<FileRecord[]>;
  getBackup(id: number): Promise<FileRecord | undefined>;
  createBackup(data: InsertFile): Promise<FileRecord>;
  deleteBackup(id: number): Promise<void>;

  // Stats
  getStats(): Promise<{ totalEquipment: number; totalBackups: number; successRate: number }>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUserIdByReplitId(replitId: string): Promise<number | null> {
    const [user] = await db.select().from(users).where(eq(users.replitId, replitId));
    return user?.id || null;
  }

  // Equipment
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

  // Backups
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

  // Stats
  async getStats(): Promise<{ totalEquipment: number; totalBackups: number; successRate: number }> {
    const [equipCount] = await db.select({ count: sql<number>`count(*)` }).from(equipment);
    const [backupCount] = await db.select({ count: sql<number>`count(*)` }).from(files);
    const [successCount] = await db.select({ count: sql<number>`count(*)` }).from(files).where(eq(files.status, 'success'));

    const total = Number(backupCount?.count || 0);
    const success = Number(successCount?.count || 0);
    
    return {
      totalEquipment: Number(equipCount?.count || 0),
      totalBackups: total,
      successRate: total > 0 ? Math.round((success / total) * 100) : 100,
    };
  }
}

export const storage = new DatabaseStorage();
