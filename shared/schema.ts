import { pgTable, text, serial, integer, timestamp, boolean, varchar, jsonb, index, real } from "drizzle-orm/pg-core";
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

// User storage table (matches existing DB)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  replitId: text("replit_id").unique(),
  username: text("username").notNull(),
  name: text("name"),
  email: text("email"),
  isAdmin: boolean("is_admin").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tabela de Equipamentos de Rede
export const equipment = pgTable("equipment", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ip: text("ip").notNull(),
  manufacturer: text("manufacturer").notNull(),
  model: text("model"),
  username: text("username"),
  password: text("password"),
  port: integer("port").default(22),
  protocol: text("protocol").default("ssh"),
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tabela de Arquivos/Backups (integrada com Object Storage)
export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  equipmentId: integer("equipment_id").references(() => equipment.id),
  filename: text("filename").notNull(),
  objectName: text("object_name").notNull(),
  size: integer("size").notNull(),
  mimeType: text("mime_type"),
  status: text("status").default("success"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tabela de Histórico de Backups (logs de execução)
export const backupHistory = pgTable("backup_history", {
  id: serial("id").primaryKey(),
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
});

// Tabela de Configurações do Sistema
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Fabricantes suportados
export const SUPPORTED_MANUFACTURERS = [
  { value: "mikrotik", label: "Mikrotik", color: "#ff6b6b" },
  { value: "huawei", label: "Huawei", color: "#fd79a8" },
  { value: "cisco", label: "Cisco", color: "#0077b6" },
  { value: "nokia", label: "Nokia", color: "#124191" },
  { value: "zte", label: "ZTE", color: "#00a0e9" },
  { value: "datacom", label: "Datacom", color: "#4ecdc4" },
  { value: "datacom-dmos", label: "Datacom DMOS", color: "#45b7d1" },
  { value: "juniper", label: "Juniper", color: "#84bc41" },
] as const;

// Schemas de inserção
export const insertEquipmentSchema = createInsertSchema(equipment).omit({ id: true, createdAt: true });
export const insertFileSchema = createInsertSchema(files).omit({ id: true, createdAt: true });
export const insertBackupHistorySchema = createInsertSchema(backupHistory).omit({ id: true, executedAt: true });
export const insertSettingSchema = createInsertSchema(settings).omit({ updatedAt: true });

// Tipos
export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;
export type Equipment = typeof equipment.$inferSelect;
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type FileRecord = typeof files.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;
export type BackupHistoryRecord = typeof backupHistory.$inferSelect;
export type InsertBackupHistory = z.infer<typeof insertBackupHistorySchema>;
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;
