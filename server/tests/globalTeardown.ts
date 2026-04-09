export default async function globalSetup() {
  // Global setup runs ONCE before all tests in a separate process
  // This is the safe place for global cleanup - no race conditions possible
  try {
    const { db } = await import('../db');
    const { sql } = await import('drizzle-orm');

    await db.execute(sql`
      DELETE FROM votes WHERE poll_id IN (
        SELECT id FROM polls WHERE is_test_data = true
        OR title LIKE 'Test Poll%' OR title LIKE 'E2E:%'
      )
    `);
    await db.execute(sql`
      DELETE FROM poll_options WHERE poll_id IN (
        SELECT id FROM polls WHERE is_test_data = true
        OR title LIKE 'Test Poll%' OR title LIKE 'E2E:%'
      )
    `);
    await db.execute(sql`
      DELETE FROM polls WHERE is_test_data = true
        OR title LIKE 'Test Poll%' OR title LIKE 'E2E:%'
    `);
    await db.execute(sql`
      DELETE FROM password_reset_tokens WHERE user_id IN (
        SELECT id FROM users WHERE is_test_data = true
        OR email LIKE '%@test.local'
        OR email LIKE 'test-%@example.com'
        OR email LIKE 'sessiontest-%@example.com'
        OR email LIKE 'cookietest-%@example.com'
        OR email LIKE 'reset-test-%@example.com'
        OR email LIKE 'login-test%@example.com'
      )
    `);
    await db.execute(sql`
      DELETE FROM users WHERE is_test_data = true
        OR email LIKE '%@test.local'
        OR email LIKE 'test-%@example.com'
        OR email LIKE 'sessiontest-%@example.com'
        OR email LIKE 'cookietest-%@example.com'
        OR email LIKE 'reset-test-%@example.com'
        OR email LIKE 'login-test%@example.com'
        OR email LIKE 'fixtest-%@example.com'
    `);
  } catch {
    // Ignore errors
  }

  // Return teardown function that runs ONCE after all tests
  return async () => {
    try {
      const { pool } = await import('../db');
      await pool.end();
    } catch {
      // Pool may not exist or already closed
    }
  };
}
