import { Router } from "express";
import { storage } from "../storage";
import { isServerAdmin, requireServerPermission, requireSuperAdmin } from "../middleware/tenant";
import { insertCompanySchema, insertServerAdminSchema } from "@shared/schema";
import { z } from "zod";

const validMaintenanceActions = ["status_check", "restart", "update", "logs", "clear_cache"];

export function createServerRoutes(isAuthenticated: any): Router {
  const router = Router();

  router.get("/check-admin", isAuthenticated, async (req, res) => {
    try {
      const tenantUser = req.tenantUser;
      if (!tenantUser) {
        return res.status(401).json({ isServerAdmin: false, serverRole: null, message: "User not authenticated" });
      }
      
      const userCompanies = tenantUser.companies || [];
      
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
