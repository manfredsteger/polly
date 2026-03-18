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
 * 
 * NOTE: This is the ONLY file allowed to have hardcoded credential defaults.
 * When defaults are used, isInitialAdmin=true forces a password change on
 * first login. All other code (tests, scripts) MUST read credentials from
 * environment variables without fallbacks.
 */

import { db } from "./db";
import { users } from "@shared/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

const DEFAULTS = {
  username: "admin",
  email: "admin@polly.local",
  password: "Admin123!",
};

function getAdminConfig() {
  const username = process.env.ADMIN_USERNAME || DEFAULTS.username;
  const email = process.env.ADMIN_EMAIL || DEFAULTS.email;
  const password = process.env.ADMIN_PASSWORD || DEFAULTS.password;

  const isUsingDefaults =
    username === DEFAULTS.username &&
    email === DEFAULTS.email &&
    password === DEFAULTS.password;

  const config = {
    username,
    email,
    password,
    name: isUsingDefaults ? "Initial Administrator" : username,
    isUsingDefaults,
  };
  console.log(`[Admin Seed] Config: username=${config.username}, email=${config.email}, usingDefaults=${config.isUsingDefaults}`);
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

      const shouldBeInitialAdmin = config.isUsingDefaults;
      const needsUpdate = !passwordMatches || admin.email !== config.email || admin.role !== "admin" || !admin.emailVerified || admin.isInitialAdmin !== shouldBeInitialAdmin;

      if (needsUpdate) {
        const newHash = await bcrypt.hash(config.password, 10);
        await db
          .update(users)
          .set({
            passwordHash: newHash,
            email: config.email,
            name: config.name,
            role: "admin",
            emailVerified: true,
            isInitialAdmin: shouldBeInitialAdmin,
          })
          .where(eq(users.username, config.username));
        console.log(`[Admin Seed] Admin credentials updated successfully (isInitialAdmin=${shouldBeInitialAdmin})`);

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
      isInitialAdmin: config.isUsingDefaults,
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
