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

  // Ensure the initial admin account exists so every test file that needs admin
  // login (e.g. hardening.test.ts T011, liveVotingService.test.ts) can authenticate.
  //
  // Security note: seedInitialAdmin() sets isInitialAdmin=true when the default
  // credentials are used (no ADMIN_* env vars → CI environment). The middleware in
  // server/index.ts blocks ALL API calls for isInitialAdmin users to force a password
  // change on first production boot. In tests this guard must be disabled, so we
  // explicitly clear the flag immediately after seeding — only inside this test-only
  // setup file, never in any production code path.
  try {
    const { seedInitialAdmin } = await import('../seed-admin');
    await seedInitialAdmin();

    // Clear the isInitialAdmin flag so the force-password-change middleware
    // does not block test API calls. This is safe: the flag has no meaning
    // in a test database and is never written back to production.
    const { db } = await import('../db');
    const { users } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');
    const { ADMIN_USERNAME } = await import('./testCredentials');
    await db
      .update(users)
      .set({ isInitialAdmin: false })
      .where(eq(users.username, ADMIN_USERNAME));
  } catch {
    // Ignore errors (e.g. admin already exists with correct state)
  }

  // Return teardown function that runs ONCE after all tests complete
  return async () => {
    try {
      const { storage: storageTeardown } = await import('../storage');
      await storageTeardown.purgeTestData();
    } catch {
      // Ignore errors
    }

    try {
      const { pool } = await import('../db');
      await pool.end();
    } catch {
      // Pool may not exist or already closed
    }
  };
}
