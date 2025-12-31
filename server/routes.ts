import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import multer from "multer";
import { setupAuth } from "./replit_integrations/auth"; 
import { ObjectStorageService } from "./replit_integrations/object_storage";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const requireAuth = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };

  app.get(api.user.me.path, (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).json(null);
    }
  });

  app.get(api.files.list.path, requireAuth, async (req, res) => {
    const files = await storage.getFiles((req.user as any).id);
    res.json(files);
  });

  app.post(api.files.upload.path, requireAuth, upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) throw new Error("Bucket ID not set");
    
    const objectName = `${(req.user as any).id}/${Date.now()}-${req.file.originalname}`;
    const bucket = objectStorageClient.bucket(bucketId);
    const file = bucket.file(objectName);
    
    await file.save(req.file.buffer, {
      contentType: req.file.mimetype,
      metadata: {
        userId: (req.user as any).id,
        originalName: req.file.originalname,
      }
    });

    const fileRecord = await storage.createFile({
      userId: (req.user as any).id,
      filename: req.file.originalname,
      objectName: objectName,
      size: req.file.size,
      mimeType: req.file.mimetype,
    });

    res.status(201).json(fileRecord);
  });

  app.get('/api/files/:id/download', requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const fileRecord = await storage.getFile(id);
     
    if (!fileRecord) return res.status(404).send("File not found");
    if (fileRecord.userId !== (req.user as any).id) return res.status(403).send("Forbidden");

    const { objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    const bucket = objectStorageClient.bucket(bucketId!);
    const file = bucket.file(fileRecord.objectName);
    
    const [exists] = await file.exists();
    if (!exists) return res.status(404).send("File content not found");

    const [buffer] = await file.download();
    
    res.setHeader('Content-Type', fileRecord.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileRecord.filename}"`);
    res.send(buffer);
  });

  app.delete(api.files.delete.path, requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const fileRecord = await storage.getFile(id);
    if (!fileRecord) return res.status(404).json({message: "Not found"});
    if (fileRecord.userId !== (req.user as any).id) return res.status(403).json({message: "Forbidden"});

    const { objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    const bucket = objectStorageClient.bucket(bucketId!);
    const file = bucket.file(fileRecord.objectName);
    
    try {
      await file.delete();
    } catch (e) {
      console.warn("Failed to delete object", e);
    }
    
    await storage.deleteFile(id);
    res.sendStatus(204);
  });

  return httpServer;
}
