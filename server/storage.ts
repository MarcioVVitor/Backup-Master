import { db } from "./db";
import { files, users, equipment, type InsertFile, type InsertUser, type User, type Equipment, type InsertEquipment } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByReplitId(replitId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Equipamentos
  getEquipments(): Promise<Equipment[]>;
  getEquipment(id: number): Promise<Equipment | undefined>;
  createEquipment(eqp: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: number, eqp: Partial<InsertEquipment>): Promise<Equipment>;
  deleteEquipment(id: number): Promise<void>;

  // Backups/Arquivos
  getFiles(userId: number): Promise<typeof files.$inferSelect[]>;
  getFile(id: number): Promise<typeof files.$inferSelect | undefined>;
  createFile(file: InsertFile): Promise<typeof files.$inferSelect>;
  deleteFile(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByReplitId(replitId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.replitId, replitId));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getEquipments(): Promise<Equipment[]> {
    return await db.select().from(equipment);
  }

  async getEquipment(id: number): Promise<Equipment | undefined> {
    const [eqp] = await db.select().from(equipment).where(eq(equipment.id, id));
    return eqp;
  }

  async createEquipment(insertEqp: InsertEquipment): Promise<Equipment> {
    const [eqp] = await db.insert(equipment).values(insertEqp).returning();
    return eqp;
  }

  async updateEquipment(id: number, updateEqp: Partial<InsertEquipment>): Promise<Equipment> {
    const [eqp] = await db.update(equipment).set(updateEqp).where(eq(equipment.id, id)).returning();
    return eqp;
  }

  async deleteEquipment(id: number): Promise<void> {
    await db.delete(equipment).where(eq(equipment.id, id));
  }

  async getFiles(userId: number): Promise<typeof files.$inferSelect[]> {
    return await db.select().from(files).where(eq(files.userId, userId));
  }

  async getFile(id: number): Promise<typeof files.$inferSelect | undefined> {
    const [file] = await db.select().from(files).where(eq(files.id, id));
    return file;
  }

  async createFile(file: InsertFile): Promise<typeof files.$inferSelect> {
    const [newFile] = await db.insert(files).values(file).returning();
    return newFile;
  }

  async deleteFile(id: number): Promise<void> {
    await db.delete(files).where(eq(files.id, id));
  }
}

export const storage = new DatabaseStorage();
