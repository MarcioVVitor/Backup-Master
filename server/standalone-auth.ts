import { Express, RequestHandler } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db } from "./db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";
import crypto from "crypto";

let sharedSessionMiddleware: RequestHandler | null = null;

export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
}

export function generateSalt(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function getSession(): RequestHandler {
  if (sharedSessionMiddleware) {
    return sharedSessionMiddleware;
  }
  
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  sharedSessionMiddleware = session({
    secret: process.env.SESSION_SECRET || "nbm-default-secret-change-me",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" && process.env.STANDALONE !== "true",
      maxAge: sessionTtl,
    },
  });
  
  return sharedSessionMiddleware;
}

export async function setupStandaloneAuth(app: Express) {
  console.log("[standalone-auth] Setting up standalone authentication routes");
  app.set("trust proxy", 1);
  app.use(getSession());

  app.post("/api/auth/login", async (req, res) => {
    console.log("[standalone-auth] POST /api/auth/login received");
    const { username, password } = req.body;
    console.log("[standalone-auth] Login attempt for user:", username);
    
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }
    
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      
      if (!user || !user.passwordHash || !user.passwordSalt) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      const hash = hashPassword(password, user.passwordSalt);
      if (hash !== user.passwordHash) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      (req.session as any).user = {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
      };
      
      res.json({ 
        message: "Login successful",
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          isAdmin: user.isAdmin,
        }
      });
    } catch (error: any) {
      console.error("Login error:", error);
      const errorMessage = error?.message || error?.toString() || "Internal server error";
      res.status(500).json({ message: errorMessage });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    const { username, password, name, email } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }
    
    try {
      const [existing] = await db.select().from(users).where(eq(users.username, username));
      if (existing) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      const allUsers = await db.select().from(users);
      const isFirstUser = allUsers.length === 0;
      
      const salt = generateSalt();
      const hash = hashPassword(password, salt);
      
      const [user] = await db.insert(users).values({
        username,
        name: name || username,
        email: email || null,
        passwordHash: hash,
        passwordSalt: salt,
        isAdmin: isFirstUser ? true : false,
        replitId: `local-${crypto.randomUUID()}`,
      }).returning();
      
      (req.session as any).user = {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
      };
      
      res.json({ 
        message: isFirstUser ? "Admin account created" : "Account created",
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          isAdmin: user.isAdmin,
        }
      });
    } catch (error: any) {
      console.error("Register error:", error);
      const errorMessage = error?.message || error?.toString() || "Internal server error";
      res.status(500).json({ message: errorMessage });
    }
  });

  app.get("/api/auth/user", (req, res) => {
    const user = (req.session as any)?.user;
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out" });
    });
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  const user = (req.session as any)?.user;
  if (user) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

export const isAdmin: RequestHandler = (req, res, next) => {
  const user = (req.session as any)?.user;
  if (user?.isAdmin) {
    return next();
  }
  res.status(403).json({ message: "Forbidden" });
};
