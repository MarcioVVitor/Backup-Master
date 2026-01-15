import * as fs from "fs";
import * as path from "path";

const BACKUP_DIR = process.env.LOCAL_BACKUP_DIR || "/opt/nbm/backups";

// Ensure backup directory exists on startup
try {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`[local-storage] Created backup directory: ${BACKUP_DIR}`);
  }
} catch (err: any) {
  console.error(`[local-storage] Error creating backup directory: ${err.message}`);
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[local-storage] Created directory: ${dir}`);
  }
}

function sanitizePath(objectName: string): string {
  const sanitized = objectName
    .replace(/\.\./g, "")
    .replace(/[<>:"|?*]/g, "")
    .replace(/^\/+/, "");
  
  const resolved = path.resolve(BACKUP_DIR, sanitized);
  if (!resolved.startsWith(path.resolve(BACKUP_DIR))) {
    throw new Error("Invalid file path - directory traversal detected");
  }
  
  return sanitized;
}

function getCompanyPath(companyId: number, objectName: string): string {
  const sanitized = sanitizePath(objectName);
  return path.join(`company_${companyId}`, sanitized);
}

export const localStorageClient = {
  async saveFile(objectName: string, content: Buffer | string, companyId?: number): Promise<void> {
    const safePath = companyId ? getCompanyPath(companyId, objectName) : sanitizePath(objectName);
    const filePath = path.join(BACKUP_DIR, safePath);
    const dir = path.dirname(filePath);
    
    console.log(`[local-storage] Saving file: ${filePath}`);
    console.log(`[local-storage]   - Content size: ${typeof content === 'string' ? content.length : content.length} bytes`);
    console.log(`[local-storage]   - Company ID: ${companyId || 'none'}`);
    
    ensureDir(dir);
    
    try {
      fs.writeFileSync(filePath, content);
      console.log(`[local-storage] ✓ File saved successfully: ${filePath}`);
    } catch (err: any) {
      console.error(`[local-storage] ✗ Error saving file: ${err.message}`);
      throw err;
    }
  },

  async readFile(objectName: string, companyId?: number): Promise<Buffer> {
    const safePath = companyId ? getCompanyPath(companyId, objectName) : sanitizePath(objectName);
    const filePath = path.join(BACKUP_DIR, safePath);
    
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(BACKUP_DIR))) {
      throw new Error("Invalid file path");
    }
    
    if (!fs.existsSync(filePath)) {
      throw new Error("File not found");
    }
    return fs.readFileSync(filePath);
  },

  async deleteFile(objectName: string, companyId?: number): Promise<void> {
    const safePath = companyId ? getCompanyPath(companyId, objectName) : sanitizePath(objectName);
    const filePath = path.join(BACKUP_DIR, safePath);
    
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(BACKUP_DIR))) {
      throw new Error("Invalid file path");
    }
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  },

  async fileExists(objectName: string, companyId?: number): Promise<boolean> {
    const safePath = companyId ? getCompanyPath(companyId, objectName) : sanitizePath(objectName);
    const filePath = path.join(BACKUP_DIR, safePath);
    return fs.existsSync(filePath);
  },

  getFilePath(objectName: string, companyId?: number): string {
    const safePath = companyId ? getCompanyPath(companyId, objectName) : sanitizePath(objectName);
    return path.join(BACKUP_DIR, safePath);
  },

  getBackupDir(): string {
    return BACKUP_DIR;
  },
};

export function isLocalStorageMode(): boolean {
  return !process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
}
