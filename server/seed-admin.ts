/**
 * Polly - Initial Admin Seeder
 * Creates the default admin account on first start.
 * Can be used standalone (npx tsx server/seed-admin.ts) or imported.
 */

import { db } from "./db";
import { users } from "@shared/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

const INITIAL_ADMIN = {
  username: "admin",
  email: "admin@polly.local",
  password: "Admin123!",
  name: "Initial Administrator",
};

export async function seedInitialAdmin() {
  try {
    const existingAdmin = await db.select().from(users).where(eq(users.username, INITIAL_ADMIN.username)).limit(1);
    
    if (existingAdmin.length > 0) {
      console.log("[Admin Seed] Admin already exists, skipping.");
      return;
    }

    const passwordHash = await bcrypt.hash(INITIAL_ADMIN.password, 10);
    
    await db.insert(users).values({
      username: INITIAL_ADMIN.username,
      email: INITIAL_ADMIN.email,
      name: INITIAL_ADMIN.name,
      passwordHash,
      role: "admin",
      provider: "local",
      isInitialAdmin: true,
    });

    console.log("[Admin Seed] Initial admin created successfully");
    console.log("[Admin Seed] Username: " + INITIAL_ADMIN.username);
    console.log("[Admin Seed] Password: " + INITIAL_ADMIN.password);
    console.log("[Admin Seed] Please change these credentials after first login!");
    
  } catch (error) {
    console.error("[Admin Seed] Error:", error);
    throw error;
  }
}

if (require.main === module || process.argv[1]?.endsWith('seed-admin.ts')) {
  seedInitialAdmin()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
