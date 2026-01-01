import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq } from "drizzle-orm";

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(replitId: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(replitId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.replitId, replitId));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Check if user exists
    if (userData.replitId) {
      const existing = await this.getUser(userData.replitId);
      if (existing) {
        // Update existing user
        const [user] = await db
          .update(users)
          .set({
            username: userData.username,
            name: userData.name,
            email: userData.email,
          })
          .where(eq(users.replitId, userData.replitId))
          .returning();
        return user;
      }
    }
    
    // Insert new user
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }
}

export const authStorage = new AuthStorage();
