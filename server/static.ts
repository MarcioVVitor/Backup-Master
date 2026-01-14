import express, { type Express } from "express";
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

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
