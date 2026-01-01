import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { setupAuth, isAuthenticated, registerAuthRoutes, getSession } from "./replit_integrations/auth";
import { insertEquipmentSchema, insertVendorScriptSchema, insertSystemUpdateSchema, insertFirmwareSchema, SUPPORTED_MANUFACTURERS, USER_ROLES } from "@shared/schema";
import { z } from "zod";
import { WebSocketServer, WebSocket } from "ws";
import { Client as SSHClient } from "ssh2";
import net from "net";

const updateUserSchema = z.object({
  role: z.enum(["admin", "operator", "viewer"]).optional(),
  active: z.boolean().optional(),
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
});

const customizationSchema = z.object({
  logoUrl: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  systemName: z.string().min(1).max(50).optional(),
  serverIp: z.string().optional(),
});

const upload = multer({ storage: multer.memoryStorage() });

const isAdmin = async (req: any, res: any, next: any) => {
  try {
    const user = req.user as any;
    const userSub = user?.claims?.sub;
    if (!userSub) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    const { db } = await import("./db");
    const { users } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [dbUser] = await db.select().from(users).where(eq(users.replitId, userSub));
    if (!dbUser || (dbUser.role !== 'admin' && !dbUser.isAdmin)) {
      return res.status(403).json({ message: "Apenas administradores podem acessar este recurso" });
    }
    next();
  } catch (e) {
    console.error("Error checking admin:", e);
    res.status(500).json({ message: "Erro ao verificar permissao" });
  }
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  const sanitizeEquipment = (equip: any) => {
    const { password, ...rest } = equip;
    return rest;
  };

  // API - Fabricantes suportados
  app.get('/api/manufacturers', isAuthenticated, (req, res) => {
    res.json(SUPPORTED_MANUFACTURERS);
  });

  // API - Equipamentos
  app.get('/api/equipment', isAuthenticated, async (req, res) => {
    try {
      const equipmentList = await storage.getEquipment();
      res.json(equipmentList.map(sanitizeEquipment));
    } catch (e) {
      console.error("Error listing equipment:", e);
      res.status(500).json({ message: "Erro ao listar equipamentos" });
    }
  });

  app.post('/api/equipment', isAuthenticated, async (req, res) => {
    try {
      const parsed = insertEquipmentSchema.parse(req.body);
      const equipment = await storage.createEquipment(parsed);
      res.status(201).json(sanitizeEquipment(equipment));
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: e.errors });
      }
      console.error("Error creating equipment:", e);
      res.status(500).json({ message: "Erro ao criar equipamento" });
    }
  });

  app.put('/api/equipment/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const parsed = insertEquipmentSchema.partial().parse(req.body);
      if (parsed.password === '' || parsed.password === undefined) {
        delete parsed.password;
      }
      const equipment = await storage.updateEquipment(id, parsed);
      if (!equipment) return res.status(404).json({ message: "Equipamento não encontrado" });
      res.json(sanitizeEquipment(equipment));
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: e.errors });
      }
      console.error("Error updating equipment:", e);
      res.status(500).json({ message: "Erro ao atualizar equipamento" });
    }
  });

  app.delete('/api/equipment/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteEquipment(id);
      res.sendStatus(204);
    } catch (e) {
      console.error("Error deleting equipment:", e);
      res.status(500).json({ message: "Erro ao excluir equipamento" });
    }
  });

  // API - Backups/Arquivos
  app.get('/api/backups', isAuthenticated, async (req, res) => {
    try {
      const backups = await storage.getBackups();
      const equipmentList = await storage.getEquipment();
      const equipmentMap = new Map(equipmentList.map(e => [e.id, e]));
      
      const enrichedBackups = backups.map(b => {
        const equip = b.equipmentId ? equipmentMap.get(b.equipmentId) : null;
        return {
          ...b,
          equipmentName: equip?.name || 'Manual Upload',
          manufacturer: equip?.manufacturer || 'N/A',
          ip: equip?.ip || 'N/A',
        };
      });
      
      res.json({ success: true, total: enrichedBackups.length, backups: enrichedBackups });
    } catch (e) {
      console.error("Error listing backups:", e);
      res.status(500).json({ success: false, error: "Erro ao listar backups" });
    }
  });

  app.post('/api/backups', isAuthenticated, upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "Nenhum arquivo enviado" });
    }

    const user = req.user as any;
    const userSub = user?.claims?.sub;
    const userId = userSub ? await storage.getUserIdByReplitId(userSub) : null;

    const { objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) return res.status(500).json({ message: "Bucket não configurado" });

    const objectName = `backups/${Date.now()}-${req.file.originalname}`;
    const bucket = objectStorageClient.bucket(bucketId);
    const file = bucket.file(objectName);

    try {
      await file.save(req.file.buffer, {
        contentType: req.file.mimetype,
      });

      const fileRecord = await storage.createBackup({
        userId: userId || 1,
        equipmentId: req.body.equipmentId ? parseInt(req.body.equipmentId) : null,
        filename: req.file.originalname,
        objectName,
        size: req.file.size,
        mimeType: req.file.mimetype,
        status: "success",
      });

      res.status(201).json(fileRecord);
    } catch (e) {
      console.error("Erro upload:", e);
      res.status(500).json({ message: "Erro ao fazer upload" });
    }
  });

  app.get('/api/backups/:id/download', isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const backup = await storage.getBackup(id);

    if (!backup) return res.status(404).send("Backup não encontrado");

    const { objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    const bucket = objectStorageClient.bucket(bucketId!);
    const file = bucket.file(backup.objectName);

    try {
      const [exists] = await file.exists();
      if (!exists) return res.status(404).send("Arquivo não encontrado no storage");

      const [buffer] = await file.download();
      res.setHeader('Content-Type', backup.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${backup.filename}"`);
      res.send(buffer);
    } catch (e) {
      console.error("Error downloading:", e);
      res.status(500).send("Erro ao baixar arquivo");
    }
  });

  // API - Visualizar conteúdo do backup
  app.get('/api/backups/:id/view', isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const backup = await storage.getBackup(id);

    if (!backup) return res.status(404).json({ error: "Backup não encontrado" });

    const { objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    const bucket = objectStorageClient.bucket(bucketId!);
    const file = bucket.file(backup.objectName);

    try {
      const [exists] = await file.exists();
      if (!exists) return res.status(404).json({ error: "Arquivo não encontrado no storage" });

      const [buffer] = await file.download();
      const content = buffer.toString('utf-8').slice(0, 50000);
      const truncated = buffer.length > 50000;

      res.json({
        success: true,
        filename: backup.filename,
        size: backup.size,
        content,
        truncated,
      });
    } catch (e) {
      console.error("Error viewing backup:", e);
      res.status(500).json({ error: "Erro ao visualizar arquivo" });
    }
  });

  app.delete('/api/backups/:id', isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const backup = await storage.getBackup(id);

    if (!backup) return res.status(404).json({ message: "Backup não encontrado" });

    const { objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    const bucket = objectStorageClient.bucket(bucketId!);
    const file = bucket.file(backup.objectName);

    try {
      await file.delete();
    } catch (e) {
      console.warn("Falha ao deletar do storage:", e);
    }

    await storage.deleteBackup(id);
    res.sendStatus(204);
  });

  // API - Executar Backup via SSH
  app.post('/api/backup/execute/:equipmentId', isAuthenticated, async (req, res) => {
    const equipmentId = parseInt(req.params.equipmentId);
    const equip = await storage.getEquipmentById(equipmentId);

    if (!equip) return res.status(404).json({ message: "Equipamento não encontrado" });
    if (!equip.enabled) return res.status(400).json({ message: "Equipamento desabilitado" });

    const user = req.user as any;
    const userSub = user?.claims?.sub;
    const userId = userSub ? await storage.getUserIdByReplitId(userSub) : null;

    const startTime = Date.now();
    const historyRecord = await storage.createBackupHistory({
      equipmentId: equip.id,
      equipmentName: equip.name,
      manufacturer: equip.manufacturer,
      ip: equip.ip,
      status: "running",
      executedBy: userId,
    });

    try {
      const config = await getBackupConfig(equip.manufacturer);
      const result = await executeSSHBackup(equip, config);

      const { objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (!bucketId) throw new Error("Bucket não configurado");

      const filename = `${equip.name}_${Date.now()}${config.extension}`;
      const objectName = `backups/${equip.manufacturer}/${equip.name}/${filename}`;
      const bucket = objectStorageClient.bucket(bucketId);
      const file = bucket.file(objectName);

      await file.save(Buffer.from(result), { contentType: 'text/plain' });

      const fileRecord = await storage.createBackup({
        userId: userId || 1,
        equipmentId: equip.id,
        filename,
        objectName,
        size: result.length,
        mimeType: 'text/plain',
        status: "success",
      });

      const duration = (Date.now() - startTime) / 1000;
      await storage.updateBackupHistory(historyRecord.id, {
        status: "success",
        duration,
        fileId: fileRecord.id,
      });

      res.json({ success: true, backup: fileRecord, duration });
    } catch (e: any) {
      console.error("Erro backup SSH:", e);
      const duration = (Date.now() - startTime) / 1000;
      
      await storage.updateBackupHistory(historyRecord.id, {
        status: "failed",
        duration,
        errorMessage: e.message,
      });

      res.status(500).json({ success: false, error: e.message });
    }
  });

  // API - Histórico de backups
  app.get('/api/backup-history', isAuthenticated, async (req, res) => {
    try {
      const history = await storage.getBackupHistory();
      res.json({ success: true, history });
    } catch (e) {
      console.error("Error getting backup history:", e);
      res.status(500).json({ success: false, error: "Erro ao obter histórico" });
    }
  });

  // API - Configurações
  app.get('/api/settings', isAuthenticated, async (req, res) => {
    try {
      const allSettings = await storage.getAllSettings();
      const settingsObj = Object.fromEntries(allSettings.map(s => [s.key, s.value]));
      res.json(settingsObj);
    } catch (e) {
      console.error("Error getting settings:", e);
      res.status(500).json({ message: "Erro ao obter configurações" });
    }
  });

  app.post('/api/settings', isAuthenticated, async (req, res) => {
    try {
      const { key, value } = req.body;
      if (!key || value === undefined) {
        return res.status(400).json({ message: "key e value são obrigatórios" });
      }
      await storage.setSetting(key, value);
      res.json({ success: true });
    } catch (e) {
      console.error("Error setting:", e);
      res.status(500).json({ message: "Erro ao salvar configuração" });
    }
  });

  // API - Scripts de Backup por Fabricante
  app.get('/api/scripts', isAuthenticated, async (req, res) => {
    try {
      await storage.seedDefaultScripts();
      const scripts = await storage.getVendorScripts();
      res.json(scripts);
    } catch (e) {
      console.error("Error getting scripts:", e);
      res.status(500).json({ message: "Erro ao obter scripts" });
    }
  });

  app.get('/api/scripts/:manufacturer', isAuthenticated, async (req, res) => {
    try {
      const script = await storage.getVendorScript(req.params.manufacturer);
      if (!script) {
        const defaultInfo = getDefaultScriptInfo(req.params.manufacturer);
        if (defaultInfo) {
          return res.json({
            manufacturer: req.params.manufacturer,
            command: defaultInfo.command,
            description: defaultInfo.description,
            fileExtension: defaultInfo.extension,
            useShell: defaultInfo.useShell,
            timeout: defaultInfo.timeout,
            isDefault: true,
          });
        }
        return res.json({
          manufacturer: req.params.manufacturer,
          command: 'show running-config',
          description: 'Script padrao generico. Conexao via SSH usando credenciais do equipamento.',
          fileExtension: '.txt',
          useShell: false,
          timeout: 30000,
          isDefault: true,
        });
      }
      res.json(script);
    } catch (e) {
      console.error("Error getting script:", e);
      res.status(500).json({ message: "Erro ao obter script" });
    }
  });

  app.post('/api/scripts', isAuthenticated, async (req, res) => {
    try {
      const parsed = insertVendorScriptSchema.parse(req.body);
      const script = await storage.upsertVendorScript(parsed);
      res.status(201).json(script);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: e.errors });
      }
      console.error("Error saving script:", e);
      res.status(500).json({ message: "Erro ao salvar script" });
    }
  });

  app.delete('/api/scripts/:manufacturer', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteVendorScript(req.params.manufacturer);
      res.sendStatus(204);
    } catch (e) {
      console.error("Error setting:", e);
      res.status(500).json({ message: "Erro ao salvar configuração" });
    }
  });

  // API - Fabricantes
  app.get('/api/manufacturers', isAuthenticated, async (req, res) => {
    try {
      await storage.seedManufacturers();
      const mfrs = await storage.getManufacturers();
      res.json(mfrs);
    } catch (e) {
      console.error("Error getting manufacturers:", e);
      res.status(500).json({ message: "Erro ao obter fabricantes" });
    }
  });

  app.post('/api/manufacturers', isAuthenticated, async (req, res) => {
    try {
      const { value, label, color } = req.body;
      if (!value || !label) {
        return res.status(400).json({ message: "value e label sao obrigatorios" });
      }
      const mfr = await storage.createManufacturer({ value, label, color });
      res.status(201).json(mfr);
    } catch (e: any) {
      if (e.code === '23505') {
        return res.status(400).json({ message: "Fabricante ja existe" });
      }
      console.error("Error creating manufacturer:", e);
      res.status(500).json({ message: "Erro ao criar fabricante" });
    }
  });

  app.patch('/api/manufacturers/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { label, color } = req.body;
      const mfr = await storage.updateManufacturer(id, { label, color });
      if (!mfr) return res.status(404).json({ message: "Fabricante nao encontrado" });
      res.json(mfr);
    } catch (e) {
      console.error("Error updating manufacturer:", e);
      res.status(500).json({ message: "Erro ao atualizar fabricante" });
    }
  });

  app.delete('/api/manufacturers/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteManufacturer(id);
      res.sendStatus(204);
    } catch (e) {
      console.error("Error deleting manufacturer:", e);
      res.status(500).json({ message: "Erro ao excluir fabricante" });
    }
  });

  // API - Stats
  app.get('/api/stats', isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (e) {
      console.error("Error getting stats:", e);
      res.status(500).json({ message: "Erro ao obter estatísticas" });
    }
  });

  // API - Admin - System Info
  app.get('/api/admin/system-info', isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getStats();
      const scripts = await storage.getVendorScripts();
      res.json({
        version: process.env.APP_VERSION || '1.0.0',
        dbSize: 'N/A',
        totalEquipment: stats.totalEquipment,
        totalBackups: stats.totalBackups,
        totalScripts: scripts.length,
        lastBackup: null,
      });
    } catch (e) {
      console.error("Error getting system info:", e);
      res.status(500).json({ message: "Erro ao obter informacoes do sistema" });
    }
  });

  // API - Admin - System Updates
  app.get('/api/admin/updates', isAuthenticated, async (req, res) => {
    try {
      const updates = await storage.getSystemUpdates();
      res.json(updates);
    } catch (e) {
      console.error("Error getting updates:", e);
      res.status(500).json({ message: "Erro ao obter atualizacoes" });
    }
  });

  app.post('/api/admin/apply-patch', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const parsed = insertSystemUpdateSchema.parse({
        ...req.body,
        appliedBy: user?.claims?.sub || user?.name || 'Admin',
      });
      const update = await storage.createSystemUpdate(parsed);
      res.status(201).json(update);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados invalidos", errors: e.errors });
      }
      console.error("Error applying patch:", e);
      res.status(500).json({ message: "Erro ao aplicar atualizacao" });
    }
  });

  app.post('/api/admin/upload-patch', isAuthenticated, upload.single('file'), async (req, res) => {
    try {
      const user = req.user as any;
      const uploadedFile = req.file;
      if (!uploadedFile) {
        return res.status(400).json({ message: "Arquivo e obrigatorio" });
      }
      const { version, description } = req.body;
      if (!version || !description) {
        return res.status(400).json({ message: "Versao e descricao sao obrigatorios" });
      }
      const { objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (!bucketId) {
        return res.status(500).json({ message: "Object Storage nao configurado" });
      }
      const timestamp = Date.now();
      const objectName = `patches/${timestamp}-${uploadedFile.originalname}`;
      const bucket = objectStorageClient.bucket(bucketId);
      const file = bucket.file(objectName);
      await file.save(uploadedFile.buffer, {
        contentType: uploadedFile.mimetype,
        metadata: { version, uploadedBy: user?.name || 'Admin' },
      });
      const update = await storage.createSystemUpdate({
        version,
        description,
        filename: uploadedFile.originalname,
        objectName,
        size: uploadedFile.size,
        appliedBy: user?.claims?.sub || user?.name || 'Admin',
      });
      res.status(201).json(update);
    } catch (e) {
      console.error("Error uploading patch:", e);
      res.status(500).json({ message: "Erro ao fazer upload do patch" });
    }
  });

  app.get('/api/admin/download-patch/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = await storage.getSystemUpdates();
      const update = updates.find((u: any) => u.id === id);
      if (!update || !update.objectName) {
        return res.status(404).json({ message: "Patch nao encontrado" });
      }
      const { objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (!bucketId) {
        return res.status(500).json({ message: "Object Storage nao configurado" });
      }
      const bucket = objectStorageClient.bucket(bucketId);
      const file = bucket.file(update.objectName);
      const [buffer] = await file.download();
      res.setHeader('Content-Disposition', `attachment; filename="${update.filename || 'patch.zip'}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.send(buffer);
    } catch (e) {
      console.error("Error downloading patch:", e);
      res.status(500).json({ message: "Erro ao baixar patch" });
    }
  });

  // API - Admin - Export Database
  app.post('/api/admin/export-database', isAuthenticated, async (req, res) => {
    try {
      const equipment = await storage.getEquipment();
      const backups = await storage.getBackups();
      const scripts = await storage.getVendorScripts();
      const manufacturers = await storage.getManufacturers();
      const updates = await storage.getSystemUpdates();

      const exportData = {
        exportedAt: new Date().toISOString(),
        version: process.env.APP_VERSION || '1.0.0',
        data: {
          equipment,
          backups,
          scripts,
          manufacturers,
          updates,
        }
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="nbm-database-backup.json"');
      res.json(exportData);
    } catch (e) {
      console.error("Error exporting database:", e);
      res.status(500).json({ message: "Erro ao exportar banco de dados" });
    }
  });

  // API - Admin - Export Full System
  app.post('/api/admin/export-full', isAuthenticated, async (req, res) => {
    try {
      const equipment = await storage.getEquipment();
      const backups = await storage.getBackups();
      const scripts = await storage.getVendorScripts();
      const manufacturers = await storage.getManufacturers();
      const updates = await storage.getSystemUpdates();
      const settings = await storage.getAllSettings();

      const exportData = {
        exportedAt: new Date().toISOString(),
        version: process.env.APP_VERSION || '1.0.0',
        type: 'full-backup',
        data: {
          equipment,
          backups,
          scripts,
          manufacturers,
          updates,
          settings,
        }
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="nbm-full-backup.json"');
      res.json(exportData);
    } catch (e) {
      console.error("Error exporting full backup:", e);
      res.status(500).json({ message: "Erro ao exportar backup completo" });
    }
  });

  // API - Admin - Import Database
  app.post('/api/admin/import-database', isAuthenticated, upload.single('backup'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo enviado" });
      }

      const content = req.file.buffer.toString('utf-8');
      const importData = JSON.parse(content);

      if (!importData.data) {
        return res.status(400).json({ message: "Formato de backup invalido" });
      }

      await storage.importData(importData.data);

      res.json({ message: "Backup restaurado com sucesso", importedAt: new Date().toISOString() });
    } catch (e) {
      console.error("Error importing database:", e);
      res.status(500).json({ message: "Erro ao importar banco de dados" });
    }
  });

  // API - Admin - User Management (admin only)
  app.get('/api/admin/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const usersList = await storage.getUsers();
      res.json(usersList);
    } catch (e) {
      console.error("Error listing users:", e);
      res.status(500).json({ message: "Erro ao listar usuarios" });
    }
  });

  app.post('/api/admin/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { username, name, email, role, active } = req.body;
      if (!username) {
        return res.status(400).json({ message: "Nome de usuario e obrigatorio" });
      }
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(409).json({ message: "Nome de usuario ja existe" });
      }
      const created = await storage.createUser({
        username,
        name: name || undefined,
        email: email || undefined,
        role: role || 'viewer',
        active: active !== false,
      });
      res.status(201).json(created);
    } catch (e) {
      console.error("Error creating user:", e);
      res.status(500).json({ message: "Erro ao criar usuario" });
    }
  });

  app.put('/api/admin/users/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const parsed = updateUserSchema.parse(req.body);
      const updated = await storage.updateUser(id, parsed);
      if (!updated) return res.status(404).json({ message: "Usuario nao encontrado" });
      res.json(updated);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados invalidos", errors: e.errors });
      }
      console.error("Error updating user:", e);
      res.status(500).json({ message: "Erro ao atualizar usuario" });
    }
  });

  app.delete('/api/admin/users/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUserById(id);
      if (!user) return res.status(404).json({ message: "Usuario nao encontrado" });
      await storage.deleteUser(id);
      res.json({ message: "Usuario excluido com sucesso" });
    } catch (e) {
      console.error("Error deleting user:", e);
      res.status(500).json({ message: "Erro ao excluir usuario" });
    }
  });

  // API - Admin - Settings (customization)
  app.get('/api/admin/customization', isAuthenticated, async (req, res) => {
    try {
      const logoUrl = await storage.getSetting('logo_url');
      const primaryColor = await storage.getSetting('primary_color');
      const systemName = await storage.getSetting('system_name');
      const serverIp = await storage.getSetting('server_ip');
      res.json({
        logoUrl: logoUrl || '',
        primaryColor: primaryColor || '#0077b6',
        systemName: systemName || 'NBM',
        serverIp: serverIp || '',
      });
    } catch (e) {
      console.error("Error getting customization:", e);
      res.status(500).json({ message: "Erro ao obter personalizacao" });
    }
  });

  app.post('/api/admin/customization', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const parsed = customizationSchema.parse(req.body);
      if (parsed.logoUrl !== undefined) await storage.setSetting('logo_url', parsed.logoUrl);
      if (parsed.primaryColor !== undefined) await storage.setSetting('primary_color', parsed.primaryColor);
      if (parsed.systemName !== undefined) await storage.setSetting('system_name', parsed.systemName);
      if (parsed.serverIp !== undefined) await storage.setSetting('server_ip', parsed.serverIp);
      res.json({ message: "Personalizacao salva com sucesso" });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados invalidos", errors: e.errors });
      }
      console.error("Error saving customization:", e);
      res.status(500).json({ message: "Erro ao salvar personalizacao" });
    }
  });

  // API - Firmware
  app.get('/api/firmware', isAuthenticated, async (req, res) => {
    try {
      const firmwareList = await storage.getFirmware();
      res.json(firmwareList);
    } catch (e) {
      console.error("Error listing firmware:", e);
      res.status(500).json({ message: "Erro ao listar firmware" });
    }
  });

  const firmwareBodySchema = z.object({
    name: z.string().optional(),
    manufacturer: z.string().min(1, "Fabricante obrigatorio"),
    model: z.string().optional().nullable(),
    version: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
  });

  app.post('/api/firmware', isAuthenticated, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo enviado" });
      }

      const parsed = firmwareBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Dados invalidos", errors: parsed.error.errors });
      }

      const { name, manufacturer, model, version, description } = parsed.data;

      const user = req.user as any;
      const userSub = user?.claims?.sub;
      const userId = userSub ? await storage.getUserIdByReplitId(userSub) : null;

      const { objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (!bucketId) return res.status(500).json({ message: "Bucket nao configurado" });

      const objectName = `firmware/${Date.now()}-${req.file.originalname}`;
      const bucket = objectStorageClient.bucket(bucketId);
      const file = bucket.file(objectName);

      await file.save(req.file.buffer, {
        contentType: req.file.mimetype || 'application/octet-stream',
      });

      const fw = await storage.createFirmware({
        name: name || req.file.originalname,
        manufacturer,
        model: model || null,
        version: version || null,
        filename: req.file.originalname,
        objectName,
        size: req.file.size,
        description: description || null,
        uploadedBy: userId,
      });

      res.status(201).json(fw);
    } catch (e) {
      console.error("Error uploading firmware:", e);
      res.status(500).json({ message: "Erro ao fazer upload do firmware" });
    }
  });

  app.delete('/api/firmware/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const fw = await storage.getFirmwareById(id);
      if (!fw) return res.status(404).json({ message: "Firmware nao encontrado" });

      const { objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (bucketId && fw.objectName) {
        try {
          const bucket = objectStorageClient.bucket(bucketId);
          await bucket.file(fw.objectName).delete();
        } catch (e) {
          console.error("Error deleting firmware file:", e);
        }
      }

      await storage.deleteFirmware(id);
      res.sendStatus(204);
    } catch (e) {
      console.error("Error deleting firmware:", e);
      res.status(500).json({ message: "Erro ao excluir firmware" });
    }
  });

  app.get('/api/firmware/:id/download', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const fw = await storage.getFirmwareById(id);
      if (!fw) return res.status(404).json({ message: "Firmware nao encontrado" });

      const { objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (!bucketId) return res.status(500).json({ message: "Bucket nao configurado" });

      const bucket = objectStorageClient.bucket(bucketId);
      const file = bucket.file(fw.objectName);
      const [buffer] = await file.download();

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${fw.filename}"`);
      res.send(buffer);
    } catch (e) {
      console.error("Error downloading firmware:", e);
      res.status(500).json({ message: "Erro ao baixar firmware" });
    }
  });

  // WebSocket Terminal Server with authentication
  const wss = new WebSocketServer({ noServer: true });
  const sessionParser = getSession();
  
  httpServer.on('upgrade', (request: any, socket: any, head: any) => {
    if (request.url !== '/ws/terminal') {
      return; // Let other handlers deal with non-terminal upgrades
    }
    
    // Use session parser to validate the session
    sessionParser(request, {} as any, async () => {
      try {
        // Check if session has passport user
        const passport = request.session?.passport;
        if (!passport?.user?.claims?.sub) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
        
        // Verify user role (admin or operator only)
        const { db } = await import("./db");
        const { users } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");
        
        const [dbUser] = await db.select().from(users).where(eq(users.replitId, passport.user.claims.sub));
        if (!dbUser || (dbUser.role !== 'admin' && dbUser.role !== 'operator' && !dbUser.isAdmin)) {
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          socket.destroy();
          return;
        }
        
        // User authenticated and authorized - proceed with WebSocket upgrade
        wss.handleUpgrade(request, socket, head, (ws) => {
          (ws as any).userId = dbUser.id;
          (ws as any).userRole = dbUser.role;
          wss.emit('connection', ws, request);
        });
      } catch (e) {
        console.error('WebSocket auth error:', e);
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
      }
    });
  });
  
  wss.on('connection', (ws: WebSocket) => {
    let sshClient: SSHClient | null = null;
    let telnetSocket: net.Socket | null = null;
    let stream: any = null;
    
    ws.on('message', async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'connect') {
          const { equipmentId } = data;
          const equip = await storage.getEquipmentById(equipmentId);
          
          if (!equip) {
            ws.send(JSON.stringify({ type: 'error', message: 'Equipamento nao encontrado' }));
            return;
          }
          
          if (!equip.username || !equip.password) {
            ws.send(JSON.stringify({ type: 'error', message: 'Credenciais nao configuradas' }));
            return;
          }
          
          ws.send(JSON.stringify({ type: 'status', message: `Conectando a ${equip.name} (${equip.ip})...` }));
          
          if (equip.protocol === 'telnet') {
            // Telnet connection
            telnetSocket = new net.Socket();
            
            telnetSocket.connect(equip.port || 23, equip.ip, () => {
              ws.send(JSON.stringify({ type: 'connected', protocol: 'telnet' }));
            });
            
            telnetSocket.on('data', (data) => {
              ws.send(JSON.stringify({ type: 'output', data: data.toString() }));
            });
            
            telnetSocket.on('error', (err) => {
              ws.send(JSON.stringify({ type: 'error', message: `Erro Telnet: ${err.message}` }));
            });
            
            telnetSocket.on('close', () => {
              ws.send(JSON.stringify({ type: 'disconnected' }));
            });
            
            // Send credentials after connection
            setTimeout(() => {
              if (telnetSocket && equip.username) {
                telnetSocket.write(equip.username + '\n');
                setTimeout(() => {
                  if (telnetSocket && equip.password) {
                    telnetSocket.write(equip.password + '\n');
                  }
                }, 1000);
              }
            }, 500);
            
          } else {
            // SSH connection
            sshClient = new SSHClient();
            
            sshClient.on('ready', () => {
              sshClient!.shell((err, shellStream) => {
                if (err) {
                  ws.send(JSON.stringify({ type: 'error', message: `Erro ao abrir shell: ${err.message}` }));
                  return;
                }
                
                stream = shellStream;
                ws.send(JSON.stringify({ type: 'connected', protocol: 'ssh' }));
                
                shellStream.on('data', (data: Buffer) => {
                  ws.send(JSON.stringify({ type: 'output', data: data.toString() }));
                });
                
                shellStream.on('close', () => {
                  ws.send(JSON.stringify({ type: 'disconnected' }));
                  sshClient?.end();
                });
              });
            });
            
            sshClient.on('error', (err) => {
              ws.send(JSON.stringify({ type: 'error', message: `Erro SSH: ${err.message}` }));
            });
            
            sshClient.connect({
              host: equip.ip,
              port: equip.port || 22,
              username: equip.username,
              password: equip.password,
              readyTimeout: 10000,
              algorithms: {
                kex: ['diffie-hellman-group14-sha1', 'diffie-hellman-group-exchange-sha256', 'ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521'],
                cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-cbc', 'aes256-cbc', '3des-cbc'],
                hmac: ['hmac-sha2-256', 'hmac-sha2-512', 'hmac-sha1'],
              },
            });
          }
          
        } else if (data.type === 'input') {
          // Send command to connected device
          if (stream) {
            stream.write(data.command);
          } else if (telnetSocket) {
            telnetSocket.write(data.command);
          }
          
        } else if (data.type === 'disconnect') {
          if (stream) {
            stream.end();
            stream = null;
          }
          if (sshClient) {
            sshClient.end();
            sshClient = null;
          }
          if (telnetSocket) {
            telnetSocket.destroy();
            telnetSocket = null;
          }
        }
      } catch (e) {
        console.error('WebSocket message error:', e);
        ws.send(JSON.stringify({ type: 'error', message: 'Erro ao processar mensagem' }));
      }
    });
    
    ws.on('close', () => {
      if (stream) stream.end();
      if (sshClient) sshClient.end();
      if (telnetSocket) telnetSocket.destroy();
    });
  });

  return httpServer;
}

