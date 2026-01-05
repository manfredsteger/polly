#!/usr/bin/env npx tsx
/**
 * Ensures the database schema is complete.
 * Creates tables if missing, adds columns if missing.
 * This is the primary migration method for Docker deployments.
 */
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const REQUIRED_TABLES = ['users', 'polls', 'poll_options', 'votes', 'system_settings', 
  'password_reset_tokens', 'email_change_tokens', 'notification_logs',
  'test_runs', 'test_results', 'test_configurations'];

const COLUMN_UPDATES: { table: string; column: string; definition: string }[] = [
  { table: 'users', column: 'calendar_token', definition: 'TEXT UNIQUE' },
  { table: 'users', column: 'username', definition: 'TEXT NOT NULL DEFAULT \'\'' },
  { table: 'users', column: 'is_test_data', definition: 'BOOLEAN NOT NULL DEFAULT FALSE' },
  { table: 'users', column: 'is_initial_admin', definition: 'BOOLEAN NOT NULL DEFAULT FALSE' },
  { table: 'users', column: 'deletion_requested_at', definition: 'TIMESTAMP' },
  { table: 'users', column: 'last_login_at', definition: 'TIMESTAMP' },
  { table: 'users', column: 'theme_preference', definition: 'TEXT DEFAULT \'system\'' },
  { table: 'users', column: 'language_preference', definition: 'TEXT DEFAULT \'de\'' },
  { table: 'users', column: 'keycloak_id', definition: 'TEXT UNIQUE' },
  { table: 'users', column: 'provider', definition: 'TEXT DEFAULT \'local\'' },
  { table: 'polls', column: 'allow_vote_withdrawal', definition: 'BOOLEAN NOT NULL DEFAULT FALSE' },
  { table: 'polls', column: 'is_test_data', definition: 'BOOLEAN NOT NULL DEFAULT FALSE' },
  { table: 'polls', column: 'enable_expiry_reminder', definition: 'BOOLEAN NOT NULL DEFAULT FALSE' },
  { table: 'polls', column: 'expiry_reminder_hours', definition: 'INTEGER DEFAULT 24' },
  { table: 'polls', column: 'expiry_reminder_sent', definition: 'BOOLEAN NOT NULL DEFAULT FALSE' },
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
      // Check if tables exist
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      const existingTables = tablesResult.rows.map(r => r.table_name);

      // If core tables don't exist, run initial migration
      if (!existingTables.includes('users') || !existingTables.includes('polls')) {
        console.log('📦 Running initial database migration...');
        const migrationPath = path.resolve(process.cwd(), 'migrations', '0000_old_vance_astro.sql');
        
        if (fs.existsSync(migrationPath)) {
          const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
          // Split by statement breakpoint and execute each statement
          const statements = migrationSQL.split('--> statement-breakpoint');
          
          for (const statement of statements) {
            const trimmed = statement.trim();
            if (trimmed && !trimmed.startsWith('--')) {
              try {
                await client.query(trimmed);
              } catch (err: any) {
                // Ignore "already exists" errors
                if (!err.message?.includes('already exists')) {
                  console.warn(`  ⚠️ Statement warning: ${err.message?.substring(0, 100)}`);
                }
              }
            }
          }
          console.log('✅ Initial migration complete');
        } else {
          console.log('⚠️ Migration file not found, creating tables manually...');
          await createCoreTables(client);
        }
      } else {
        console.log('✓ Core tables already exist');
      }

      // Ensure all columns exist
      console.log('🔧 Checking for missing columns...');
      
      for (const { table, column, definition } of COLUMN_UPDATES) {
        // Check if table exists first
        if (!existingTables.includes(table)) {
          continue;
        }

        const checkResult = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
            AND table_name = $1 
            AND column_name = $2
        `, [table, column]);

        if (checkResult.rows.length === 0) {
          console.log(`  Adding missing column: ${table}.${column}`);
          try {
            await client.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${definition}`);
            console.log(`  ✅ Added ${table}.${column}`);
          } catch (err: any) {
            // Ignore duplicate column errors
            if (!err.message?.includes('already exists')) {
              console.warn(`  ⚠️ Could not add ${table}.${column}: ${err.message}`);
            }
          }
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

async function createCoreTables(client: any): Promise<void> {
  // Create users table
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE DEFAULT '',
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      organization TEXT,
      password_hash TEXT,
      keycloak_id TEXT UNIQUE,
      provider TEXT DEFAULT 'local',
      theme_preference TEXT DEFAULT 'system',
      language_preference TEXT DEFAULT 'de',
      calendar_token TEXT UNIQUE,
      is_test_data BOOLEAN NOT NULL DEFAULT FALSE,
      is_initial_admin BOOLEAN NOT NULL DEFAULT FALSE,
      deletion_requested_at TIMESTAMP,
      last_login_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // Create polls table
  await client.query(`
    CREATE TABLE IF NOT EXISTS polls (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      user_id INTEGER,
      creator_email TEXT,
      admin_token TEXT NOT NULL UNIQUE,
      public_token TEXT NOT NULL UNIQUE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
      allow_anonymous_voting BOOLEAN NOT NULL DEFAULT TRUE,
      allow_multiple_slots BOOLEAN NOT NULL DEFAULT TRUE,
      max_slots_per_user INTEGER,
      allow_vote_edit BOOLEAN NOT NULL DEFAULT FALSE,
      allow_vote_withdrawal BOOLEAN NOT NULL DEFAULT FALSE,
      results_public BOOLEAN NOT NULL DEFAULT TRUE,
      allow_maybe BOOLEAN NOT NULL DEFAULT TRUE,
      is_test_data BOOLEAN NOT NULL DEFAULT FALSE,
      expires_at TIMESTAMP,
      enable_expiry_reminder BOOLEAN NOT NULL DEFAULT FALSE,
      expiry_reminder_hours INTEGER DEFAULT 24,
      expiry_reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // Create poll_options table
  await client.query(`
    CREATE TABLE IF NOT EXISTS poll_options (
      id SERIAL PRIMARY KEY,
      poll_id UUID NOT NULL,
      text TEXT NOT NULL,
      image_url TEXT,
      alt_text TEXT,
      start_time TIMESTAMP,
      end_time TIMESTAMP,
      max_capacity INTEGER,
      "order" INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // Create votes table
  await client.query(`
    CREATE TABLE IF NOT EXISTS votes (
      id SERIAL PRIMARY KEY,
      poll_id UUID NOT NULL,
      option_id INTEGER NOT NULL,
      voter_name TEXT NOT NULL,
      voter_email TEXT NOT NULL,
      user_id INTEGER,
      voter_key TEXT,
      voter_source TEXT,
      response TEXT NOT NULL,
      comment TEXT,
      voter_edit_token TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // Create system_settings table
  await client.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value JSONB NOT NULL,
      description TEXT,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  console.log('✅ Core tables created');
}

ensureSchema().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
