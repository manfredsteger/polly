#!/usr/bin/env npx tsx
/**
 * Ensures all required database columns exist.
 * This is a safety net for when drizzle-kit push doesn't apply all changes.
 */
import { Pool } from 'pg';

const SCHEMA_UPDATES: { table: string; column: string; definition: string }[] = [
  { table: 'users', column: 'calendar_token', definition: 'TEXT UNIQUE' },
  { table: 'polls', column: 'allow_vote_withdrawal', definition: 'BOOLEAN NOT NULL DEFAULT FALSE' },
];

async function ensureSchema(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 10000,
  });

  try {
    const client = await pool.connect();
    
    try {
      console.log('🔧 Checking for missing columns...');
      
      for (const { table, column, definition } of SCHEMA_UPDATES) {
        const checkResult = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
            AND table_name = $1 
            AND column_name = $2
        `, [table, column]);

        if (checkResult.rows.length === 0) {
          console.log(`  Adding missing column: ${table}.${column}`);
          await client.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${definition}`);
          console.log(`  ✅ Added ${table}.${column}`);
        } else {
          console.log(`  ✓ Column ${table}.${column} already exists`);
        }
      }

      console.log('✅ Schema check complete');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Schema update failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

ensureSchema().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
