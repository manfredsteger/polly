export default async function globalSetup() {
  // Global setup runs ONCE before all tests, guaranteed to complete before any test file starts
  // Using storage.purgeTestData() ensures all admin-protection guards are respected
  try {
    const { storage } = await import('../storage');
    await storage.purgeTestData();
  } catch {
    // Ignore errors (e.g. tables don't exist yet)
  }

  // Ensure the initial admin account exists so tests that require admin login work in CI
  try {
    const { seedInitialAdmin } = await import('../seed-admin');
    await seedInitialAdmin();
  } catch {
    // Ignore errors (e.g. admin already exists)
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
