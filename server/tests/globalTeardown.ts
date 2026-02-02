export default async function globalSetup() {
  // Global setup runs before all tests
  // Return a teardown function that runs after ALL tests complete
  return async () => {
    try {
      const { pool } = await import('../db');
      await pool.end();
    } catch {
      // Pool may not exist or already closed
    }
  };
}
