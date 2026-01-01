import { pgTable, text, serial, integer, timestamp, boolean, varchar, jsonb, index } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at").defaultNow(),
});

// Tabelas de Equipamentos (NBM)
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

// Tabelas de Arquivos/Backups (NBM + Object Storage)
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

export const insertEquipmentSchema = createInsertSchema(equipment).omit({ id: true, createdAt: true });
export const insertFileSchema = createInsertSchema(files).omit({ id: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;
export type Equipment = typeof equipment.$inferSelect;
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type FileRecord = typeof files.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;
