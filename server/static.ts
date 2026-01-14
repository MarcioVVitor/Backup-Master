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

  // Serve static files with fallthrough disabled so 404s are handled properly
  app.use(express.static(distPath, { 
    fallthrough: true,
    index: false 
  }));

  // SPA fallback - only for navigation requests, not for static assets
  app.use("*", (req: Request, res: Response) => {
    // Don't serve index.html for asset requests (files with extensions)
    const reqPath = req.path || req.originalUrl;
    if (reqPath.includes('.') || reqPath.startsWith('/assets/')) {
      // This is a static file request that wasn't found
      res.status(404).send('Not found');
      return;
    }
    
    // Read and send index.html with explicit cache headers
    const indexPath = path.resolve(distPath, "index.html");
    const html = fs.readFileSync(indexPath, 'utf-8');
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    res.send(html);
  });
}
