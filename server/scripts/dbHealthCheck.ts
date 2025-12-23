#!/usr/bin/env npx tsx
import { Pool } from 'pg';

const REQUIRED_TABLES = ['users', 'polls', 'votes', 'poll_options'];

const REQUIRED_COLUMNS: Record<string, string[]> = {
  users: ['id', 'email', 'password_hash', 'name', 'role', 'last_login_at', 'created_at'],
  polls: ['id', 'title', 'type', 'public_token', 'created_at'],
};

async function checkDatabaseHealth(): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  if (!process.env.DATABASE_URL) {
    return { success: false, errors: ['DATABASE_URL environment variable is not set'] };
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 10000,
  });

  try {
    const client = await pool.connect();
    
    try {
      await client.query('SELECT 1');
      console.log('✅ Database connection successful');

      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      const existingTables = tablesResult.rows.map(r => r.table_name);

      for (const table of REQUIRED_TABLES) {
        if (!existingTables.includes(table)) {
          errors.push(`Missing required table: ${table}`);
        }
      }

      for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
        if (!existingTables.includes(table)) continue;

        const columnsResult = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = $1
        `, [table]);
        const existingColumns = columnsResult.rows.map(r => r.column_name);

        for (const column of columns) {
          if (!existingColumns.includes(column)) {
            errors.push(`Missing column: ${table}.${column}`);
          }
        }
      }

      if (errors.length === 0) {
        console.log('✅ All required tables and columns exist');
      }

    } finally {
      client.release();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`Database connection failed: ${message}`);
  } finally {
    await pool.end();
  }

  return { success: errors.length === 0, errors };
}

async function main() {
  console.log('🔍 Running database health check...');
  
  const { success, errors } = await checkDatabaseHealth();
  
  if (!success) {
    console.error('❌ Database health check failed:');
    errors.forEach(err => console.error(`   - ${err}`));
    process.exit(1);
  }
  
  console.log('✅ Database health check passed');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});

export { checkDatabaseHealth };
