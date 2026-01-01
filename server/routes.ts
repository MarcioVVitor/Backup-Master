import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import { insertEquipmentSchema, insertVendorScriptSchema, SUPPORTED_MANUFACTURERS } from "@shared/schema";
import { z } from "zod";

const upload = multer({ storage: multer.memoryStorage() });

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
        const defaultConfig = getDefaultBackupConfig(req.params.manufacturer);
        return res.json({
          manufacturer: req.params.manufacturer,
          command: defaultConfig.command,
          description: `Script padrão para ${req.params.manufacturer}`,
          fileExtension: defaultConfig.extension,
          useShell: defaultConfig.useShell,
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

function getDefaultBackupConfig(manufacturer: string): BackupConfig {
  const configs: Record<string, BackupConfig> = {
    mikrotik: {
      command: '/export',
      extension: '.rsc',
      useShell: true,
      prompt: /\[.*@.*\]\s*>\s*$/,
      endPattern: /\[.*@.*\]\s*>\s*$/,
    },
    huawei: {
      command: 'display current-configuration',
      extension: '.cfg',
      useShell: true,
      prompt: /<.*>|\[.*\]/,
      endPattern: /return/,
    },
    cisco: {
      command: 'show running-config',
      extension: '.cfg',
      useShell: true,
      prompt: /[#>]\s*$/,
    },
    nokia: {
      command: 'admin display-config',
      extension: '.cfg',
      useShell: true,
      prompt: /[#>]\s*$/,
    },
    zte: {
      command: 'show running-config',
      extension: '.cfg',
      useShell: true,
      prompt: /[#>]\s*$/,
    },
    datacom: {
      command: 'show running-config',
      extension: '.cfg',
      useShell: true,
      prompt: /[#>]\s*$/,
    },
    'datacom-dmos': {
      command: 'show running-config',
      extension: '.cfg',
      useShell: true,
      prompt: /[#>]\s*$/,
    },
    juniper: {
      command: 'show configuration | display set',
      extension: '.conf',
      useShell: true,
      prompt: /[#>]\s*$/,
    },
  };
  return configs[manufacturer.toLowerCase()] || {
    command: 'show running-config',
    extension: '.txt',
    useShell: false,
  };
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
          }, 30000);

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
