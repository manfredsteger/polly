/**
 * Polly - Initial Admin Seeder
 * Creates or updates the default admin account on startup.
 * 
 * Configurable via environment variables:
 *   ADMIN_USERNAME  (default: admin)
 *   ADMIN_EMAIL     (default: admin@polly.local)
 *   ADMIN_PASSWORD  (default: Admin123!)
 * 
 * Can be used standalone (npx tsx server/seed-admin.ts) or imported.
 */

import { db } from "./db";
import { users } from "@shared/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

function getAdminConfig() {
  return {
    username: process.env.ADMIN_USERNAME || "admin",
    email: process.env.ADMIN_EMAIL || "admin@polly.local",
    password: process.env.ADMIN_PASSWORD || "Admin123!",
    name: "Initial Administrator",
  };
}

export async function seedInitialAdmin() {
  const config = getAdminConfig();

  try {
    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.username, config.username))
      .limit(1);

    if (existingAdmin.length > 0) {
      const admin = existingAdmin[0];
      const passwordHash = await bcrypt.hash(config.password, 10);
      const passwordChanged = !(await bcrypt.compare(config.password, admin.passwordHash || ""));

      if (passwordChanged || admin.email !== config.email) {
        await db
          .update(users)
          .set({
            passwordHash,
            email: config.email,
            role: "admin",
          })
          .where(eq(users.username, config.username));
        console.log("[Admin Seed] Admin credentials updated from environment variables");
      } else {
        console.log("[Admin Seed] Admin already exists with matching credentials, skipping.");
      }

      if (admin.role !== "admin") {
        await db
          .update(users)
          .set({ role: "admin" })
          .where(eq(users.username, config.username));
        console.log("[Admin Seed] Admin role restored");
      }

      return;
    }

    const passwordHash = await bcrypt.hash(config.password, 10);

    await db.insert(users).values({
      username: config.username,
      email: config.email,
      name: config.name,
      passwordHash,
      role: "admin",
      provider: "local",
      isInitialAdmin: true,
    });

    console.log("[Admin Seed] Initial admin created successfully");
    console.log(`[Admin Seed] Username: ${config.username}`);
    console.log("[Admin Seed] Please change these credentials after first login!");
  } catch (error) {
    console.error("[Admin Seed] Error creating/updating admin:", error);
  }
}

if (require.main === module || process.argv[1]?.endsWith('seed-admin.ts')) {
  seedInitialAdmin()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