// Configuração de backup por fabricante
interface BackupConfig {
  command: string;
  extension: string;
  useShell: boolean;
  timeout?: number;
  prompt?: RegExp;
  endPattern?: RegExp;
}

async function getBackupConfig(manufacturer: string): Promise<BackupConfig> {
  const storedScript = await storage.getVendorScript(manufacturer);
  if (storedScript) {
    return {
      command: storedScript.command,
      extension: storedScript.fileExtension || '.cfg',
      useShell: storedScript.useShell ?? true,
      timeout: storedScript.timeout || 30000,
    };
  }
  return getDefaultBackupConfig(manufacturer);
}

interface VendorDefaultScript {
  command: string;
  extension: string;
  useShell: boolean;
  timeout: number;
  description: string;
  prompt?: RegExp;
  endPattern?: RegExp;
}

const DEFAULT_VENDOR_SCRIPTS: Record<string, VendorDefaultScript> = {
  mikrotik: {
    command: '/export compact',
    extension: '.rsc',
    useShell: true,
    timeout: 30000,
    description: 'Exporta configuracao completa do RouterOS em formato RSC. Conexao via SSH usando credenciais do equipamento (usuario, senha, porta do cadastro).',
    prompt: /\[.*@.*\]\s*>\s*$/,
    endPattern: /\[.*@.*\]\s*>\s*$/,
  },
  huawei: {
    command: 'screen-length 0 temporary\ndisplay current-configuration',
    extension: '.cfg',
    useShell: true,
    timeout: 60000,
    description: 'Desabilita paginacao e exporta configuracao atual. Conexao via SSH usando credenciais do equipamento (usuario, senha, porta do cadastro).',
    prompt: /<.*>|\[.*\]/,
    endPattern: /return/,
  },
  cisco: {
    command: 'terminal length 0\nshow running-config',
    extension: '.cfg',
    useShell: true,
    timeout: 60000,
    description: 'Desabilita paginacao e exibe configuracao em execucao. Conexao via SSH usando credenciais do equipamento (usuario, senha, porta do cadastro).',
    prompt: /[#>]\s*$/,
  },
  nokia: {
    command: 'environment no more\nadmin display-config',
    extension: '.cfg',
    useShell: true,
    timeout: 60000,
    description: 'Desabilita paginacao e exibe configuracao administrativa. Conexao via SSH usando credenciais do equipamento (usuario, senha, porta do cadastro).',
    prompt: /[#>]\s*$/,
  },
  zte: {
    command: 'terminal length 0\nshow running-config',
    extension: '.cfg',
    useShell: true,
    timeout: 60000,
    description: 'Desabilita paginacao e exibe configuracao em execucao. Conexao via SSH usando credenciais do equipamento (usuario, senha, porta do cadastro).',
    prompt: /[#>]\s*$/,
  },
  datacom: {
    command: 'terminal length 0\nshow running-config',
    extension: '.cfg',
    useShell: true,
    timeout: 60000,
    description: 'Desabilita paginacao e exibe configuracao em execucao DmOS. Conexao via SSH usando credenciais do equipamento (usuario, senha, porta do cadastro).',
    prompt: /[#>]\s*$/,
  },
  'datacom-dmos': {
    command: 'terminal length 0\nshow running-config',
    extension: '.cfg',
    useShell: true,
    timeout: 60000,
    description: 'Desabilita paginacao e exibe configuracao DmOS. Conexao via SSH usando credenciais do equipamento (usuario, senha, porta do cadastro).',
    prompt: /[#>]\s*$/,
  },
  juniper: {
    command: 'set cli screen-length 0\nshow configuration | display set',
    extension: '.conf',
    useShell: true,
    timeout: 60000,
    description: 'Desabilita paginacao e exibe configuracao em formato set. Conexao via SSH usando credenciais do equipamento (usuario, senha, porta do cadastro).',
    prompt: /[#>]\s*$/,
  },
};

function getDefaultBackupConfig(manufacturer: string): BackupConfig {
  const config = DEFAULT_VENDOR_SCRIPTS[manufacturer.toLowerCase()];
  if (config) {
    return {
      command: config.command,
      extension: config.extension,
      useShell: config.useShell,
      timeout: config.timeout,
      prompt: config.prompt,
      endPattern: config.endPattern,
    };
  }
  return {
    command: 'show running-config',
    extension: '.txt',
    useShell: false,
    timeout: 30000,
  };
}

function getDefaultScriptInfo(manufacturer: string): VendorDefaultScript | null {
  return DEFAULT_VENDOR_SCRIPTS[manufacturer.toLowerCase()] || null;
}

// Execução SSH com suporte a shell interativo
async function executeSSHBackup(equip: any, config: BackupConfig): Promise<string> {
  const { Client } = await import("ssh2");

  return new Promise((resolve, reject) => {
    const conn = new Client();
    let output = '';
    let timer: NodeJS.Timeout;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      conn.end();
    };

    conn.on('ready', () => {
      if (config.useShell) {
        conn.shell((err, stream) => {
          if (err) {
            cleanup();
            return reject(err);
          }

          timer = setTimeout(() => {
            cleanup();
            resolve(output);
          }, config.timeout || 30000);

          stream.on('data', (data: Buffer) => {
            output += data.toString();
            
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
              cleanup();
              resolve(output);
            }, 5000);
          });

          stream.on('close', () => {
            cleanup();
            resolve(output);
          });

          stream.stderr.on('data', (data: Buffer) => {
            output += data.toString();
          });

          setTimeout(() => {
            stream.write(config.command + '\n');
          }, 500);
        });
      } else {
        conn.exec(config.command, (err, stream) => {
          if (err) {
            cleanup();
            return reject(err);
          }

          stream.on('data', (data: Buffer) => {
            output += data.toString();
          });

          stream.on('close', () => {
            cleanup();
            resolve(output);
          });

          stream.stderr.on('data', (data: Buffer) => {
            output += data.toString();
          });
        });
      }
    });

    conn.on('error', (err) => {
      cleanup();
      reject(err);
    });

    conn.connect({
      host: equip.ip,
      port: equip.port || 22,
      username: equip.username,
      password: equip.password,
      readyTimeout: 30000,
      algorithms: {
        kex: [
          'ecdh-sha2-nistp256',
          'ecdh-sha2-nistp384',
          'ecdh-sha2-nistp521',
          'diffie-hellman-group-exchange-sha256',
          'diffie-hellman-group14-sha256',
          'diffie-hellman-group14-sha1',
          'diffie-hellman-group1-sha1',
        ],
        cipher: [
          'aes128-ctr',
          'aes192-ctr',
          'aes256-ctr',
          'aes128-gcm@openssh.com',
          'aes256-gcm@openssh.com',
          'aes256-cbc',
          'aes128-cbc',
          '3des-cbc',
        ],
      },
    });
  });
}
