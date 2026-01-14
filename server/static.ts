import express, { type Express, type Request, type Response } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // In production, dist/index.cjs runs from project root
  // Try multiple paths to find the public directory
  let distPath = path.resolve(process.cwd(), "dist", "public");
  
  // Fallback to __dirname relative path if process.cwd doesn't work
  if (!fs.existsSync(distPath)) {
    distPath = path.resolve(__dirname, "public");
  }
  
  // Another fallback for when running from dist directory
  if (!fs.existsSync(distPath)) {
    distPath = path.resolve(__dirname, "..", "dist", "public");
  }
  
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  console.log(`[static] Serving static files from: ${distPath}`);

  // Read index.html once at startup
  const indexPath = path.resolve(distPath, "index.html");
  const indexHtml = fs.readFileSync(indexPath, 'utf-8');

  // Serve static files with custom cache headers
  app.use(express.static(distPath, { 
    fallthrough: true,
    index: false,
    maxAge: '1y',
    immutable: true,
    setHeaders: (res, filePath) => {
      // HTML files should never be cached
      if (path.extname(filePath) === '.html') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  }));

  // SPA fallback - serve index.html for all navigation requests
  app.use("*", (req: Request, res: Response) => {
    const reqPath = req.path || req.originalUrl;
    // Don't serve index.html for asset requests (files with extensions)
    if (reqPath.includes('.') || reqPath.startsWith('/assets/')) {
      res.status(404).send('Not found');
      return;
    }
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(indexHtml);
  });
}
