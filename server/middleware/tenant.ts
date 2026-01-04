import { RequestHandler } from "express";
import { db } from "../db";
import { users, serverAdmins, userCompanies, companies } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const isStandalone = !process.env.REPL_ID;

export interface TenantUser {
  id: number;
  username: string;
  name: string | null;
  email: string | null;
  isServerAdmin: boolean;
  serverRole: string | null;
  serverPermissions: any;
  activeCompanyId: number | null;
  activeCompanyRole: string | null;
  companies: Array<{
    companyId: number;
    companyName: string;
    role: string;
  }>;
}

declare global {
  namespace Express {
    interface Request {
      tenantUser?: TenantUser;
      companyId?: number;
    }
  }
}

async function getUserFromRequest(req: any): Promise<{ userId: number } | null> {
  if (isStandalone) {
    const sessionUser = (req.session as any)?.user;
    if (!sessionUser?.id) return null;
    return { userId: sessionUser.id };
  } else {
    const user = req.user as any;
    const userSub = user?.claims?.sub;
    if (!userSub) return null;
    
    const [dbUser] = await db.select().from(users).where(eq(users.replitId, userSub));
    if (!dbUser) return null;
    return { userId: dbUser.id };
  }
}

export async function loadTenantUser(userId: number): Promise<TenantUser | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return null;

  const [serverAdmin] = await db.select().from(serverAdmins).where(eq(serverAdmins.userId, userId));
  
  const userCompanyList = await db
    .select({
      companyId: userCompanies.companyId,
      role: userCompanies.role,
      isDefault: userCompanies.isDefault,
      companyName: companies.name,
    })
    .from(userCompanies)
    .leftJoin(companies, eq(userCompanies.companyId, companies.id))
    .where(eq(userCompanies.userId, userId));

  const defaultCompany = userCompanyList.find((uc) => uc.isDefault);
  
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    isServerAdmin: !!serverAdmin,
    serverRole: serverAdmin?.role || null,
    serverPermissions: serverAdmin?.permissions || null,
    activeCompanyId: defaultCompany?.companyId || userCompanyList[0]?.companyId || null,
    activeCompanyRole: defaultCompany?.role || userCompanyList[0]?.role || null,
    companies: userCompanyList.map((uc) => ({
      companyId: uc.companyId,
      companyName: uc.companyName || "",
      role: uc.role,
    })),
  };
}

function logCrossTenantAccess(
  userId: number,
  username: string,
  requestedCompanyId: number,
  action: string,
  method: string,
  path: string
) {
  const timestamp = new Date().toISOString();
  console.log(
    `[AUDIT:CROSS_TENANT] ${timestamp} | User: ${userId} (${username}) | ` +
    `Action: ${action} | Company: ${requestedCompanyId} | ` +
    `Request: ${method} ${path}`
  );
}

export const withTenantContext: RequestHandler = async (req, res, next) => {
  try {
    const userInfo = await getUserFromRequest(req);
    if (!userInfo) {
      return next();
    }

    const tenantUser = await loadTenantUser(userInfo.userId);
    if (tenantUser) {
      req.tenantUser = tenantUser;
      
      const companyIdFromHeader = req.headers["x-company-id"];
      if (companyIdFromHeader) {
        const requestedCompanyId = parseInt(companyIdFromHeader as string);
        const userHasDirectAccess = tenantUser.companies.some((c) => c.companyId === requestedCompanyId);
        
        if (tenantUser.isServerAdmin && !userHasDirectAccess) {
          logCrossTenantAccess(
            tenantUser.id,
            tenantUser.username,
            requestedCompanyId,
            "SERVER_ADMIN_ACCESS",
            req.method,
            req.path
          );
        }
        
        if (tenantUser.isServerAdmin || userHasDirectAccess) {
          req.companyId = requestedCompanyId;
        }
      } else if (tenantUser.activeCompanyId) {
        req.companyId = tenantUser.activeCompanyId;
      }
    }
    
    next();
  } catch (e) {
    console.error("Error loading tenant context:", e);
    next();
  }
};

export const isServerAdmin: RequestHandler = async (req, res, next) => {
  try {
    const userInfo = await getUserFromRequest(req);
    if (!userInfo) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const [serverAdmin] = await db
      .select()
      .from(serverAdmins)
      .where(eq(serverAdmins.userId, userInfo.userId));

    if (!serverAdmin) {
      return res.status(403).json({ message: "Access denied. Server admin required." });
    }

    next();
  } catch (e) {
    console.error("Error checking server admin:", e);
    res.status(500).json({ message: "Internal error" });
  }
};

export const requireCompanyAccess = (minRole?: string): RequestHandler => {
  return async (req, res, next) => {
    try {
      const userInfo = await getUserFromRequest(req);
      if (!userInfo) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const tenantUser = req.tenantUser || (await loadTenantUser(userInfo.userId));
      if (!tenantUser) {
        return res.status(401).json({ message: "User not found" });
      }

      if (tenantUser.isServerAdmin) {
        return next();
      }

      const companyIdParam = req.params.companyId;
      const companyId = companyIdParam ? parseInt(companyIdParam) : req.companyId;
      
      if (!companyId) {
        return res.status(400).json({ message: "Company ID required" });
      }

      const userCompany = tenantUser.companies.find((c) => c.companyId === companyId);
      if (!userCompany) {
        return res.status(403).json({ message: "Access denied to this company" });
      }

      const roleHierarchy = ["viewer", "operator", "company_admin"];
      if (minRole) {
        const userRoleIndex = roleHierarchy.indexOf(userCompany.role);
        const minRoleIndex = roleHierarchy.indexOf(minRole);
        if (userRoleIndex < minRoleIndex) {
          return res.status(403).json({ message: `Minimum role required: ${minRole}` });
        }
      }

      req.companyId = companyId;
      next();
    } catch (e) {
      console.error("Error checking company access:", e);
      res.status(500).json({ message: "Internal error" });
    }
  };
};

export const requireSuperAdmin: RequestHandler = async (req, res, next) => {
  try {
    const userInfo = await getUserFromRequest(req);
    if (!userInfo) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const [serverAdmin] = await db
      .select()
      .from(serverAdmins)
      .where(eq(serverAdmins.userId, userInfo.userId));

    if (!serverAdmin) {
      return res.status(403).json({ message: "Super Administrator access required" });
    }

    if (serverAdmin.role !== "server_admin") {
      return res.status(403).json({ 
        message: "Only Super Administrators can perform this action" 
      });
    }

    next();
  } catch (e) {
    console.error("Error checking super admin:", e);
    res.status(500).json({ message: "Internal error" });
  }
};

export const requireServerPermission = (permission: string): RequestHandler => {
  return async (req, res, next) => {
    try {
      const userInfo = await getUserFromRequest(req);
      if (!userInfo) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const [serverAdmin] = await db
        .select()
        .from(serverAdmins)
        .where(eq(serverAdmins.userId, userInfo.userId));

      if (!serverAdmin) {
        return res.status(403).json({ message: "Server admin required" });
      }

      if (serverAdmin.role === "server_admin") {
        return next();
      }

      const permissions = serverAdmin.permissions as any;
      if (!permissions || !permissions[permission]) {
        return res.status(403).json({ message: `Permission required: ${permission}` });
      }

      next();
    } catch (e) {
      console.error("Error checking permission:", e);
      res.status(500).json({ message: "Internal error" });
    }
  };
};
