import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Replit Auth
  await setupAuth(app);
  registerAuthRoutes(app);

  // API - Equipamentos
  app.get('/api/equipment', isAuthenticated, async (req, res) => {
    try {
      const equipmentList = await storage.getEquipment();
      res.json(equipmentList);
    } catch (e) {
      console.error("Error listing equipment:", e);
      res.status(500).json({ message: "Erro ao listar equipamentos" });
    }
  });

  app.post('/api/equipment', isAuthenticated, async (req, res) => {
    try {
      const equipment = await storage.createEquipment(req.body);
      res.status(201).json(equipment);
    } catch (e) {
      console.error("Error creating equipment:", e);
      res.status(500).json({ message: "Erro ao criar equipamento" });
    }
  });

  app.put('/api/equipment/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const equipment = await storage.updateEquipment(id, req.body);
      if (!equipment) return res.status(404).json({ message: "Equipamento não encontrado" });
      res.json(equipment);
    } catch (e) {
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
      res.json({ success: true, total: backups.length, backups });
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

    try {
      const config = getBackupCommand(equip.manufacturer);
      const result = await executeSSHCommand(equip, config.command);

      const user = req.user as any;
      const userSub = user?.claims?.sub;
      const userId = userSub ? await storage.getUserIdByReplitId(userSub) : null;

      const { objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (!bucketId) return res.status(500).json({ message: "Bucket não configurado" });

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

      res.json({ success: true, backup: fileRecord });
    } catch (e: any) {
      console.error("Erro backup SSH:", e);
      res.status(500).json({ success: false, error: e.message });
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

  return httpServer;
}

// Helpers para comandos de backup por fabricante
function getBackupCommand(manufacturer: string): { command: string; extension: string } {
  const commands: Record<string, { command: string; extension: string }> = {
    mikrotik: { command: '/export', extension: '.rsc' },
    huawei: { command: 'display current-configuration', extension: '.cfg' },
    cisco: { command: 'show running-config', extension: '.cfg' },
    nokia: { command: 'admin display-config', extension: '.cfg' },
    zte: { command: 'show running-config', extension: '.cfg' },
    datacom: { command: 'show running-config', extension: '.cfg' },
    'datacom-dmos': { command: 'show running-config', extension: '.cfg' },
    juniper: { command: 'show configuration', extension: '.conf' },
  };
  return commands[manufacturer.toLowerCase()] || { command: 'show running-config', extension: '.txt' };
}

// Execução SSH
async function executeSSHCommand(equip: any, command: string): Promise<string> {
  const { Client } = await import("ssh2");

  return new Promise((resolve, reject) => {
    const conn = new Client();
    let output = '';

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          conn.end();
          return reject(err);
        }

        stream.on('data', (data: Buffer) => {
          output += data.toString();
        });

        stream.on('close', () => {
          conn.end();
          resolve(output);
        });

        stream.stderr.on('data', (data: Buffer) => {
          output += data.toString();
        });
      });
    });

    conn.on('error', (err) => {
      reject(err);
    });

    conn.connect({
      host: equip.ip,
      port: equip.port || 22,
      username: equip.username,
      password: equip.password,
      readyTimeout: 30000,
    });
  });
}
