import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { insertEquipmentSchema, insertVendorScriptSchema, updateVendorScriptSchema, insertSystemUpdateSchema, insertFirmwareSchema, insertBackupPolicySchema, updateBackupPolicySchema, SUPPORTED_MANUFACTURERS, USER_ROLES } from "@shared/schema";
import { z } from "zod";
import { WebSocketServer, WebSocket } from "ws";
import { Client as SSHClient } from "ssh2";
import net from "net";
import { createServerRoutes } from "./routes/server-routes";
import { withTenantContext } from "./middleware/tenant";

const isStandalone = !process.env.REPL_ID;

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
    if (isStandalone) {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser?.isAdmin) {
        return res.status(403).json({ message: "Apenas administradores podem acessar este recurso" });
      }
      return next();
    }
    
    const user = req.user as any;
    const userSub = user?.claims?.sub;
    if (!userSub) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    const { db } = await import("./db");
    const { users, serverAdmins } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [dbUser] = await db.select().from(users).where(eq(users.replitId, userSub));
    if (!dbUser) {
      return res.status(403).json({ message: "Usuário não encontrado" });
    }
    
    // Check if user is server admin
    const [serverAdmin] = await db.select().from(serverAdmins).where(eq(serverAdmins.userId, dbUser.id));
    
    // Allow if: company admin, global admin, or server admin
    if (dbUser.role !== 'admin' && !dbUser.isAdmin && !serverAdmin) {
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
  let isAuthenticated: any;
  let getSession: any;
  
  if (isStandalone) {
    const standaloneAuth = await import("./standalone-auth");
    getSession = standaloneAuth.getSession;
    app.use(getSession());
    await standaloneAuth.setupStandaloneAuth(app);
    isAuthenticated = standaloneAuth.isAuthenticated;
  } else {
    const replitAuth = await import("./replit_integrations/auth");
    getSession = replitAuth.getSession;
    await replitAuth.setupAuth(app);
    replitAuth.registerAuthRoutes(app);
    isAuthenticated = replitAuth.isAuthenticated;
  }

  app.get('/api/auth/mode', (req, res) => {
    res.json({ standalone: isStandalone });
  });

  // Diagnostic endpoint to check session state
  app.get('/api/debug/session', (req, res) => {
    const user = req.user as any;
    res.json({
      hasCookie: !!req.headers.cookie,
      sessionId: req.sessionID?.substring(0, 8) + '...',
      isAuthenticated: req.isAuthenticated?.() || false,
      hasUser: !!user,
      userSub: user?.claims?.sub || null,
      expiresAt: user?.expires_at || null,
      nodeEnv: process.env.NODE_ENV,
    });
  });

  // Serve agent installation script
  app.get('/install/agent.sh', async (req, res) => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const scriptPath = path.join(process.cwd(), 'agent', 'scripts', 'install.sh');
      if (fs.existsSync(scriptPath)) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="install.sh"');
        const content = fs.readFileSync(scriptPath, 'utf-8');
        res.send(content);
      } else {
        res.status(404).send('Script not found');
      }
    } catch (e) {
      console.error('Error serving agent script:', e);
      res.status(500).send('Error');
    }
  });

  app.use(withTenantContext);

  const serverRoutes = createServerRoutes(isAuthenticated);
  app.use("/api/server", serverRoutes);

  const sanitizeEquipment = (equip: any) => {
    const { password, ...rest } = equip;
    return rest;
  };

  // API - Fabricantes suportados
  app.get('/api/manufacturers', isAuthenticated, (req, res) => {
    res.json(SUPPORTED_MANUFACTURERS);
  });

  // API - Equipamentos (tenant-scoped)
  app.get('/api/equipment', isAuthenticated, async (req, res) => {
    try {
      const companyId = req.companyId;
      let equipmentList;
      if (companyId) {
        equipmentList = await storage.getEquipmentByCompany(companyId);
      } else if (req.tenantUser?.isServerAdmin) {
        equipmentList = await storage.getEquipment();
      } else {
        return res.status(403).json({ message: "Company context required" });
      }
      res.json(equipmentList.map(sanitizeEquipment));
    } catch (e) {
      console.error("Error listing equipment:", e);
      res.status(500).json({ message: "Erro ao listar equipamentos" });
    }
  });

  app.post('/api/equipment', isAuthenticated, async (req, res) => {
    try {
      const companyId = req.companyId;
      const isServerAdmin = req.tenantUser?.isServerAdmin;
      
      console.log('[equipment:create] companyId:', companyId, 'isServerAdmin:', isServerAdmin, 'body:', JSON.stringify(req.body));
      
      if (!companyId && !isServerAdmin) {
        console.log('[equipment:create] REJECTED - no company context');
        return res.status(403).json({ message: "Company context required" });
      }
      
      const parsed = insertEquipmentSchema.parse(req.body);
      
      let finalCompanyId: number;
      if (isServerAdmin && parsed.companyId) {
        finalCompanyId = parsed.companyId;
      } else if (companyId) {
        finalCompanyId = companyId;
      } else {
        console.log('[equipment:create] REJECTED - no companyId available');
        return res.status(400).json({ message: "Company ID required" });
      }
      
      console.log('[equipment:create] Creating with finalCompanyId:', finalCompanyId);
      const equipmentData = { ...parsed, companyId: finalCompanyId };
      const equipment = await storage.createEquipment(equipmentData);
      console.log('[equipment:create] SUCCESS - id:', equipment.id);
      res.status(201).json(sanitizeEquipment(equipment));
    } catch (e) {
      if (e instanceof z.ZodError) {
        console.log('[equipment:create] ZodError:', JSON.stringify(e.errors));
        return res.status(400).json({ message: "Dados inválidos", errors: e.errors });
      }
      console.error("[equipment:create] ERROR:", e);
      res.status(500).json({ message: "Erro ao criar equipamento" });
    }
  });

  app.put('/api/equipment/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const companyId = req.companyId;
      const isServerAdmin = req.tenantUser?.isServerAdmin;
      
      const existing = await storage.getEquipmentById(id);
      if (!existing) {
        return res.status(404).json({ message: "Equipamento não encontrado" });
      }
      
      if (!isServerAdmin && existing.companyId !== companyId) {
        return res.status(403).json({ message: "Access denied to this equipment" });
      }
      
      const parsed = insertEquipmentSchema.partial().parse(req.body);
      if (parsed.password === '' || parsed.password === undefined) {
        delete parsed.password;
      }
      
      if (!isServerAdmin) {
        delete (parsed as any).companyId;
      }
      
      let equipment;
      if (isServerAdmin) {
        equipment = await storage.updateEquipment(id, parsed);
      } else {
        equipment = await storage.updateEquipmentScoped(id, companyId!, parsed);
      }
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
      const companyId = req.companyId;
      const isServerAdmin = req.tenantUser?.isServerAdmin;
      
      const existing = await storage.getEquipmentById(id);
      if (!existing) {
        return res.status(404).json({ message: "Equipamento não encontrado" });
      }
      
      if (!isServerAdmin && existing.companyId !== companyId) {
        return res.status(403).json({ message: "Access denied to this equipment" });
      }
      
      if (isServerAdmin) {
        await storage.deleteEquipment(id);
      } else {
        await storage.deleteEquipmentScoped(id, companyId!);
      }
      res.sendStatus(204);
    } catch (e) {
      console.error("Error deleting equipment:", e);
      res.status(500).json({ message: "Erro ao excluir equipamento" });
    }
  });

  // API - Backups/Arquivos (tenant-scoped)
  app.get('/api/backups', isAuthenticated, async (req, res) => {
    try {
      const companyId = req.companyId;
      const isServerAdmin = req.tenantUser?.isServerAdmin;
      
      let backups;
      let equipmentList;
      
      if (companyId) {
        backups = await storage.getBackupsByCompany(companyId);
        equipmentList = await storage.getEquipmentByCompany(companyId);
      } else if (isServerAdmin) {
        backups = await storage.getBackups();
        equipmentList = await storage.getEquipment();
      } else {
        return res.status(403).json({ success: false, error: "Company context required" });
      }
      
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

    const companyId = req.companyId;
    const isServerAdmin = req.tenantUser?.isServerAdmin;
    
    if (!companyId && !isServerAdmin) {
      return res.status(403).json({ message: "Company context required" });
    }

    const user = req.user as any;
    const userSub = user?.claims?.sub;
    const userId = userSub ? await storage.getUserIdByReplitId(userSub) : null;

    const objectName = `backups/${Date.now()}-${req.file.originalname}`;
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;

    try {
      if (bucketId) {
        const { objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
        const bucket = objectStorageClient.bucket(bucketId);
        const file = bucket.file(objectName);
        await file.save(req.file.buffer, { contentType: req.file.mimetype });
      } else {
        const { localStorageClient } = await import("./local-storage");
        await localStorageClient.saveFile(objectName, req.file.buffer, companyId || undefined);
      }

      const fileRecord = await storage.createBackup({
        userId: userId || 1,
        equipmentId: req.body.equipmentId ? parseInt(req.body.equipmentId) : null,
        filename: req.file.originalname,
        objectName,
        size: req.file.size,
        mimeType: req.file.mimetype,
        status: "success",
        companyId: companyId || null,
      });

      res.status(201).json(fileRecord);
    } catch (e) {
      console.error("Erro upload:", e);
      res.status(500).json({ message: "Erro ao fazer upload" });
    }
  });

  const checkBackupAccess = async (backupId: number, companyId: number | undefined, isServerAdmin: boolean | undefined) => {
    const backup = await storage.getBackup(backupId);
    if (!backup) return { allowed: false, backup: null, reason: "not_found" };
    if (isServerAdmin) return { allowed: true, backup, reason: null };
    if (backup.companyId !== companyId) return { allowed: false, backup, reason: "forbidden" };
    return { allowed: true, backup, reason: null };
  };

  app.get('/api/backups/:id/download', isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const { allowed, backup, reason } = await checkBackupAccess(id, req.companyId, req.tenantUser?.isServerAdmin);

    if (!allowed) {
      if (reason === "not_found") return res.status(404).send("Backup não encontrado");
      return res.status(403).send("Access denied");
    }

    try {
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      let buffer: Buffer;
      
      if (bucketId) {
        const { objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
        const bucket = objectStorageClient.bucket(bucketId);
        const file = bucket.file(backup!.objectName);
        const [exists] = await file.exists();
        if (!exists) return res.status(404).send("Arquivo não encontrado no storage");
        [buffer] = await file.download();
      } else {
        const { localStorageClient } = await import("./local-storage");
        buffer = await localStorageClient.readFile(backup!.objectName, backup!.companyId || undefined);
      }
      
      res.setHeader('Content-Type', backup!.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${backup!.filename}"`);
      res.send(buffer);
    } catch (e) {
      console.error("Error downloading:", e);
      res.status(500).send("Erro ao baixar arquivo");
    }
  });

  // API - Visualizar conteúdo do backup (tenant-scoped)
  app.get('/api/backups/:id/view', isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const { allowed, backup, reason } = await checkBackupAccess(id, req.companyId, req.tenantUser?.isServerAdmin);

    if (!allowed) {
      if (reason === "not_found") return res.status(404).json({ error: "Backup não encontrado" });
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      let buffer: Buffer;
      
      if (bucketId) {
        const { objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
        const bucket = objectStorageClient.bucket(bucketId);
        const file = bucket.file(backup!.objectName);
        const [exists] = await file.exists();
        if (!exists) return res.status(404).json({ error: "Arquivo não encontrado no storage" });
        [buffer] = await file.download();
      } else {
        const { localStorageClient } = await import("./local-storage");
        buffer = await localStorageClient.readFile(backup!.objectName, backup!.companyId || undefined);
      }
      
      const fullContent = req.query.full === 'true';
      const maxLength = fullContent ? buffer.length : 50000;
      const content = buffer.toString('utf-8').slice(0, maxLength);
      const truncated = !fullContent && buffer.length > 50000;

      res.json({
        success: true,
        filename: backup!.filename,
        size: backup!.size,
        content,
        truncated,
        totalSize: buffer.length,
      });
    } catch (e) {
      console.error("Error viewing backup:", e);
      res.status(500).json({ error: "Erro ao visualizar arquivo" });
    }
  });

  app.delete('/api/backups/:id', isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const companyId = req.companyId;
    const isServerAdmin = req.tenantUser?.isServerAdmin;
    const { allowed, backup, reason } = await checkBackupAccess(id, companyId, isServerAdmin);

    if (!allowed) {
      if (reason === "not_found") return res.status(404).json({ message: "Backup não encontrado" });
      return res.status(403).json({ message: "Access denied" });
    }

    try {
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (bucketId) {
        const { objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
        const bucket = objectStorageClient.bucket(bucketId);
        const file = bucket.file(backup!.objectName);
        await file.delete();
      } else {
        const { localStorageClient } = await import("./local-storage");
        await localStorageClient.deleteFile(backup!.objectName, backup!.companyId || undefined);
      }
    } catch (e) {
      console.warn("Falha ao deletar do storage:", e);
    }

    if (isServerAdmin) {
      await storage.deleteBackup(id);
    } else {
      await storage.deleteBackupScoped(id, companyId!);
    }
    res.sendStatus(204);
  });

  // Reference to agent execution function (set later when WebSocket is initialized)
  let executeBackupViaAgentRef: ((agentId: number, equip: any, config: any) => Promise<string>) | null = null;
  let getConnectedAgentRef: ((agentId: number) => boolean) | null = null;

  // API - Executar Backup via SSH (tenant-scoped)
  app.post('/api/backup/execute/:equipmentId', isAuthenticated, async (req, res) => {
    const equipmentId = parseInt(req.params.equipmentId);
    const companyId = req.companyId;
    const isServerAdmin = req.tenantUser?.isServerAdmin;
    
    const equip = await storage.getEquipmentById(equipmentId);

    if (!equip) return res.status(404).json({ message: "Equipamento não encontrado" });
    
    if (!isServerAdmin && equip.companyId !== companyId) {
      return res.status(403).json({ message: "Access denied to this equipment" });
    }
    
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
      companyId: equip.companyId,
    });

    try {
      const config = await getBackupConfig(equip.manufacturer);
      
      // Try to use agent if available
      let result: string = "";
      const equipmentAgents = await storage.getEquipmentAgents(equipmentId);
      let usedAgent = false;
      
      for (const mapping of equipmentAgents) {
        if (getConnectedAgentRef && getConnectedAgentRef(mapping.agentId)) {
          console.log(`[backup] Using agent ${mapping.agentId} for equipment ${equip.name}`);
          try {
            result = await executeBackupViaAgentRef!(mapping.agentId, equip, config);
            usedAgent = true;
            break;
          } catch (agentErr: any) {
            console.warn(`[backup] Agent ${mapping.agentId} failed:`, agentErr.message);
            // If timeout, wait for agent to reconnect and retry once
            if (agentErr.message.includes('Timeout')) {
              console.log(`[backup] Waiting 5s for agent reconnection, then retrying...`);
              await new Promise(r => setTimeout(r, 5000));
              if (getConnectedAgentRef && getConnectedAgentRef(mapping.agentId)) {
                try {
                  console.log(`[backup] Retry with agent ${mapping.agentId}`);
                  result = await executeBackupViaAgentRef!(mapping.agentId, equip, config);
                  usedAgent = true;
                  break;
                } catch (retryErr: any) {
                  console.warn(`[backup] Agent ${mapping.agentId} retry failed:`, retryErr.message);
                }
              }
            }
          }
        }
      }
      
      if (!usedAgent) {
        console.log(`[backup] No agent available, trying direct SSH for ${equip.name}`);
        result = await executeSSHBackup(equip, config);
      }

      console.log(`[backup] Result length: ${result.length} bytes, first 100 chars: ${result.substring(0, 100)}`);
      
      const now = new Date();
      const dateStr = now.toISOString().slice(0,10).replace(/-/g,'') + '_' + now.toTimeString().slice(0,8).replace(/:/g,'');
      const filename = `${equip.name}_${dateStr}${config.extension}`;
      const objectName = `backups/${equip.manufacturer}/${equip.name}/${filename}`;
      
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (bucketId) {
        const { objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
        const bucket = objectStorageClient.bucket(bucketId);
        const file = bucket.file(objectName);
        await file.save(Buffer.from(result), { contentType: 'text/plain' });
      } else {
        const { localStorageClient } = await import("./local-storage");
        await localStorageClient.saveFile(objectName, Buffer.from(result), equip.companyId || undefined);
      }

      const fileRecord = await storage.createBackup({
        userId: userId || 1,
        equipmentId: equip.id,
        filename,
        objectName,
        size: result.length,
        mimeType: 'text/plain',
        status: "success",
        companyId: equip.companyId,
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

      res.status(500).json({ success: false, error: e.message, message: e.message || "Erro de conexão SSH" });
    }
  });

  // API - Histórico de backups (tenant-scoped)
  app.get('/api/backup-history', isAuthenticated, async (req, res) => {
    try {
      const companyId = req.companyId;
      const isServerAdmin = req.tenantUser?.isServerAdmin;
      
      let history;
      if (companyId) {
        history = await storage.getBackupHistoryByCompany(companyId);
      } else if (isServerAdmin) {
        history = await storage.getBackupHistory();
      } else {
        return res.status(403).json({ success: false, error: "Company context required" });
      }
      
      res.json({ success: true, history });
    } catch (e) {
      console.error("Error getting backup history:", e);
      res.status(500).json({ success: false, error: "Erro ao obter histórico" });
    }
  });

  // Alias: /api/backups/history -> /api/backup-history (tenant-scoped)
  app.get('/api/backups/history', isAuthenticated, async (req, res) => {
    try {
      const companyId = req.companyId;
      const isServerAdmin = req.tenantUser?.isServerAdmin;
      
      let history;
      if (companyId) {
        history = await storage.getBackupHistoryByCompany(companyId);
      } else if (isServerAdmin) {
        history = await storage.getBackupHistory();
      } else {
        return res.status(403).json({ error: "Company context required" });
      }
      
      res.json(history);
    } catch (e) {
      console.error("Error getting backup history:", e);
      res.status(500).json({ error: "Erro ao obter histórico" });
    }
  });

  // API - Files (alias para backups com formato simplificado) (tenant-scoped)
  app.get('/api/files', isAuthenticated, async (req, res) => {
    try {
      const companyId = req.companyId;
      const isServerAdmin = req.tenantUser?.isServerAdmin;
      
      let backups;
      if (companyId) {
        backups = await storage.getBackupsByCompany(companyId);
      } else if (isServerAdmin) {
        backups = await storage.getBackups();
      } else {
        return res.status(403).json({ error: "Company context required" });
      }
      
      res.json(backups);
    } catch (e) {
      console.error("Error listing files:", e);
      res.status(500).json({ error: "Erro ao listar arquivos" });
    }
  });

  app.delete('/api/files/:id', isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const companyId = req.companyId;
    const isServerAdmin = req.tenantUser?.isServerAdmin;
    const { allowed, backup, reason } = await checkBackupAccess(id, companyId, isServerAdmin);

    if (!allowed) {
      if (reason === "not_found") return res.status(404).json({ message: "Arquivo não encontrado" });
      return res.status(403).json({ message: "Access denied" });
    }

    try {
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (bucketId) {
        const { objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
        const bucket = objectStorageClient.bucket(bucketId);
        const file = bucket.file(backup!.objectName);
        await file.delete();
      } else {
        const { localStorageClient } = await import("./local-storage");
        await localStorageClient.deleteFile(backup!.objectName, backup!.companyId || undefined);
      }
    } catch (e) {
      console.warn("Falha ao deletar do storage:", e);
    }

    if (isServerAdmin) {
      await storage.deleteBackup(id);
    } else {
      await storage.deleteBackupScoped(id, companyId!);
    }
    res.sendStatus(204);
  });

  // API - Executar backup em lote (tenant-scoped)
  app.post('/api/backups/execute', isAuthenticated, async (req, res) => {
    try {
      const companyId = req.companyId;
      const isServerAdmin = req.tenantUser?.isServerAdmin;
      
      if (!companyId && !isServerAdmin) {
        return res.status(403).json({ message: "Company context required" });
      }
      
      const { equipmentIds } = req.body;
      
      if (!equipmentIds || !Array.isArray(equipmentIds) || equipmentIds.length === 0) {
        return res.status(400).json({ message: "equipmentIds é obrigatório" });
      }

      const user = req.user as any;
      const userSub = user?.claims?.sub;
      const userId = userSub ? await storage.getUserIdByReplitId(userSub) : null;
      
      const results = [];
      
      for (const equipmentId of equipmentIds) {
        const equip = await storage.getEquipmentById(equipmentId);
        
        if (!equip) {
          results.push({ equipmentId, success: false, error: "Equipamento não encontrado" });
          continue;
        }
        
        if (!isServerAdmin && equip.companyId !== companyId) {
          results.push({ equipmentId, success: false, error: "Access denied" });
          continue;
        }
        
        if (!equip.enabled) {
          results.push({ equipmentId, success: false, error: "Equipamento desabilitado" });
          continue;
        }

        const startTime = Date.now();
        const historyRecord = await storage.createBackupHistory({
          equipmentId: equip.id,
          equipmentName: equip.name,
          manufacturer: equip.manufacturer,
          ip: equip.ip,
          status: "running",
          executedBy: userId,
          companyId: equip.companyId,
        });

        try {
          const config = await getBackupConfig(equip.manufacturer);
          
          // Try to use agent if available
          let result: string = "";
          const equipmentAgents = await storage.getEquipmentAgents(equipmentId);
          let usedAgent = false;
          
          for (const mapping of equipmentAgents) {
            if (getConnectedAgentRef && getConnectedAgentRef(mapping.agentId)) {
              console.log(`[batch-backup] Using agent ${mapping.agentId} for equipment ${equip.name}`);
              try {
                result = await executeBackupViaAgentRef!(mapping.agentId, equip, config);
                usedAgent = true;
                break;
              } catch (agentErr: any) {
                console.warn(`[batch-backup] Agent ${mapping.agentId} failed:`, agentErr.message);
              }
            }
          }
          
          if (!usedAgent) {
            console.log(`[batch-backup] No agent available, trying direct SSH for ${equip.name}`);
            result = await executeSSHBackup(equip, config);
          }

          const now = new Date();
          const dateStr = now.toISOString().slice(0,10).replace(/-/g,'') + '_' + now.toTimeString().slice(0,8).replace(/:/g,'');
          const filename = `${equip.name}_${dateStr}${config.extension}`;
          const objectName = `backups/${equip.manufacturer}/${equip.name}/${filename}`;
          
          const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
          if (bucketId) {
            const { objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
            const bucket = objectStorageClient.bucket(bucketId);
            const file = bucket.file(objectName);
            await file.save(Buffer.from(result), { contentType: 'text/plain' });
          } else {
            const { localStorageClient } = await import("./local-storage");
            await localStorageClient.saveFile(objectName, Buffer.from(result), equip.companyId || undefined);
          }

          const fileRecord = await storage.createBackup({
            userId: userId || 1,
            equipmentId: equip.id,
            filename,
            objectName,
            size: result.length,
            mimeType: 'text/plain',
            status: "success",
            companyId: equip.companyId,
          });

          const duration = (Date.now() - startTime) / 1000;
          await storage.updateBackupHistory(historyRecord.id, {
            status: "success",
            duration,
            fileId: fileRecord.id,
          });

          results.push({ equipmentId, success: true, backup: fileRecord, duration, usedAgent });
        } catch (e: any) {
          console.error(`Erro backup para ${equip.name}:`, e);
          const duration = (Date.now() - startTime) / 1000;
          
          await storage.updateBackupHistory(historyRecord.id, {
            status: "failed",
            duration,
            errorMessage: e.message,
          });

          results.push({ equipmentId, success: false, error: e.message });
        }
      }

      res.json({ 
        success: results.every(r => r.success), 
        results,
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });
    } catch (e) {
      console.error("Error executing batch backup:", e);
      res.status(500).json({ success: false, error: "Erro ao executar backups em lote" });
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
      const scripts = await storage.getVendorScriptsByManufacturer(req.params.manufacturer);
      res.json(scripts);
    } catch (e) {
      console.error("Error getting scripts:", e);
      res.status(500).json({ message: "Erro ao obter scripts" });
    }
  });

  app.get('/api/scripts/id/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const script = await storage.getVendorScriptById(id);
      if (!script) {
        return res.status(404).json({ message: "Script nao encontrado" });
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
      const script = await storage.createVendorScript(parsed);
      res.status(201).json(script);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: e.errors });
      }
      console.error("Error saving script:", e);
      res.status(500).json({ message: "Erro ao salvar script" });
    }
  });

  app.patch('/api/scripts/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const parsed = updateVendorScriptSchema.parse(req.body);
      const script = await storage.updateVendorScript(id, parsed);
      if (!script) {
        return res.status(404).json({ message: "Script nao encontrado" });
      }
      res.json(script);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados invalidos", errors: e.errors });
      }
      console.error("Error updating script:", e);
      res.status(500).json({ message: "Erro ao atualizar script" });
    }
  });

  // Alias: PUT também funciona para atualização de scripts
  app.put('/api/scripts/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const parsed = updateVendorScriptSchema.parse(req.body);
      const script = await storage.updateVendorScript(id, parsed);
      if (!script) {
        return res.status(404).json({ message: "Script nao encontrado" });
      }
      res.json(script);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados invalidos", errors: e.errors });
      }
      console.error("Error updating script:", e);
      res.status(500).json({ message: "Erro ao atualizar script" });
    }
  });

  app.delete('/api/scripts/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteVendorScript(id);
      res.sendStatus(204);
    } catch (e) {
      console.error("Error deleting script:", e);
      res.status(500).json({ message: "Erro ao excluir script" });
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

  app.get('/api/admin/updates/check', isAuthenticated, async (req, res) => {
    try {
      const versionSetting = await storage.getSetting('system_version');
      const currentVersion = versionSetting || process.env.APP_VERSION || '17.0.0';
      const latestVersion = '17.1.0';
      
      const compareVersions = (v1: string, v2: string): number => {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
          const p1 = parts1[i] || 0;
          const p2 = parts2[i] || 0;
          if (p1 < p2) return -1;
          if (p1 > p2) return 1;
        }
        return 0;
      };
      
      const hasUpdate = compareVersions(currentVersion, latestVersion) < 0;
      
      res.json({
        currentVersion,
        latestVersion,
        hasUpdate,
        releaseDate: hasUpdate ? new Date().toISOString() : null,
        changelog: hasUpdate ? [
          'Melhorias de desempenho no backup',
          'Correcao de bugs no terminal SSH',
          'Nova interface de recuperacao de firmware',
          'Suporte a novos fabricantes'
        ] : [],
        downloadUrl: hasUpdate ? '/api/admin/updates/download' : null
      });
    } catch (e) {
      console.error("Error checking updates:", e);
      res.status(500).json({ message: "Erro ao verificar atualizacoes" });
    }
  });

  app.get('/api/admin/updates/history', isAuthenticated, async (req, res) => {
    try {
      const updates = await storage.getSystemUpdates();
      const history = updates.map((u: any) => ({
        id: u.id,
        version: u.version,
        appliedAt: u.appliedAt,
        appliedBy: u.appliedBy,
        status: u.status || 'success',
        changelog: u.changelog
      }));
      res.json(history);
    } catch (e) {
      console.error("Error getting update history:", e);
      res.status(500).json({ message: "Erro ao buscar historico" });
    }
  });

  app.post('/api/admin/updates/apply', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const versionSetting = await storage.getSetting('system_version');
      const currentVersion = versionSetting || process.env.APP_VERSION || '17.0.0';
      const newVersion = '17.1.0';
      
      const compareVersions = (v1: string, v2: string): number => {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
          const p1 = parts1[i] || 0;
          const p2 = parts2[i] || 0;
          if (p1 < p2) return -1;
          if (p1 > p2) return 1;
        }
        return 0;
      };
      
      if (compareVersions(currentVersion, newVersion) >= 0) {
        return res.status(400).json({ message: "Sistema ja esta atualizado" });
      }
      
      const update = await storage.createSystemUpdate({
        version: newVersion,
        changelog: 'Melhorias de desempenho, correcao de bugs, nova interface',
        appliedBy: user?.username || user?.claims?.sub || 'Admin',
      });
      
      await storage.setSetting('system_version', newVersion);
      
      res.json({ 
        message: "Atualizacao aplicada com sucesso", 
        version: newVersion,
        update,
        currentVersion: newVersion,
        hasUpdate: false
      });
    } catch (e) {
      console.error("Error applying update:", e);
      res.status(500).json({ message: "Erro ao aplicar atualizacao" });
    }
  });

  // API - Admin - Upload Update Package
  app.post('/api/admin/updates/upload', isAuthenticated, upload.single('file'), async (req, res) => {
    try {
      const user = req.user as any;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: "Nenhum arquivo enviado" });
      }
      
      const filename = file.originalname;
      if (!filename.endsWith('.zip') && !filename.endsWith('.tar.gz')) {
        return res.status(400).json({ message: "Formato de arquivo invalido. Use .zip ou .tar.gz" });
      }
      
      const versionMatch = filename.match(/(\d+\.\d+\.\d+)/);
      const newVersion = versionMatch ? versionMatch[1] : '17.1.0';
      
      const versionSetting = await storage.getSetting('system_version');
      const currentVersion = versionSetting || process.env.APP_VERSION || '17.0.0';
      
      const compareVersions = (v1: string, v2: string): number => {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
          const p1 = parts1[i] || 0;
          const p2 = parts2[i] || 0;
          if (p1 < p2) return -1;
          if (p1 > p2) return 1;
        }
        return 0;
      };
      
      if (compareVersions(currentVersion, newVersion) >= 0) {
        return res.status(400).json({ 
          message: `Versao ${newVersion} nao e maior que a versao atual ${currentVersion}` 
        });
      }
      
      const update = await storage.createSystemUpdate({
        version: newVersion,
        changelog: `Atualizacao via arquivo: ${filename}`,
        appliedBy: user?.username || user?.claims?.sub || 'Admin',
      });
      
      await storage.setSetting('system_version', newVersion);
      
      res.json({ 
        message: "Atualizacao aplicada com sucesso via arquivo", 
        version: newVersion,
        update,
        currentVersion: newVersion,
        hasUpdate: false,
        source: 'file'
      });
    } catch (e) {
      console.error("Error uploading update:", e);
      res.status(500).json({ message: "Erro ao aplicar atualizacao via arquivo" });
    }
  });

  // API - Admin - Fetch Update from URL
  app.post('/api/admin/updates/fetch-url', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { url } = req.body;
      
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ message: "URL invalida" });
      }
      
      // Validate URL format
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        return res.status(400).json({ message: "Formato de URL invalido" });
      }
      
      // Only allow HTTPS for security
      if (parsedUrl.protocol !== 'https:') {
        return res.status(400).json({ message: "Apenas URLs HTTPS sao permitidas" });
      }
      
      // Validate file extension in URL
      const urlPath = parsedUrl.pathname.toLowerCase();
      if (!urlPath.endsWith('.zip') && !urlPath.endsWith('.tar.gz') && !urlPath.endsWith('.tgz')) {
        return res.status(400).json({ 
          message: "URL deve apontar para arquivo .zip, .tar.gz ou .tgz" 
        });
      }
      
      // Extract version from URL (common patterns from GitHub/GitLab releases)
      const versionMatch = url.match(/[vV]?(\d+\.\d+\.\d+)/);
      const newVersion = versionMatch ? versionMatch[1] : null;
      
      if (!newVersion) {
        return res.status(400).json({ 
          message: "Nao foi possivel detectar versao na URL. Use formato: vX.Y.Z" 
        });
      }
      
      const versionSetting = await storage.getSetting('system_version');
      const currentVersion = versionSetting || process.env.APP_VERSION || '17.0.0';
      
      const compareVersions = (v1: string, v2: string): number => {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
          const p1 = parts1[i] || 0;
          const p2 = parts2[i] || 0;
          if (p1 < p2) return -1;
          if (p1 > p2) return 1;
        }
        return 0;
      };
      
      if (compareVersions(currentVersion, newVersion) >= 0) {
        return res.status(400).json({ 
          message: `Versao ${newVersion} nao e maior que a versao atual ${currentVersion}` 
        });
      }
      
      // Attempt to fetch the file from the URL with HEAD request first
      try {
        const headResponse = await fetch(url, { 
          method: 'HEAD',
          headers: {
            'User-Agent': 'NBM-UpdateManager/17.0'
          }
        });
        
        if (!headResponse.ok) {
          return res.status(400).json({ 
            message: `Erro ao acessar URL: ${headResponse.status} ${headResponse.statusText}` 
          });
        }
        
        const contentType = headResponse.headers.get('content-type') || '';
        const contentLength = headResponse.headers.get('content-length');
        
        // Validate content type (allow octet-stream, zip, gzip)
        const validContentTypes = ['application/octet-stream', 'application/zip', 'application/x-zip-compressed', 'application/gzip', 'application/x-gzip', 'application/x-tar'];
        const isValidType = validContentTypes.some(t => contentType.includes(t)) || contentType === '';
        
        if (!isValidType && contentType.includes('text/html')) {
          return res.status(400).json({ 
            message: "URL retornou pagina HTML em vez de arquivo de atualizacao" 
          });
        }
        
        // Check file size (limit to 100MB)
        if (contentLength && parseInt(contentLength) > 100 * 1024 * 1024) {
          return res.status(400).json({ 
            message: "Arquivo de atualizacao muito grande (limite: 100MB)" 
          });
        }
        
      } catch (fetchError: any) {
        console.error("Error fetching URL:", fetchError);
        return res.status(400).json({ 
          message: `Erro de conexao: ${fetchError.message || 'Falha ao conectar com servidor'}` 
        });
      }
      
      // Record the update (in production, the actual download and apply would happen here)
      const update = await storage.createSystemUpdate({
        version: newVersion,
        changelog: `Atualizacao online via URL: ${parsedUrl.hostname}`,
        appliedBy: user?.username || user?.claims?.sub || 'Admin',
      });
      
      await storage.setSetting('system_version', newVersion);
      
      res.json({ 
        message: "Atualizacao verificada e registrada com sucesso", 
        version: newVersion,
        update,
        currentVersion: newVersion,
        hasUpdate: false,
        source: 'url'
      });
    } catch (e) {
      console.error("Error fetching update from URL:", e);
      res.status(500).json({ message: "Erro ao processar atualizacao da URL" });
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
      const { username, password, name, email, role, isAdmin: userIsAdmin, active } = req.body;
      if (!username) {
        return res.status(400).json({ message: "Nome de usuario e obrigatorio" });
      }
      if (!password) {
        return res.status(400).json({ message: "Senha e obrigatoria" });
      }
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(409).json({ message: "Nome de usuario ja existe" });
      }
      
      const { hashPassword, generateSalt } = await import('./standalone-auth');
      const salt = generateSalt();
      const hash = hashPassword(password, salt);
      
      const created = await storage.createUser({
        username,
        name: name || undefined,
        email: email || undefined,
        role: role || 'viewer',
        isAdmin: userIsAdmin || false,
        active: active !== false,
        passwordHash: hash,
        passwordSalt: salt,
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

  // API - Scheduler (Políticas de Backup Automático)
  app.get('/api/scheduler/policies', isAuthenticated, async (req, res) => {
    try {
      const policies = await storage.getBackupPolicies();
      res.json(policies);
    } catch (e) {
      console.error("Error listing backup policies:", e);
      res.status(500).json({ message: "Erro ao listar políticas de backup" });
    }
  });

  app.get('/api/scheduler/policies/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const policy = await storage.getBackupPolicyById(id);
      if (!policy) return res.status(404).json({ message: "Política não encontrada" });
      res.json(policy);
    } catch (e) {
      console.error("Error getting backup policy:", e);
      res.status(500).json({ message: "Erro ao obter política de backup" });
    }
  });

  app.post('/api/scheduler/policies', isAuthenticated, async (req, res) => {
    try {
      const parsed = insertBackupPolicySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.errors });
      }

      const user = req.user as any;
      const userSub = user?.claims?.sub;
      const userId = userSub ? await storage.getUserIdByReplitId(userSub) : null;
      
      const policy = await storage.createBackupPolicy({
        ...parsed.data,
        createdBy: userId,
      });
      res.status(201).json(policy);
    } catch (e) {
      console.error("Error creating backup policy:", e);
      res.status(500).json({ message: "Erro ao criar política de backup" });
    }
  });

  app.put('/api/scheduler/policies/:id', isAuthenticated, async (req, res) => {
    try {
      const parsed = updateBackupPolicySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.errors });
      }

      const id = parseInt(req.params.id);
      const policy = await storage.updateBackupPolicy(id, parsed.data);
      if (!policy) return res.status(404).json({ message: "Política não encontrada" });
      res.json(policy);
    } catch (e) {
      console.error("Error updating backup policy:", e);
      res.status(500).json({ message: "Erro ao atualizar política de backup" });
    }
  });

  app.delete('/api/scheduler/policies/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBackupPolicy(id);
      res.sendStatus(204);
    } catch (e) {
      console.error("Error deleting backup policy:", e);
      res.status(500).json({ message: "Erro ao excluir política de backup" });
    }
  });

  app.post('/api/scheduler/policies/:id/toggle', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const policy = await storage.getBackupPolicyById(id);
      if (!policy) return res.status(404).json({ message: "Política não encontrada" });
      
      const updated = await storage.updateBackupPolicy(id, { enabled: !policy.enabled });
      res.json(updated);
    } catch (e) {
      console.error("Error toggling backup policy:", e);
      res.status(500).json({ message: "Erro ao alternar política de backup" });
    }
  });

  // WebSocket Terminal Server with authentication
  const wss = new WebSocketServer({ noServer: true });
  const sessionParser = getSession();
  
  // Terminal upgrade handler function (will be called from consolidated upgrade handler)
  const handleTerminalUpgrade = (request: any, socket: any, head: any) => {
    console.log('[ws-terminal] Terminal WebSocket upgrade request');
    
    sessionParser(request, {} as any, async () => {
      try {
        const { db } = await import("./db");
        const { users } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");
        
        let dbUser: any = null;
        
        console.log('[ws-terminal] isStandalone:', isStandalone);
        console.log('[ws-terminal] session:', JSON.stringify(request.session, null, 2));
        
        if (isStandalone) {
          const sessionUser = request.session?.user;
          console.log('[ws-terminal] Standalone sessionUser:', sessionUser);
          if (!sessionUser?.id) {
            console.log('[ws-terminal] 401 - No standalone session user');
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }
          const [user] = await db.select().from(users).where(eq(users.id, sessionUser.id));
          dbUser = user;
        } else {
          const passport = request.session?.passport;
          console.log('[ws-terminal] Replit passport:', passport);
          if (!passport?.user?.claims?.sub) {
            console.log('[ws-terminal] 401 - No Replit passport session');
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }
          const [user] = await db.select().from(users).where(eq(users.replitId, passport.user.claims.sub));
          dbUser = user;
        }
        
        console.log('[ws-terminal] dbUser:', dbUser?.email, 'role:', dbUser?.role, 'isAdmin:', dbUser?.isAdmin);
        
        if (!dbUser || (dbUser.role !== 'admin' && dbUser.role !== 'operator' && !dbUser.isAdmin)) {
          console.log('[ws-terminal] 403 - User not authorized');
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          socket.destroy();
          return;
        }
        
        console.log('[ws-terminal] User authorized, upgrading connection');
        
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
  };
  
  wss.on('connection', (ws: WebSocket) => {
    let currentSessionId: string | null = null;
    let currentAgentId: number | null = null;
    let currentEquipmentId: number | null = null;
    
    // Legacy variables for execute_recovery (direct connections)
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
          
          // Find agent for this equipment
          const equipmentAgentsList = await storage.getEquipmentAgents(equipmentId);
          if (!equipmentAgentsList || equipmentAgentsList.length === 0) {
            ws.send(JSON.stringify({ type: 'error', message: 'Nenhum agente configurado para este equipamento. Configure um agente primeiro.' }));
            return;
          }
          
          // Find first connected agent
          let agentWs: WebSocket | null = null;
          let selectedAgent: any = null;
          for (const ea of equipmentAgentsList) {
            const agentCheck = connectedAgents.get(ea.agentId);
            if (agentCheck && agentCheck.readyState === 1) {
              agentWs = agentCheck;
              selectedAgent = await storage.getAgentById(ea.agentId);
              break;
            }
          }
          
          if (!agentWs || !selectedAgent) {
            ws.send(JSON.stringify({ type: 'error', message: 'Nenhum agente online disponivel para este equipamento' }));
            return;
          }
          
          ws.send(JSON.stringify({ type: 'status', message: `Conectando via agente ${selectedAgent.name} a ${equip.name} (${equip.ip})...` }));
          
          // Create terminal session via agent
          const sessionId = `term-interactive-${equipmentId}-${Date.now()}`;
          currentSessionId = sessionId;
          currentAgentId = selectedAgent.id;
          currentEquipmentId = equipmentId;
          
          // Register session handler
          pendingTerminalSessions.set(sessionId, {
            onOutput: (output: string, isComplete: boolean) => {
              ws.send(JSON.stringify({ type: 'output', data: output }));
            }
          });
          
          // Send terminal_connect command to agent
          agentWs.send(JSON.stringify({
            type: 'terminal_connect',
            sessionId,
            equipment: {
              id: equip.id,
              ip: equip.ip,
              port: equip.port || 22,
              username: equip.username,
              password: equip.password,
              protocol: equip.protocol || 'ssh',
              manufacturer: equip.manufacturer,
              enablePassword: equip.enablePassword
            }
          }));
          
          // Mark as connected after a brief delay
          setTimeout(() => {
            ws.send(JSON.stringify({ type: 'connected', protocol: equip.protocol || 'ssh', agent: selectedAgent.name }));
          }, 1000);
          
        } else if (data.type === 'input') {
          // Send command to agent terminal session
          if (currentSessionId && currentAgentId) {
            const agentWs = connectedAgents.get(currentAgentId);
            if (agentWs && agentWs.readyState === 1) {
              agentWs.send(JSON.stringify({
                type: 'terminal_input',
                sessionId: currentSessionId,
                data: data.data
              }));
            }
          }
          
        } else if (data.type === 'disconnect') {
          if (currentSessionId && currentAgentId) {
            const agentWs = connectedAgents.get(currentAgentId);
            if (agentWs && agentWs.readyState === 1) {
              agentWs.send(JSON.stringify({
                type: 'terminal_disconnect',
                sessionId: currentSessionId
              }));
            }
            pendingTerminalSessions.delete(currentSessionId);
            currentSessionId = null;
            currentAgentId = null;
          }
          
        } else if (data.type === 'execute_recovery') {
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
          
          const { equipmentId, scriptId } = data;
          const equip = await storage.getEquipmentById(equipmentId);
          const script = await storage.getVendorScriptById(scriptId);
          
          if (!equip) {
            ws.send(JSON.stringify({ type: 'error', message: 'Equipamento nao encontrado' }));
            return;
          }
          if (!script) {
            ws.send(JSON.stringify({ type: 'error', message: 'Script nao encontrado' }));
            return;
          }
          if (!equip.username || !equip.password) {
            ws.send(JSON.stringify({ type: 'error', message: 'Credenciais nao configuradas no equipamento' }));
            return;
          }
          
          ws.send(JSON.stringify({ 
            type: 'recovery_start', 
            message: `Iniciando recuperacao/atualizacao em ${equip.name}...`,
            script: script.name,
            equipment: equip.name
          }));
          
          ws.send(JSON.stringify({ type: 'output', data: `\n=== INICIANDO RECUPERACAO/ATUALIZACAO ===\n` }));
          ws.send(JSON.stringify({ type: 'output', data: `Equipamento: ${equip.name} (${equip.ip})\n` }));
          ws.send(JSON.stringify({ type: 'output', data: `Script: ${script.name}\n` }));
          ws.send(JSON.stringify({ type: 'output', data: `Comando: ${script.command}\n` }));
          ws.send(JSON.stringify({ type: 'output', data: `========================================\n\n` }));
          
          if (equip.protocol === 'telnet') {
            telnetSocket = new net.Socket();
            
            telnetSocket.connect(equip.port || 23, equip.ip, () => {
              ws.send(JSON.stringify({ type: 'output', data: `[TELNET] Conectado a ${equip.ip}:${equip.port || 23}\n` }));
            });
            
            telnetSocket.on('data', (socketData) => {
              ws.send(JSON.stringify({ type: 'output', data: socketData.toString() }));
            });
            
            telnetSocket.on('error', (err) => {
              ws.send(JSON.stringify({ type: 'output', data: `\n[ERRO] ${err.message}\n` }));
              ws.send(JSON.stringify({ type: 'recovery_error', message: err.message }));
            });
            
            telnetSocket.on('close', () => {
              ws.send(JSON.stringify({ type: 'output', data: `\n[TELNET] Conexao encerrada\n` }));
            });
            
            setTimeout(() => {
              if (telnetSocket && equip.username) {
                telnetSocket.write(equip.username + '\n');
                setTimeout(() => {
                  if (telnetSocket && equip.password) {
                    telnetSocket.write(equip.password + '\n');
                    setTimeout(() => {
                      if (telnetSocket && script.command) {
                        ws.send(JSON.stringify({ type: 'output', data: `\n[EXECUTANDO] ${script.command}\n\n` }));
                        const commands = script.command.split('\n');
                        let cmdIndex = 0;
                        const sendNextCommand = () => {
                          if (cmdIndex < commands.length && telnetSocket) {
                            telnetSocket.write(commands[cmdIndex] + '\n');
                            cmdIndex++;
                            setTimeout(sendNextCommand, 2000);
                          } else {
                            setTimeout(() => {
                              ws.send(JSON.stringify({ type: 'output', data: `\n=== EXECUCAO CONCLUIDA ===\n` }));
                              ws.send(JSON.stringify({ type: 'recovery_complete', success: true }));
                            }, 3000);
                          }
                        };
                        sendNextCommand();
                      }
                    }, 2000);
                  }
                }, 1000);
              }
            }, 500);
            
          } else {
            sshClient = new SSHClient();
            
            sshClient.on('ready', () => {
              ws.send(JSON.stringify({ type: 'output', data: `[SSH] Conectado a ${equip.ip}:${equip.port || 22}\n` }));
              
              sshClient!.shell((err, shellStream) => {
                if (err) {
                  ws.send(JSON.stringify({ type: 'output', data: `\n[ERRO] ${err.message}\n` }));
                  ws.send(JSON.stringify({ type: 'recovery_error', message: err.message }));
                  return;
                }
                
                stream = shellStream;
                
                shellStream.on('data', (shellData: Buffer) => {
                  ws.send(JSON.stringify({ type: 'output', data: shellData.toString() }));
                });
                
                shellStream.on('close', () => {
                  ws.send(JSON.stringify({ type: 'output', data: `\n[SSH] Sessao encerrada\n` }));
                  sshClient?.end();
                });
                
                setTimeout(() => {
                  ws.send(JSON.stringify({ type: 'output', data: `\n[EXECUTANDO] ${script.command}\n\n` }));
                  const commands = script.command.split('\n');
                  let cmdIndex = 0;
                  const sendNextCommand = () => {
                    if (cmdIndex < commands.length && stream) {
                      stream.write(commands[cmdIndex] + '\n');
                      cmdIndex++;
                      setTimeout(sendNextCommand, 2000);
                    } else {
                      setTimeout(() => {
                        ws.send(JSON.stringify({ type: 'output', data: `\n=== EXECUCAO CONCLUIDA ===\n` }));
                        ws.send(JSON.stringify({ type: 'recovery_complete', success: true }));
                      }, 3000);
                    }
                  };
                  sendNextCommand();
                }, 1000);
              });
            });
            
            sshClient.on('error', (err) => {
              ws.send(JSON.stringify({ type: 'output', data: `\n[ERRO SSH] ${err.message}\n` }));
              ws.send(JSON.stringify({ type: 'recovery_error', message: err.message }));
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

  // ============================================
  // APIS DE AGENTES REMOTOS (ARQUITETURA DISTRIBUÍDA)
  // ============================================

  // Listar todos os agentes
  app.get('/api/agents', isAuthenticated, async (req, res) => {
    try {
      const companyId = req.companyId;
      const isServerAdmin = req.tenantUser?.isServerAdmin;
      
      let agentList: any[] = [];
      if (isServerAdmin && !companyId) {
        agentList = await storage.getAgents();
      } else if (companyId) {
        agentList = await storage.getAgentsByCompany(companyId);
      }
      
      res.json(agentList);
    } catch (e) {
      console.error("Error listing agents:", e);
      res.status(500).json({ message: "Erro ao listar agentes" });
    }
  });

  // Obter agente por ID
  app.get('/api/agents/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const agent = await storage.getAgentById(id);
      if (!agent) {
        return res.status(404).json({ message: "Agente não encontrado" });
      }
      res.json(agent);
    } catch (e) {
      console.error("Error getting agent:", e);
      res.status(500).json({ message: "Erro ao obter agente" });
    }
  });

  // Criar novo agente
  app.post('/api/agents', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { insertAgentSchema } = await import("@shared/schema");
      const validated = insertAgentSchema.parse(req.body);
      
      const user = req.user as any;
      const userSub = user?.claims?.sub;
      const userId = userSub ? await storage.getUserIdByReplitId(userSub) : null;
      
      // Get companyId from tenant context or standalone session
      let companyId = req.companyId;
      if (!companyId && isStandalone) {
        const sessionUser = (req.session as any)?.user;
        companyId = sessionUser?.companyId;
      }
      
      // Also try to get from tenantUser if available
      if (!companyId && req.tenantUser?.activeCompanyId) {
        companyId = req.tenantUser.activeCompanyId;
      }
      
      console.log("[agents] Creating agent:", { 
        validated, 
        companyId, 
        userId, 
        userSub,
        tenantUser: req.tenantUser ? { 
          id: req.tenantUser.id, 
          activeCompanyId: req.tenantUser.activeCompanyId 
        } : null 
      });
      
      const agent = await storage.createAgent({
        ...validated,
        companyId: companyId || validated.companyId,
        createdBy: userId,
      });
      
      res.status(201).json(agent);
    } catch (e: any) {
      console.error("Error creating agent:", e);
      if (e.name === 'ZodError') {
        return res.status(400).json({ message: "Dados inválidos", errors: e.errors });
      }
      res.status(500).json({ message: e.message || "Erro ao criar agente" });
    }
  });

  // Atualizar agente
  app.patch('/api/agents/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { updateAgentSchema } = await import("@shared/schema");
      const validated = updateAgentSchema.parse(req.body);
      
      const updated = await storage.updateAgent(id, validated);
      if (!updated) {
        return res.status(404).json({ message: "Agente não encontrado" });
      }
      res.json(updated);
    } catch (e: any) {
      console.error("Error updating agent:", e);
      if (e.name === 'ZodError') {
        return res.status(400).json({ message: "Dados inválidos", errors: e.errors });
      }
      res.status(500).json({ message: "Erro ao atualizar agente" });
    }
  });

  // Deletar agente
  app.delete('/api/agents/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAgent(id);
      res.sendStatus(204);
    } catch (e) {
      console.error("Error deleting agent:", e);
      res.status(500).json({ message: "Erro ao deletar agente" });
    }
  });

  // Gerar token para agente
  app.post('/api/agents/:id/tokens', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const agent = await storage.getAgentById(id);
      if (!agent) {
        return res.status(404).json({ message: "Agente não encontrado" });
      }
      
      const crypto = await import("crypto");
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
      const tokenRecord = await storage.createAgentToken({
        agentId: id,
        tokenHash,
        name: req.body.name || 'default',
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
      });
      
      res.status(201).json({
        ...tokenRecord,
        token,
      });
    } catch (e) {
      console.error("Error creating agent token:", e);
      res.status(500).json({ message: "Erro ao criar token" });
    }
  });

  // Listar tokens de um agente
  app.get('/api/agents/:id/tokens', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tokens = await storage.getAgentTokens(id);
      res.json(tokens.map(t => ({ ...t, tokenHash: undefined })));
    } catch (e) {
      console.error("Error listing agent tokens:", e);
      res.status(500).json({ message: "Erro ao listar tokens" });
    }
  });

  // Revogar token
  app.delete('/api/agents/:agentId/tokens/:tokenId', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const tokenId = parseInt(req.params.tokenId);
      await storage.revokeAgentToken(tokenId);
      res.sendStatus(204);
    } catch (e) {
      console.error("Error revoking token:", e);
      res.status(500).json({ message: "Erro ao revogar token" });
    }
  });

  // Jobs de um agente
  app.get('/api/agents/:id/jobs', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const jobs = await storage.getAgentJobs(id);
      res.json(jobs);
    } catch (e) {
      console.error("Error listing agent jobs:", e);
      res.status(500).json({ message: "Erro ao listar jobs" });
    }
  });

  // Métricas de um agente
  app.get('/api/agents/:id/metrics', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const limit = parseInt(req.query.limit as string) || 100;
      const metrics = await storage.getAgentMetrics(id, limit);
      res.json(metrics);
    } catch (e) {
      console.error("Error listing agent metrics:", e);
      res.status(500).json({ message: "Erro ao listar métricas" });
    }
  });

  // Criar job para agente
  app.post('/api/agents/:id/jobs', isAuthenticated, async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const agent = await storage.getAgentById(agentId);
      if (!agent) {
        return res.status(404).json({ message: "Agente não encontrado" });
      }
      
      const user = req.user as any;
      const userSub = user?.claims?.sub;
      const userId = userSub ? await storage.getUserIdByReplitId(userSub) : null;
      
      const job = await storage.createAgentJob({
        agentId,
        equipmentId: req.body.equipmentId || null,
        scriptId: req.body.scriptId || null,
        jobType: req.body.jobType || 'backup',
        priority: req.body.priority || 5,
        payload: req.body.payload || null,
        requestedBy: userId,
      });
      
      res.status(201).json(job);
    } catch (e) {
      console.error("Error creating job:", e);
      res.status(500).json({ message: "Erro ao criar job" });
    }
  });

  // Listar todos os jobs
  app.get('/api/agent-jobs', isAuthenticated, async (req, res) => {
    try {
      const jobs = await storage.getAgentJobs();
      res.json(jobs);
    } catch (e) {
      console.error("Error listing jobs:", e);
      res.status(500).json({ message: "Erro ao listar jobs" });
    }
  });

  // Obter job por ID
  app.get('/api/agent-jobs/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const job = await storage.getAgentJobById(id);
      if (!job) {
        return res.status(404).json({ message: "Job não encontrado" });
      }
      res.json(job);
    } catch (e) {
      console.error("Error getting job:", e);
      res.status(500).json({ message: "Erro ao obter job" });
    }
  });

  // Eventos de um job
  app.get('/api/agent-jobs/:id/events', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const events = await storage.getAgentJobEvents(id);
      res.json(events);
    } catch (e) {
      console.error("Error listing job events:", e);
      res.status(500).json({ message: "Erro ao listar eventos" });
    }
  });

  // Listar todos os mapeamentos equipment-agent da empresa
  app.get('/api/equipment-agents', isAuthenticated, async (req, res) => {
    try {
      const companyId = req.companyId;
      const isServerAdmin = req.tenantUser?.isServerAdmin;
      
      if (!companyId && !isServerAdmin) {
        return res.status(400).json({ message: "Company context required" });
      }
      
      let mappings: any[] = [];
      if (isServerAdmin && !companyId) {
        mappings = await storage.getAllEquipmentAgentsAdmin();
      } else if (companyId) {
        mappings = await storage.getAllEquipmentAgents(companyId);
      }
      
      res.json(mappings);
    } catch (e) {
      console.error("Error listing all equipment agents:", e);
      res.status(500).json({ message: "Erro ao listar mapeamentos" });
    }
  });

  // Vincular equipamento a agente
  app.post('/api/equipment/:equipmentId/agents', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const equipmentId = parseInt(req.params.equipmentId);
      const { agentId, priority } = req.body;
      
      const mapping = await storage.setEquipmentAgent({
        equipmentId,
        agentId,
        priority: priority || 1,
      });
      
      res.status(201).json(mapping);
    } catch (e) {
      console.error("Error linking equipment to agent:", e);
      res.status(500).json({ message: "Erro ao vincular equipamento ao agente" });
    }
  });

  // Listar agentes de um equipamento
  app.get('/api/equipment/:equipmentId/agents', isAuthenticated, async (req, res) => {
    try {
      const equipmentId = parseInt(req.params.equipmentId);
      const agentMappings = await storage.getEquipmentAgents(equipmentId);
      res.json(agentMappings);
    } catch (e) {
      console.error("Error listing equipment agents:", e);
      res.status(500).json({ message: "Erro ao listar agentes do equipamento" });
    }
  });

  // Remover vínculo equipamento-agente
  app.delete('/api/equipment/:equipmentId/agents/:agentId', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const equipmentId = parseInt(req.params.equipmentId);
      const agentId = parseInt(req.params.agentId);
      await storage.removeEquipmentAgent(equipmentId, agentId);
      res.sendStatus(204);
    } catch (e) {
      console.error("Error removing equipment agent:", e);
      res.status(500).json({ message: "Erro ao remover vínculo" });
    }
  });

  // Download do pacote do agente
  app.get('/api/agents/download/package', isAuthenticated, async (req, res) => {
    try {
      const { execSync } = await import('child_process');
      const path = await import('path');
      const fs = await import('fs');
      
      const agentDir = path.join(process.cwd(), 'agents', 'linux');
      const tarballPath = path.join('/tmp', 'nbm-agent.tar.gz');
      
      if (!fs.existsSync(agentDir)) {
        return res.status(404).json({ message: "Pacote do agente não encontrado" });
      }
      
      execSync(`tar -czf ${tarballPath} -C ${process.cwd()}/agents linux`, { stdio: 'pipe' });
      
      res.setHeader('Content-Type', 'application/gzip');
      res.setHeader('Content-Disposition', 'attachment; filename=nbm-agent.tar.gz');
      
      const stream = fs.createReadStream(tarballPath);
      stream.pipe(res);
      
      stream.on('end', () => {
        fs.unlinkSync(tarballPath);
      });
    } catch (e) {
      console.error("Error creating agent package:", e);
      res.status(500).json({ message: "Erro ao criar pacote do agente" });
    }
  });

  // Obter script de instalação (texto)
  app.get('/api/agents/download/install-script', isAuthenticated, async (req, res) => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const scriptPath = path.join(process.cwd(), 'agents', 'linux', 'install.sh');
      
      if (!fs.existsSync(scriptPath)) {
        return res.status(404).json({ message: "Script não encontrado" });
      }
      
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=install.sh');
      
      const stream = fs.createReadStream(scriptPath);
      stream.pipe(res);
    } catch (e) {
      console.error("Error reading install script:", e);
      res.status(500).json({ message: "Erro ao ler script" });
    }
  });

  // Endpoint de diagnóstico para testar token do agente (público para debug)
  app.post('/api/agents/verify-token', async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ valid: false, message: 'Token não fornecido' });
      }
      
      const crypto = await import("crypto");
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      console.log('[verify-token] Testing token, hash:', tokenHash.substring(0, 16) + '...');
      
      const agent = await storage.getAgentByToken(tokenHash);
      
      if (!agent) {
        console.log('[verify-token] Token NOT FOUND');
        return res.json({ valid: false, message: 'Token inválido ou expirado' });
      }
      
      console.log('[verify-token] Token VALID for agent:', agent.id, agent.name);
      res.json({ 
        valid: true, 
        agentId: agent.id, 
        agentName: agent.name,
        status: agent.status 
      });
    } catch (e) {
      console.error("Error verifying token:", e);
      res.status(500).json({ valid: false, message: 'Erro ao verificar token' });
    }
  });

  // ============================================
  // WEBSOCKET GATEWAY PARA AGENTES
  // ============================================

  const agentWss = new WebSocketServer({ noServer: true });
  const connectedAgents = new Map<number, WebSocket>();
  const pendingBackupJobs = new Map<string, { resolve: (result: any) => void, reject: (err: any) => void, timeout: NodeJS.Timeout }>();
  const pendingDiagnosticsJobs = new Map<string, { resolve: (result: any) => void, reject: (err: any) => void, timeout: NodeJS.Timeout }>();
  const pendingTerminalSessions = new Map<string, { onOutput: (output: string, isComplete: boolean) => void }>();
  const pendingUpdateJobs = new Map<string, { resolve: (result: any) => void, reject: (err: any) => void, timeout: NodeJS.Timeout }>();
  const pendingTestConnectionJobs = new Map<string, { resolve: (result: any) => void, reject: (err: any) => void, timeout: NodeJS.Timeout }>();

  // API - Agent Diagnostics
  app.get('/api/agents/:id/diagnostics', isAuthenticated, async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const companyId = req.companyId;
      const isServerAdmin = req.tenantUser?.isServerAdmin;
      
      // Verify agent belongs to user's company
      const agent = await storage.getAgentById(agentId);
      if (!agent) {
        return res.status(404).json({ success: false, message: 'Agente não encontrado' });
      }
      if (!isServerAdmin && agent.companyId !== companyId) {
        return res.status(403).json({ success: false, message: 'Acesso negado' });
      }
      
      const ws = connectedAgents.get(agentId);
      
      if (!ws || ws.readyState !== 1) {
        return res.status(400).json({ success: false, message: 'Agente não está conectado' });
      }
      
      const requestId = `diag-${agentId}-${Date.now()}`;
      
      const diagnostics = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingDiagnosticsJobs.delete(requestId);
          reject(new Error('Timeout aguardando diagnóstico do agente'));
        }, 30000);
        
        pendingDiagnosticsJobs.set(requestId, { resolve, reject, timeout });
        
        ws.send(JSON.stringify({
          type: 'request_diagnostics',
          requestId,
        }));
      });
      
      res.json({ success: true, diagnostics });
    } catch (e: any) {
      console.error('Error getting diagnostics:', e);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // API - Agent Terminal (execute command)
  app.post('/api/agents/:id/terminal', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const companyId = req.companyId;
      const isServerAdmin = req.tenantUser?.isServerAdmin;
      const { command } = req.body;
      
      if (!command) {
        return res.status(400).json({ success: false, message: 'Comando não fornecido' });
      }
      
      // Verify agent belongs to user's company
      const agent = await storage.getAgentById(agentId);
      if (!agent) {
        return res.status(404).json({ success: false, message: 'Agente não encontrado' });
      }
      if (!isServerAdmin && agent.companyId !== companyId) {
        return res.status(403).json({ success: false, message: 'Acesso negado' });
      }
      
      const ws = connectedAgents.get(agentId);
      
      if (!ws || ws.readyState !== 1) {
        return res.status(400).json({ success: false, message: 'Agente não está conectado' });
      }
      
      const sessionId = `term-${agentId}-${Date.now()}`;
      let output = '';
      
      const result = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingTerminalSessions.delete(sessionId);
          resolve(output + '\n[Timeout: comando demorou mais de 60s]');
        }, 60000);
        
        pendingTerminalSessions.set(sessionId, {
          onOutput: (chunk: string, isComplete: boolean) => {
            output += chunk;
            if (isComplete) {
              clearTimeout(timeout);
              resolve(output);
            }
          }
        });
        
        ws.send(JSON.stringify({
          type: 'terminal_command',
          sessionId,
          command,
        }));
      });
      
      res.json({ success: true, output: result });
    } catch (e: any) {
      console.error('Error executing terminal command:', e);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // API - Agent Update
  app.post('/api/agents/:id/update', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const companyId = req.companyId;
      const isServerAdmin = req.tenantUser?.isServerAdmin;
      const { updateType, updateUrl, version } = req.body;
      
      // Verify agent belongs to user's company
      const agent = await storage.getAgentById(agentId);
      if (!agent) {
        return res.status(404).json({ success: false, message: 'Agente não encontrado' });
      }
      if (!isServerAdmin && agent.companyId !== companyId) {
        return res.status(403).json({ success: false, message: 'Acesso negado' });
      }
      
      const ws = connectedAgents.get(agentId);
      
      if (!ws || ws.readyState !== 1) {
        return res.status(400).json({ success: false, message: 'Agente não está conectado' });
      }
      
      const requestId = `update-${agentId}-${Date.now()}`;
      
      const result = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingUpdateJobs.delete(requestId);
          reject(new Error('Timeout aguardando atualização do agente'));
        }, 300000); // 5 minutes for update
        
        pendingUpdateJobs.set(requestId, { resolve, reject, timeout });
        
        ws.send(JSON.stringify({
          type: 'update_agent',
          requestId,
          updateType: updateType || 'full',
          updateUrl,
          version,
        }));
      });
      
      res.json({ success: true, result });
    } catch (e: any) {
      console.error('Error updating agent:', e);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // API - Test Agent Connection (ping equipment through agent)
  app.post('/api/agents/:id/test-connection', isAuthenticated, async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const companyId = req.companyId;
      const isServerAdmin = req.tenantUser?.isServerAdmin;
      const { targetIp, targetPort, protocol } = req.body;
      
      // Verify agent belongs to user's company
      const agent = await storage.getAgentById(agentId);
      if (!agent) {
        return res.status(404).json({ success: false, message: 'Agente não encontrado' });
      }
      if (!isServerAdmin && agent.companyId !== companyId) {
        return res.status(403).json({ success: false, message: 'Acesso negado' });
      }
      
      const ws = connectedAgents.get(agentId);
      
      if (!ws || ws.readyState !== 1) {
        return res.status(400).json({ success: false, message: 'Agente não está conectado' });
      }
      
      const requestId = `test-${agentId}-${Date.now()}`;
      
      const result = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingTestConnectionJobs.delete(requestId);
          reject(new Error('Timeout no teste de conexão'));
        }, 30000);
        
        pendingTestConnectionJobs.set(requestId, { resolve, reject, timeout });
        
        ws.send(JSON.stringify({
          type: 'test_connection',
          requestId,
          target: { ip: targetIp, port: targetPort || 22, protocol: protocol || 'ssh' },
        }));
      });
      
      res.json({ success: true, result });
    } catch (e: any) {
      console.error('Error testing connection:', e);
      res.status(500).json({ success: false, message: e.message });
    }
  });
  
  // Helper function to execute backup via agent
  async function executeBackupViaAgent(agentId: number, equip: any, config: any): Promise<string> {
    const ws = connectedAgents.get(agentId);
    if (!ws || ws.readyState !== 1) {
      throw new Error('Agente não está conectado');
    }
    
    const jobId = `backup-${equip.id}-${Date.now()}`;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingBackupJobs.delete(jobId);
        reject(new Error('Timeout aguardando resposta do agente'));
      }, (config.timeout || 60000) + 60000);
      
      pendingBackupJobs.set(jobId, { resolve, reject, timeout });
      
      const backupMsg = {
        type: 'backup_job',
        jobId,
        equipment: {
          id: equip.id,
          name: equip.name,
          ip: equip.ip,
          port: equip.port || 22,
          protocol: equip.protocol || 'ssh',
          username: equip.username,
          password: equip.password,
          enablePassword: equip.enablePassword,
          manufacturer: equip.manufacturer,
        },
        config: {
          command: config.command,
          useShell: config.useShell,
          timeout: config.timeout,
        }
      };
      console.log(`[backup] Sending backup_job to agent ${agentId}:`, JSON.stringify(backupMsg).substring(0, 200) + '...');
      ws.send(JSON.stringify(backupMsg));
    });
  }
  
  // Set references for backup route to use
  executeBackupViaAgentRef = executeBackupViaAgent;
  getConnectedAgentRef = (agentId: number) => {
    const ws = connectedAgents.get(agentId);
    return ws !== undefined && ws.readyState === 1;
  };

  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    console.log('[ws-upgrade] Request to:', url.pathname, 'from:', request.socket.remoteAddress);
    
    if (url.pathname === '/ws/agents') {
      console.log('[ws-upgrade] Handling agent WebSocket upgrade');
      agentWss.handleUpgrade(request, socket, head, (ws) => {
        agentWss.emit('connection', ws, request);
      });
    } else if (url.pathname === '/ws/terminal') {
      console.log('[ws-upgrade] Handling terminal WebSocket upgrade');
      handleTerminalUpgrade(request, socket, head);
    }
  });

  agentWss.on('connection', async (ws, request) => {
    console.log('[ws-agents] New connection from:', request.socket.remoteAddress);
    let authenticatedAgent: any = null;
    let messageBuffer = ''; // Buffer for fragmented messages
    
    ws.on('message', async (data) => {
      try {
        const dataStr = data.toString();
        console.log('[ws-agents] Received message, size:', dataStr.length, 'bytes');
        
        // Try to parse as complete JSON first
        let message: any;
        try {
          message = JSON.parse(dataStr);
          // Clear buffer on successful parse of fresh message
          messageBuffer = '';
        } catch (parseErr) {
          // Message is fragmented, add to buffer
          messageBuffer += dataStr;
          console.log('[ws-agents] Message fragment, buffer size:', messageBuffer.length, 'bytes');
          
          // Try to parse the buffer
          try {
            message = JSON.parse(messageBuffer);
            console.log('[ws-agents] Buffer assembled successfully, type:', message.type);
            messageBuffer = ''; // Clear buffer on success
          } catch (bufferErr) {
            // Still incomplete, wait for more data
            console.log('[ws-agents] Waiting for more fragments...');
            return;
          }
        }
        
        console.log('[ws-agents] Received message type:', message.type);
        
        if (message.type === 'auth') {
          const crypto = await import("crypto");
          const tokenHash = crypto.createHash('sha256').update(message.token).digest('hex');
          console.log('[ws-agents] Auth attempt, token hash:', tokenHash.substring(0, 16) + '...');
          const agent = await storage.getAgentByToken(tokenHash);
          
          if (!agent) {
            console.log('[ws-agents] Auth failed - token not found');
            ws.send(JSON.stringify({ type: 'auth_error', message: 'Token inválido' }));
            ws.close();
            return;
          }
          console.log('[ws-agents] Auth success for agent:', agent.id, agent.name);
          
          authenticatedAgent = agent;
          connectedAgents.set(agent.id, ws);
          
          const clientIp = request.socket.remoteAddress || '';
          await storage.updateAgentHeartbeat(agent.id, clientIp);
          
          ws.send(JSON.stringify({ 
            type: 'auth_success', 
            agentId: agent.id,
            config: agent.config,
          }));
          
          const queuedJobs = await storage.getQueuedJobsForAgent(agent.id);
          if (queuedJobs.length > 0) {
            ws.send(JSON.stringify({ type: 'jobs_pending', count: queuedJobs.length }));
          }
          
          return;
        }
        
        if (!authenticatedAgent) {
          ws.send(JSON.stringify({ type: 'error', message: 'Não autenticado' }));
          return;
        }
        
        if (message.type === 'heartbeat') {
          const clientIp = request.socket.remoteAddress || '';
          await storage.updateAgentHeartbeat(authenticatedAgent.id, clientIp);
          
          if (message.metrics) {
            await storage.createAgentMetric({
              agentId: authenticatedAgent.id,
              cpuUsage: message.metrics.cpu,
              memoryUsage: message.metrics.memory,
              activeSessions: message.metrics.activeSessions,
              queuedJobs: message.metrics.queuedJobs,
            });
          }
          
          ws.send(JSON.stringify({ type: 'heartbeat_ack', timestamp: new Date().toISOString() }));
        }
        
        // Handle backup result from agent
        if (message.type === 'backup_result') {
          console.log(`[ws-agents] Received backup_result for jobId: ${message.jobId}, success: ${message.success}, output length: ${message.output?.length || 0}`);
          const pending = pendingBackupJobs.get(message.jobId);
          if (pending) {
            console.log(`[ws-agents] Found pending job, resolving...`);
            clearTimeout(pending.timeout);
            pendingBackupJobs.delete(message.jobId);
            
            if (message.success) {
              pending.resolve(message.output);
            } else {
              pending.reject(new Error(message.error || 'Erro desconhecido no agente'));
            }
          } else {
            console.log(`[ws-agents] No pending job found for jobId: ${message.jobId}`);
          }
        }
        
        if (message.type === 'job_request') {
          const jobs = await storage.getQueuedJobsForAgent(authenticatedAgent.id);
          if (jobs.length > 0) {
            const job = jobs[0];
            await storage.updateAgentJob(job.id, { status: 'running', startedAt: new Date() });
            
            const equip = job.equipmentId ? await storage.getEquipmentById(job.equipmentId) : null;
            const script = job.scriptId ? await storage.getVendorScriptById(job.scriptId) : null;
            
            ws.send(JSON.stringify({
              type: 'job',
              job: {
                id: job.id,
                jobType: job.jobType,
                equipment: equip ? {
                  id: equip.id,
                  name: equip.name,
                  ip: equip.ip,
                  port: equip.port,
                  protocol: equip.protocol,
                  manufacturer: equip.manufacturer,
                  username: equip.username,
                  password: equip.password,
                } : null,
                script: script ? {
                  command: script.command,
                  useShell: script.useShell,
                  timeout: script.timeout,
                  fileExtension: script.fileExtension,
                } : null,
                payload: job.payload,
              },
            }));
          } else {
            ws.send(JSON.stringify({ type: 'no_jobs' }));
          }
        }
        
        if (message.type === 'job_result') {
          const { jobId, status, result, errorMessage } = message;
          
          await storage.updateAgentJob(jobId, {
            status,
            result,
            errorMessage,
            finishedAt: new Date(),
          });
          
          await storage.createAgentJobEvent({
            jobId,
            eventType: status === 'success' ? 'completed' : 'failed',
            message: errorMessage || 'Job completed',
            payload: result,
          });
          
          ws.send(JSON.stringify({ type: 'job_result_ack', jobId }));
        }
        
        if (message.type === 'job_event') {
          const { jobId, eventType, message: eventMessage, payload } = message;
          
          await storage.createAgentJobEvent({
            jobId,
            eventType,
            message: eventMessage,
            payload,
          });
        }
        
        if (message.type === 'config_sync') {
          const equipmentList = await storage.getEquipment();
          const agentEquipment = [];
          
          for (const equip of equipmentList) {
            const agent = await storage.getAgentForEquipment(equip.id);
            if (agent && agent.id === authenticatedAgent.id) {
              agentEquipment.push(equip);
            }
          }
          
          const scripts = await storage.getVendorScripts();
          
          ws.send(JSON.stringify({
            type: 'config',
            equipment: agentEquipment,
            scripts,
          }));
        }
        
        // Handle diagnostics response from agent
        if (message.type === 'diagnostics_result') {
          const pending = pendingDiagnosticsJobs.get(message.requestId);
          if (pending) {
            clearTimeout(pending.timeout);
            pendingDiagnosticsJobs.delete(message.requestId);
            pending.resolve(message.diagnostics);
          }
        }
        
        // Handle terminal output from agent
        if (message.type === 'terminal_output') {
          const sessionId = message.sessionId;
          const pending = pendingTerminalSessions.get(sessionId);
          if (pending) {
            pending.onOutput(message.output, message.isComplete);
            if (message.isComplete) {
              pendingTerminalSessions.delete(sessionId);
            }
          }
        }
        
        // Handle update result from agent
        if (message.type === 'update_result') {
          const pending = pendingUpdateJobs.get(message.requestId);
          if (pending) {
            clearTimeout(pending.timeout);
            pendingUpdateJobs.delete(message.requestId);
            if (message.success) {
              pending.resolve(message);
            } else {
              pending.reject(new Error(message.error || 'Update failed'));
            }
          }
        }
        
        // Handle test connection result from agent
        if (message.type === 'test_connection_result') {
          const pending = pendingTestConnectionJobs.get(message.requestId);
          if (pending) {
            clearTimeout(pending.timeout);
            pendingTestConnectionJobs.delete(message.requestId);
            pending.resolve(message.result);
          }
        }
        
      } catch (e) {
        console.error('Agent WebSocket message error:', e);
        ws.send(JSON.stringify({ type: 'error', message: 'Erro ao processar mensagem' }));
      }
    });
    
    ws.on('close', async () => {
      if (authenticatedAgent) {
        connectedAgents.delete(authenticatedAgent.id);
        await storage.updateAgentStatus(authenticatedAgent.id, 'offline');
      }
    });
    
    ws.on('error', (err) => {
      console.error('Agent WebSocket error:', err);
    });
  });

  // ============================================
  // ROTAS DE EMPRESAS (Server Admin Only)
  // ============================================
  
  const { isServerAdmin: isServerAdminMiddleware } = await import("./middleware/tenant");
  
  // Listar empresas
  app.get('/api/companies', isAuthenticated, isServerAdminMiddleware, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { companies } = await import("@shared/schema");
      const companyList = await db.select().from(companies).orderBy(companies.name);
      res.json(companyList);
    } catch (e) {
      console.error("Error listing companies:", e);
      res.status(500).json({ message: "Erro ao listar empresas" });
    }
  });
  
  // Criar empresa
  app.post('/api/companies', isAuthenticated, isServerAdminMiddleware, async (req, res) => {
    try {
      const { insertCompanySchema, companies } = await import("@shared/schema");
      const validated = insertCompanySchema.parse(req.body);
      const { db } = await import("./db");
      
      const [company] = await db.insert(companies).values({
        name: validated.name,
        slug: validated.slug,
        description: validated.description,
        logo: validated.logo,
        active: validated.active,
        maxUsers: validated.maxUsers,
        maxEquipment: validated.maxEquipment,
        maxAgents: validated.maxAgents,
      }).returning();
      res.status(201).json(company);
    } catch (e: any) {
      console.error("Error creating company:", e);
      if (e.name === 'ZodError') {
        return res.status(400).json({ message: "Dados inválidos", errors: e.errors });
      }
      res.status(500).json({ message: e.message || "Erro ao criar empresa" });
    }
  });
  
  // Atualizar empresa
  app.patch('/api/companies/:id', isAuthenticated, isServerAdminMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { updateCompanySchema, companies } = await import("@shared/schema");
      const validated = updateCompanySchema.parse(req.body);
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");
      
      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (validated.name !== undefined) updateData.name = validated.name;
      if (validated.slug !== undefined) updateData.slug = validated.slug;
      if (validated.description !== undefined) updateData.description = validated.description;
      if (validated.logo !== undefined) updateData.logo = validated.logo;
      if (validated.active !== undefined) updateData.active = validated.active;
      if (validated.maxUsers !== undefined) updateData.maxUsers = validated.maxUsers;
      if (validated.maxEquipment !== undefined) updateData.maxEquipment = validated.maxEquipment;
      if (validated.maxAgents !== undefined) updateData.maxAgents = validated.maxAgents;
      
      const [updated] = await db.update(companies)
        .set(updateData)
        .where(eq(companies.id, id))
        .returning();
        
      if (!updated) {
        return res.status(404).json({ message: "Empresa não encontrada" });
      }
      res.json(updated);
    } catch (e: any) {
      console.error("Error updating company:", e);
      if (e.name === 'ZodError') {
        return res.status(400).json({ message: "Dados inválidos", errors: e.errors });
      }
      res.status(500).json({ message: e.message || "Erro ao atualizar empresa" });
    }
  });
  
  // Deletar empresa
  app.delete('/api/companies/:id', isAuthenticated, isServerAdminMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { db } = await import("./db");
      const { companies, userCompanies } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      // Remove user associations first
      await db.delete(userCompanies).where(eq(userCompanies.companyId, id));
      
      await db.delete(companies).where(eq(companies.id, id));
      res.sendStatus(204);
    } catch (e) {
      console.error("Error deleting company:", e);
      res.status(500).json({ message: "Erro ao excluir empresa" });
    }
  });
  
  // Listar usuários de uma empresa
  app.get('/api/companies/:id/users', isAuthenticated, isServerAdminMiddleware, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const { db } = await import("./db");
      const { userCompanies, users } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const companyUsers = await db
        .select({
          id: userCompanies.id,
          userId: userCompanies.userId,
          companyId: userCompanies.companyId,
          role: userCompanies.role,
          isDefault: userCompanies.isDefault,
          user: {
            id: users.id,
            username: users.username,
            name: users.name,
            email: users.email,
          },
        })
        .from(userCompanies)
        .leftJoin(users, eq(userCompanies.userId, users.id))
        .where(eq(userCompanies.companyId, companyId));
        
      res.json(companyUsers);
    } catch (e) {
      console.error("Error listing company users:", e);
      res.status(500).json({ message: "Erro ao listar usuários da empresa" });
    }
  });
  
  // Adicionar usuário a uma empresa
  app.post('/api/companies/:id/users', isAuthenticated, isServerAdminMiddleware, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const { username, role } = req.body;
      
      if (!username) {
        return res.status(400).json({ message: "Username é obrigatório" });
      }
      
      const { db } = await import("./db");
      const { users, userCompanies } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      
      // Find user by username
      const [user] = await db.select().from(users).where(eq(users.username, username));
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Check if already associated
      const [existing] = await db.select().from(userCompanies)
        .where(and(
          eq(userCompanies.userId, user.id),
          eq(userCompanies.companyId, companyId)
        ));
        
      if (existing) {
        return res.status(400).json({ message: "Usuário já está vinculado a esta empresa" });
      }
      
      // Check if user has any company
      const userCompanyList = await db.select().from(userCompanies)
        .where(eq(userCompanies.userId, user.id));
      
      const isDefault = userCompanyList.length === 0;
      
      const [created] = await db.insert(userCompanies).values({
        userId: user.id,
        companyId,
        role: role || 'admin',
        isDefault,
      }).returning();
      
      res.status(201).json(created);
    } catch (e: any) {
      console.error("Error adding user to company:", e);
      res.status(500).json({ message: e.message || "Erro ao adicionar usuário" });
    }
  });
  
  // Remover usuário de uma empresa
  app.delete('/api/companies/:id/users/:userId', isAuthenticated, isServerAdminMiddleware, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const userId = parseInt(req.params.userId);
      
      const { db } = await import("./db");
      const { userCompanies } = await import("@shared/schema");
      const { and, eq } = await import("drizzle-orm");
      
      // Check if this is the user's only company
      const userCompanyList = await db.select().from(userCompanies)
        .where(eq(userCompanies.userId, userId));
      
      if (userCompanyList.length <= 1) {
        return res.status(400).json({ 
          message: "Não é possível remover o usuário da única empresa associada. Adicione-o a outra empresa primeiro." 
        });
      }
      
      // If removing from default company, set another as default
      const currentAssoc = userCompanyList.find(uc => uc.companyId === companyId);
      if (currentAssoc?.isDefault) {
        const newDefault = userCompanyList.find(uc => uc.companyId !== companyId);
        if (newDefault) {
          await db.update(userCompanies)
            .set({ isDefault: true })
            .where(eq(userCompanies.id, newDefault.id));
        }
      }
      
      await db.delete(userCompanies)
        .where(and(
          eq(userCompanies.userId, userId),
          eq(userCompanies.companyId, companyId)
        ));
        
      res.sendStatus(204);
    } catch (e) {
      console.error("Error removing user from company:", e);
      res.status(500).json({ message: "Erro ao remover usuário" });
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
  const storedScripts = await storage.getVendorScriptsByManufacturer(manufacturer);
  console.log(`[getBackupConfig] Found ${storedScripts.length} scripts for ${manufacturer}:`, storedScripts.map(s => ({ id: s.id, name: s.name })));
  const backupScript = storedScripts.find(s => s.name.toLowerCase().includes('backup'));
  if (backupScript) {
    console.log(`[getBackupConfig] Using script ID ${backupScript.id}: "${backupScript.name}" with command: ${backupScript.command.substring(0, 100)}...`);
    return {
      command: backupScript.command,
      extension: backupScript.fileExtension || '.cfg',
      useShell: backupScript.useShell ?? true,
      timeout: backupScript.timeout || 30000,
    };
  }
  console.log(`[getBackupConfig] No backup script found, using default for ${manufacturer}`);
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

// Remove ANSI escape codes from output
function cleanAnsiCodes(str: string): string {
  return str
    // Remove ESC sequences (starts with \x1B or \033)
    .replace(/\x1B\[[0-9;]*[A-Za-z]/g, '')  // CSI sequences like ESC[1m, ESC[0;32m
    .replace(/\x1B\][^\x07]*\x07/g, '')      // OSC sequences
    .replace(/\x1B[PX^_][^\x1B]*\x1B\\/g, '') // DCS, SOS, PM, APC sequences
    .replace(/\x1B[@-Z\\^_]/g, '')           // Single character sequences
    // Remove raw escape codes that appear as text
    .replace(/\[\??\d+[hlKJnm]/g, '')        // Terminal control codes as text
    .replace(/\[[\d;]*[HfABCDsu]/g, '')      // Cursor position/movement codes
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '')
    // Remove null bytes
    .replace(/\x00/g, '');
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
            resolve(cleanAnsiCodes(output));
          }, config.timeout || 30000);

          stream.on('data', (data: Buffer) => {
            output += data.toString();
            
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
              cleanup();
              resolve(cleanAnsiCodes(output));
            }, 5000);
          });

          stream.on('close', () => {
            cleanup();
            resolve(cleanAnsiCodes(output));
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
