import { Router } from "express";
import { storage } from "../storage";
import { isServerAdmin, requireServerPermission, requireSuperAdmin } from "../middleware/tenant";
import { insertCompanySchema, insertServerAdminSchema } from "@shared/schema";
import { z } from "zod";

const validMaintenanceActions = ["status_check", "restart", "update", "logs", "clear_cache"];

export function createServerRoutes(isAuthenticated: any): Router {
  const router = Router();

  // Debug endpoint without auth middleware to compare
  router.get("/debug-session", (req, res) => {
    const user = req.user as any;
    res.json({
      path: req.path,
      hasCookie: !!req.headers.cookie,
      cookieHeader: req.headers.cookie?.substring(0, 50) + '...',
      sessionId: req.sessionID?.substring(0, 8) + '...',
      isAuthenticated: req.isAuthenticated?.() || false,
      hasUser: !!user,
      userSub: user?.claims?.sub || null,
      expiresAt: user?.expires_at || null,
    });
  });

  router.get("/check-admin", async (req, res) => {
    try {
      // Log session state for debugging
      const user = req.user as any;
      console.log("[check-admin] Session state:", {
        isAuthenticated: req.isAuthenticated?.() || false,
        hasUser: !!user,
        userSub: user?.claims?.sub,
        expiresAt: user?.expires_at,
      });

      // Manual auth check instead of middleware
      if (!req.isAuthenticated?.() || !user?.expires_at) {
        return res.json({ isServerAdmin: false, serverRole: null, notAuthenticated: true });
      }

      const { loadTenantUser } = await import("../middleware/tenant");
      const { db } = await import("../db");
      const { users, serverAdmins } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      // Debug: Check user and server_admins directly
      const [dbUser] = await db.select().from(users).where(eq(users.replitId, user.claims.sub));
      
      let debugServerAdmin = null;
      if (dbUser) {
        const [serverAdmin] = await db.select().from(serverAdmins).where(eq(serverAdmins.userId, dbUser.id));
        debugServerAdmin = serverAdmin;
      }
      
      // Return debug info temporarily
      if (req.query.debug === 'true') {
        // Also get all server_admins for debugging
        const allServerAdmins = await db.select().from(serverAdmins);
        return res.json({
          userSub: user.claims.sub,
          dbUser: dbUser ? { id: dbUser.id, username: dbUser.username, replitId: dbUser.replitId } : null,
          serverAdmin: debugServerAdmin,
          allServerAdmins: allServerAdmins,
        });
      }
      
      // Bootstrap: If no server_admins exist and this is the first user, make them admin
      const allServerAdmins = await db.select().from(serverAdmins);
      if (allServerAdmins.length === 0 && dbUser) {
        // No admins exist - make this user the first server admin
        const [newAdmin] = await db.insert(serverAdmins).values({
          userId: dbUser.id,
          role: 'super_admin',
          permissions: { all: true } as any,
        }).returning();
        console.log(`[BOOTSTRAP] Created first server admin: ${dbUser.username} (id: ${dbUser.id})`);
        debugServerAdmin = newAdmin;
      }
      
      let tenantUser = req.tenantUser;
      
      // If tenantUser not loaded by global middleware, load it now
      if (!tenantUser) {
        const user = req.user as any;
        let userId: number | null = null;
        
        // Check Replit Auth
        if (user?.claims?.sub) {
          const [dbUser] = await db.select().from(users).where(eq(users.replitId, user.claims.sub));
          if (dbUser) userId = dbUser.id;
        }
        // Check standalone auth
        else if ((req.session as any)?.user?.id) {
          userId = (req.session as any).user.id;
        }
        
        if (userId) {
          tenantUser = await loadTenantUser(userId) ?? undefined;
        }
      }
      
      if (!tenantUser) {
        const user = req.user as any;
        console.log("[check-admin] No tenantUser found");
        console.log("[check-admin] req.user:", JSON.stringify(user));
        console.log("[check-admin] claims.sub:", user?.claims?.sub);
        
        // Try to find the user in DB
        const allUsers = await db.select().from(users);
        console.log("[check-admin] Users in DB:", allUsers.map(u => ({ id: u.id, username: u.username, replitId: u.replitId })));
        
        return res.status(401).json({ isServerAdmin: false, serverRole: null, message: "User not authenticated" });
      }
      
      const userCompanies = tenantUser.companies || [];
      
      console.log(`[check-admin] User ${tenantUser.username} isServerAdmin: ${tenantUser.isServerAdmin}`);
      
      res.json({
        isServerAdmin: tenantUser.isServerAdmin || false,
        serverRole: tenantUser.serverRole || null,
        userCompanies: userCompanies.map((uc: { companyId: number; companyName: string; role: string }) => ({
          companyId: uc.companyId,
          companyName: uc.companyName,
          role: uc.role,
        })),
      });
    } catch (e) {
      console.error("Error checking admin status:", e);
      res.status(500).json({ isServerAdmin: false, serverRole: null, message: "Internal error" });
    }
  });

  router.get("/companies", isAuthenticated, isServerAdmin, async (req, res) => {
    try {
      const companiesList = await storage.getCompanies();
      res.json(companiesList);
    } catch (e) {
      console.error("Error listing companies:", e);
      res.status(500).json({ message: "Error listing companies" });
    }
  });

  router.get("/companies/:id", isAuthenticated, isServerAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const company = await storage.getCompanyById(id);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json(company);
    } catch (e) {
      console.error("Error getting company:", e);
      res.status(500).json({ message: "Error getting company" });
    }
  });

  const proxySchema = z.object({
    name: z.string().min(2),
    siteName: z.string().min(2),
    ipAddress: z.string().optional(),
    description: z.string().optional(),
  });

  const createCompanyWithProxiesSchema = insertCompanySchema.extend({
    proxies: z.array(proxySchema).optional(),
  });

  router.post("/companies", isAuthenticated, requireServerPermission("canCreateCompanies"), async (req, res) => {
    try {
      const parsed = createCompanyWithProxiesSchema.parse(req.body);
      const { proxies, ...companyData } = parsed;
      
      const existing = await storage.getCompanyBySlug(companyData.slug);
      if (existing) {
        return res.status(400).json({ message: "Company slug already exists" });
      }
      
      const company = await storage.createCompany(companyData);
      
      const createdProxies = [];
      const failedProxies = [];
      
      if (proxies && proxies.length > 0) {
        const uniqueProxies = proxies.filter((proxy, index, self) => 
          index === self.findIndex(p => p.name === proxy.name)
        );
        
        for (const proxy of uniqueProxies) {
          try {
            const agent = await storage.createAgent({
              companyId: company.id,
              name: proxy.name,
              siteName: proxy.siteName,
              ipAddress: proxy.ipAddress || null,
              description: proxy.description || null,
            });
            createdProxies.push(agent);
          } catch (proxyError) {
            console.error(`Error creating proxy ${proxy.name}:`, proxyError);
            failedProxies.push({ name: proxy.name, error: "Failed to create" });
          }
        }
      }
      
      res.status(201).json({ 
        ...company, 
        proxies: createdProxies,
        proxiesCreated: createdProxies.length,
        failedProxies: failedProxies.length > 0 ? failedProxies : undefined
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: e.errors });
      }
      console.error("Error creating company:", e);
      res.status(500).json({ message: "Error creating company" });
    }
  });

  router.put("/companies/:id", isAuthenticated, isServerAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const parsed = insertCompanySchema.partial().parse(req.body);
      const company = await storage.updateCompany(id, parsed);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json(company);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: e.errors });
      }
      console.error("Error updating company:", e);
      res.status(500).json({ message: "Error updating company" });
    }
  });

  router.delete("/companies/:id", isAuthenticated, requireServerPermission("canDeleteCompanies"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCompany(id);
      res.status(204).send();
    } catch (e) {
      console.error("Error deleting company:", e);
      res.status(500).json({ message: "Error deleting company" });
    }
  });

  router.get("/agents", isAuthenticated, isServerAdmin, async (req, res) => {
    try {
      const agentsList = await storage.getAllAgentsWithCompany();
      res.json(agentsList);
    } catch (e) {
      console.error("Error listing all agents:", e);
      res.status(500).json({ message: "Error listing agents" });
    }
  });

  router.post("/agents/:id/restart", isAuthenticated, requireServerPermission("canRestartProxies"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const agent = await storage.getAgentById(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      
      const job = await storage.createAgentJob({
        agentId: id,
        jobType: "admin",
        priority: 10,
        payload: { command: "restart", timeout: 60000 },
      });
      
      res.json({ message: "Restart command queued", jobId: job.id });
    } catch (e) {
      console.error("Error restarting agent:", e);
      res.status(500).json({ message: "Error restarting agent" });
    }
  });

  router.post("/agents/:id/maintenance", isAuthenticated, requireServerPermission("canPerformMaintenance"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { action } = req.body;
      
      if (!action || !validMaintenanceActions.includes(action)) {
        return res.status(400).json({ 
          message: "Invalid maintenance action", 
          validActions: validMaintenanceActions 
        });
      }
      
      const agent = await storage.getAgentById(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      
      const job = await storage.createAgentJob({
        agentId: id,
        jobType: "admin",
        priority: 10,
        payload: { command: action, timeout: 120000 },
      });
      
      res.json({ message: "Maintenance command queued", jobId: job.id });
    } catch (e) {
      console.error("Error performing maintenance:", e);
      res.status(500).json({ message: "Error performing maintenance" });
    }
  });

  router.get("/admins", isAuthenticated, isServerAdmin, async (req, res) => {
    try {
      const admins = await storage.getServerAdminsWithUserInfo();
      res.json(admins);
    } catch (e) {
      console.error("Error listing admins:", e);
      res.status(500).json({ message: "Error listing admins" });
    }
  });

  router.get("/users", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const usersList = await storage.getAllUsers();
      res.json(usersList);
    } catch (e) {
      console.error("Error listing users:", e);
      res.status(500).json({ message: "Error listing users" });
    }
  });

  router.post("/admins", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const parsed = insertServerAdminSchema.parse(req.body);
      
      const existingAdmins = await storage.getServerAdmins();
      const alreadyAdmin = existingAdmins.some(a => a.userId === parsed.userId);
      if (alreadyAdmin) {
        return res.status(400).json({ message: "User is already a Super Administrator" });
      }
      
      const admin = await storage.createServerAdmin(parsed);
      res.status(201).json(admin);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: e.errors });
      }
      console.error("Error creating admin:", e);
      res.status(500).json({ message: "Error creating admin" });
    }
  });

  router.delete("/admins/:id", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const existingAdmins = await storage.getServerAdmins();
      const superAdmins = existingAdmins.filter(a => a.role === "server_admin");
      
      const adminToDelete = existingAdmins.find(a => a.id === id);
      if (!adminToDelete) {
        return res.status(404).json({ message: "Administrator not found" });
      }
      
      if (adminToDelete.role === "server_admin" && superAdmins.length <= 1) {
        return res.status(400).json({ 
          message: "Cannot remove the last Super Administrator" 
        });
      }
      
      await storage.deleteServerAdmin(id);
      res.status(204).send();
    } catch (e) {
      console.error("Error deleting admin:", e);
      res.status(500).json({ message: "Error deleting admin" });
    }
  });

  router.patch("/admins/:id", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { role } = req.body;
      
      if (!role || !["server_admin", "support_engineer"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const existingAdmins = await storage.getServerAdmins();
      const adminToUpdate = existingAdmins.find(a => a.id === id);
      
      if (!adminToUpdate) {
        return res.status(404).json({ message: "Administrator not found" });
      }

      if (adminToUpdate.role === "server_admin" && role !== "server_admin") {
        const superAdmins = existingAdmins.filter(a => a.role === "server_admin");
        if (superAdmins.length <= 1) {
          return res.status(400).json({ 
            message: "Cannot change role of the last Super Administrator" 
          });
        }
      }
      
      const admin = await storage.updateServerAdmin(id, { role });
      res.json(admin);
    } catch (e) {
      console.error("Error updating admin:", e);
      res.status(500).json({ message: "Error updating admin" });
    }
  });

  router.get("/stats", isAuthenticated, isServerAdmin, async (req, res) => {
    try {
      const companiesList = await storage.getCompanies();
      const agentsList = await storage.getAllAgentsWithCompany();
      
      const onlineAgents = agentsList.filter(a => a.status === "online").length;
      const offlineAgents = agentsList.filter(a => a.status === "offline").length;
      
      res.json({
        totalCompanies: companiesList.length,
        activeCompanies: companiesList.filter(c => c.active).length,
        totalAgents: agentsList.length,
        onlineAgents,
        offlineAgents,
        agentsByStatus: {
          online: onlineAgents,
          offline: offlineAgents,
          error: agentsList.filter(a => a.status === "error").length,
        },
      });
    } catch (e) {
      console.error("Error getting server stats:", e);
      res.status(500).json({ message: "Error getting stats" });
    }
  });

  return router;
}
