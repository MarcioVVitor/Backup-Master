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

// Roles de usuario
export const USER_ROLES = ["admin", "operator", "viewer"] as const;
export type UserRole = typeof USER_ROLES[number];

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
  description: text("description").notNull(),
  filename: text("filename"),
  objectName: text("object_name"),
  size: integer("size"),
  appliedAt: timestamp("applied_at").defaultNow(),
  appliedBy: text("applied_by").notNull(),
});

// Tabela de Firmware
export const firmware = pgTable("firmware", {
  id: serial("id").primaryKey(),
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

// Schemas de inserção
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, replitId: true, isAdmin: true });
export const insertEquipmentSchema = createInsertSchema(equipment).omit({ id: true, createdAt: true });
export const insertFileSchema = createInsertSchema(files).omit({ id: true, createdAt: true });
export const insertBackupHistorySchema = createInsertSchema(backupHistory).omit({ id: true, executedAt: true });
export const insertSettingSchema = createInsertSchema(settings).omit({ updatedAt: true });
export const insertVendorScriptSchema = createInsertSchema(vendorScripts).omit({ id: true, updatedAt: true });
export const updateVendorScriptSchema = createInsertSchema(vendorScripts).omit({ id: true, updatedAt: true, manufacturer: true }).partial();
export const insertManufacturerSchema = createInsertSchema(manufacturers).omit({ id: true, createdAt: true });
export const insertSystemUpdateSchema = createInsertSchema(systemUpdates).omit({ id: true, appliedAt: true });
export const insertFirmwareSchema = createInsertSchema(firmware).omit({ id: true, createdAt: true });
export const updateUserSchema = createInsertSchema(users).omit({ id: true, replitId: true, createdAt: true }).partial();

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
