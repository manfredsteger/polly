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
  const config = {
    username: process.env.ADMIN_USERNAME || "admin",
    email: process.env.ADMIN_EMAIL || "admin@polly.local",
    password: process.env.ADMIN_PASSWORD || "Admin123!",
    name: "Initial Administrator",
  };
  console.log(`[Admin Seed] Config: username=${config.username}, email=${config.email}`);
  return config;
}

export async function seedInitialAdmin() {
  const config = getAdminConfig();

  try {
    console.log("[Admin Seed] Checking for existing admin...");
    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.username, config.username))
      .limit(1);

    if (existingAdmin.length > 0) {
      const admin = existingAdmin[0];
      console.log(`[Admin Seed] Found existing admin (id=${admin.id}, role=${admin.role})`);

      const currentHash = admin.passwordHash || "";
      let passwordMatches = false;
      try {
        passwordMatches = currentHash.length > 0 && await bcrypt.compare(config.password, currentHash);
      } catch (e) {
        console.log("[Admin Seed] Password comparison failed, will reset password");
      }

      const needsUpdate = !passwordMatches || admin.email !== config.email || admin.role !== "admin" || !admin.emailVerified;

      if (needsUpdate) {
        const newHash = await bcrypt.hash(config.password, 10);
        await db
          .update(users)
          .set({
            passwordHash: newHash,
            email: config.email,
            role: "admin",
            emailVerified: true,
          })
          .where(eq(users.username, config.username));
        console.log("[Admin Seed] Admin credentials updated successfully");

        const verify = await bcrypt.compare(config.password, newHash);
        console.log(`[Admin Seed] Password verification: ${verify ? 'OK' : 'FAILED'}`);
      } else {
        console.log("[Admin Seed] Admin exists with correct credentials, no changes needed.");
      }

      return;
    }

    console.log("[Admin Seed] No admin found, creating new admin...");
    const passwordHash = await bcrypt.hash(config.password, 10);

    const verify = await bcrypt.compare(config.password, passwordHash);
    console.log(`[Admin Seed] Password hash verification before insert: ${verify ? 'OK' : 'FAILED'}`);

    await db.insert(users).values({
      username: config.username,
      email: config.email,
      name: config.name,
      passwordHash,
      role: "admin",
      provider: "local",
      isInitialAdmin: true,
      emailVerified: true,
    });

    console.log("[Admin Seed] Initial admin created successfully");
    console.log(`[Admin Seed] Username: ${config.username}`);
    console.log("[Admin Seed] Please change these credentials after first login!");
  } catch (error: any) {
    console.error("[Admin Seed] FAILED:", error?.message || error);
    if (error?.stack) {
      console.error("[Admin Seed] Stack:", error.stack);
    }
  }
}

const isDirectRun = process.argv[1]?.endsWith('seed-admin.ts');
if (isDirectRun) {
  seedInitialAdmin()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
