/**
 * Polly - Initial Admin Seeder
 * Creates the initial admin account on startup only when it does not exist.
 * Environment credentials are bootstrap values, not password-reset settings.
 * 
 * Configurable via environment variables:
 *   ADMIN_USERNAME  (default: admin)
 *   ADMIN_EMAIL     (default: admin@polly.local)
 *   ADMIN_PASSWORD  (default: Admin123!)
 * 
 * Can be used standalone (npx tsx server/seed-admin.ts) or imported.
 * 
 * Credential policy: Two files share the same fallback defaults:
 *   - This file (seed-admin.ts) for Docker/production seeding
 *   - server/tests/testCredentials.ts for test imports
 * When defaults are used here, isInitialAdmin=true forces a password change
 * on first login. No other file may hardcode its own admin credentials.
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
      // Existing local and IDM accounts belong to the user. Never reset their
      // password, initial-login flag, identity, role, or MFA during startup.
      console.log("[Admin Seed] Configured username already exists; preserving the account.");

      return;
    }

    console.log("[Admin Seed] No admin found, creating new admin...");
    const passwordHash = await bcrypt.hash(config.password, 10);

    const verify = await bcrypt.compare(config.password, passwordHash);
    console.log(`[Admin Seed] Password hash verification before insert: ${verify ? 'OK' : 'FAILED'}`);

    const created = await db.insert(users).values({
      username: config.username,
      email: config.email,
      name: config.name,
      passwordHash,
      role: "admin",
      provider: "local",
      isInitialAdmin: config.isUsingDefaults,
      emailVerified: true,
    }).onConflictDoNothing().returning({ id: users.id });

    // Another instance may have created the account after the lookup, or the
    // configured email may already belong to an account. Preserve either one.
    if (created.length === 0) {
      console.log("[Admin Seed] Username or email already exists; preserving the account.");
      return;
    }

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
