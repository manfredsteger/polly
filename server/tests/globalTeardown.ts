export default async function globalSetup() {
  // Safety guard: refuse to run outside the test environment.
  // This file is exclusively a Vitest globalSetup entry point and must never
  // execute in production or staging, where purgeTestData() would be destructive.
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      '[globalSetup] Refused to execute outside NODE_ENV=test. ' +
      'This file is for the test runner only.',
    );
  }

  // Global setup runs ONCE before all tests, guaranteed to complete before any test file starts.
  // purgeTestData() removes only rows that were inserted with isTestData=true.
  try {
    const { storage } = await import('../storage');
    await storage.purgeTestData();
  } catch {
    // Ignore errors (e.g. tables don't exist yet on first CI run)
  }

  // Seed admin with isInitialAdmin=false using a direct pg connection.
  //
  // WHY NOT use seedInitialAdmin() or the Drizzle `db` object here:
  //   server/db.ts itself does `import * as schema from "@shared/schema"`.
  //   If the @shared path alias is not resolved in the globalSetup execution
  //   context (Vitest runs globalSetup in a separate process that may not
  //   apply all Vite aliases), the entire import chain fails silently inside
  //   the catch block — admin is never seeded, subsequent test files that rely
  //   on admin login start failing with cascading TypeErrors.
  //
  //   A direct pg.Pool connection has zero alias dependencies and is always safe.
  //
  // SECURITY: the NODE_ENV guard above ensures this only runs in test, and the
  //   UPSERT below only touches the single 'admin' (or ADMIN_USERNAME) user row.
  try {
    const { Pool } = await import('pg');
    const bcrypt = (await import('bcryptjs')).default;

    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminEmail   = process.env.ADMIN_EMAIL    || 'admin@polly.local';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';

    const passwordHash = await bcrypt.hash(adminPassword, 10);

    const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      await pgPool.query(
        `INSERT INTO users
           (username, email, password_hash, name, role,
            email_verified, is_initial_admin, provider, is_test_data)
         VALUES ($1, $2, $3, $4, 'admin', true, false, 'local', false)
         ON CONFLICT (username) DO UPDATE SET
           password_hash   = EXCLUDED.password_hash,
           email           = EXCLUDED.email,
           role            = 'admin',
           email_verified  = true,
           is_initial_admin = false`,
        [adminUsername, adminEmail, passwordHash, adminUsername],
      );
      console.log(`[globalSetup] Admin "${adminUsername}" seeded with isInitialAdmin=false`);
    } finally {
      await pgPool.end();
    }
  } catch (err) {
    // Log the error so CI annotations make the root cause visible,
    // but do not abort the entire test run.
    console.error('[globalSetup] Admin seeding failed:', err);
  }

  // Return teardown function that runs ONCE after all tests complete
  return async () => {
    // Skip auto-purge when invoked from the in-app test runner so admins can
    // inspect and manually clean up test data afterwards via the UI button.
    if (process.env.RUN_VIA_INAPP !== '1') {
      try {
        const { storage: storageTeardown } = await import('../storage');
        await storageTeardown.purgeTestData();
      } catch {
        // Ignore errors
      }
    }

    try {
      const { pool } = await import('../db');
      await pool.end();
    } catch {
      // Pool may not exist or already closed
    }
  };
}
