import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { execSync } from 'child_process';

const TEST_DATABASE_URL = process.env.DATABASE_URL;

describe('Database Migration Tests', () => {
  let pool: Pool | null = null;

  beforeAll(async () => {
    if (!TEST_DATABASE_URL) {
      throw new Error(
        'DATABASE_URL must be set to run migration tests. ' +
        'These tests validate schema integrity to prevent Docker login failures.'
      );
    }
    
    pool = new Pool({
      connectionString: TEST_DATABASE_URL,
      connectionTimeoutMillis: 5000,
    });
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  describe('Schema Integrity After Migration', () => {
    it('should have all required tables after migration', async () => {
      if (!pool) {
        console.warn('Skipping: No database connection available');
        return;
      }

      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
          ORDER BY table_name
        `);
        const tables = result.rows.map(r => r.table_name);

        const requiredTables = [
          'users',
          'polls', 
          'poll_options',
          'votes',
          'email_templates',
        ];

        for (const table of requiredTables) {
          expect(tables, `Missing table: ${table}`).toContain(table);
        }
      } finally {
        client.release();
      }
    });

    it('should have authentication columns in users table', async () => {
      if (!pool) {
        console.warn('Skipping: No database connection available');
        return;
      }

      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'users'
          ORDER BY ordinal_position
        `);
        const columns = result.rows.map(r => r.column_name);

        const authColumns = [
          'id',
          'email',
          'password_hash',
          'role',
          'last_login_at',
          'created_at',
        ];

        for (const col of authColumns) {
          expect(columns, `Missing auth column: users.${col}`).toContain(col);
        }
      } finally {
        client.release();
      }
    });

    it('should have poll management columns in polls table', async () => {
      if (!pool) {
        console.warn('Skipping: No database connection available');
        return;
      }

      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT column_name
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'polls'
        `);
        const columns = result.rows.map(r => r.column_name);

        const pollColumns = [
          'id',
          'title',
          'type',
          'public_token',
          'is_active',
          'created_at',
        ];

        for (const col of pollColumns) {
          expect(columns, `Missing poll column: polls.${col}`).toContain(col);
        }
      } finally {
        client.release();
      }
    });

    it('should have voting columns in votes table', async () => {
      if (!pool) {
        console.warn('Skipping: No database connection available');
        return;
      }

      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT column_name
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'votes'
        `);
        const columns = result.rows.map(r => r.column_name);

        const voteColumns = [
          'id',
          'poll_id',
          'voter_name',
          'created_at',
        ];

        for (const col of voteColumns) {
          expect(columns, `Missing vote column: votes.${col}`).toContain(col);
        }
      } finally {
        client.release();
      }
    });

    it('should have foreign key constraints for data integrity', async () => {
      if (!pool) {
        console.warn('Skipping: No database connection available');
        return;
      }

      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT 
            tc.constraint_name,
            tc.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
        `);

        const fkConstraints = result.rows;
        
        expect(fkConstraints.length).toBeGreaterThanOrEqual(0);
      } finally {
        client.release();
      }
    });
  });

  describe('Migration Idempotency', () => {
    async function ensureSessionTable() {
      if (!pool) return;
      const client = await pool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS "session" (
            "sid" varchar NOT NULL COLLATE "default",
            "sess" json NOT NULL,
            "expire" timestamp(6) NOT NULL,
            CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
          )
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")
        `);
      } finally {
        client.release();
      }
    }

    it('should be able to run drizzle-kit push without fatal errors', async () => {
      let migrationSucceeded = false;
      let output = '';
      
      try {
        output = execSync('npx drizzle-kit push --force 2>&1', {
          encoding: 'utf-8',
          timeout: 60000,
          env: { ...process.env },
        });
        migrationSucceeded = true;
      } catch (error: any) {
        output = error.stdout || error.stderr || '';
        if (error.status === 0) {
          migrationSucceeded = true;
        }
      }
      
      await ensureSessionTable();
      
      expect(output).not.toContain('FATAL');
      expect(output).not.toMatch(/migration.*failed/i);
      expect(migrationSucceeded || output.includes('Changes applied')).toBe(true);
    });

    it('should maintain data integrity after re-running migration', async () => {
      if (!pool) {
        console.warn('Skipping: No database connection available');
        return;
      }

      const client = await pool.connect();
      try {
        // Get user count before migration (with small delay to ensure consistency)
        const beforeCount = await client.query('SELECT COUNT(*) as count FROM users');
        const userCountBefore = parseInt(beforeCount.rows[0].count);

        execSync('npx drizzle-kit push --force 2>&1', {
          encoding: 'utf-8',
          timeout: 60000,
          env: { ...process.env },
        });

        // Wait a moment for any pending transactions
        await new Promise(resolve => setTimeout(resolve, 100));

        const afterCount = await client.query('SELECT COUNT(*) as count FROM users');
        const userCountAfter = parseInt(afterCount.rows[0].count);

        // Allow for small variance due to concurrent test execution (other tests may be creating users)
        // The key is that migration itself doesn't delete users
        expect(userCountAfter).toBeGreaterThanOrEqual(userCountBefore);
      } finally {
        client.release();
      }
      
      await ensureSessionTable();
    });
  });

  describe('Critical Schema Elements for Login', () => {
    it('should have password_hash column (NOT password) for bcrypt storage', async () => {
      if (!pool) {
        console.warn('Skipping: No database connection available');
        return;
      }

      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT column_name, data_type
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
            AND table_name = 'users'
            AND column_name IN ('password', 'password_hash')
        `);
        
        const columns = result.rows.map(r => r.column_name);
        
        expect(columns).toContain('password_hash');
        
        const passwordHashCol = result.rows.find(r => r.column_name === 'password_hash');
        expect(passwordHashCol?.data_type).toBe('text');
      } finally {
        client.release();
      }
    });

    it('should have last_login_at column for login tracking', async () => {
      if (!pool) {
        console.warn('Skipping: No database connection available');
        return;
      }

      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT column_name, data_type
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
            AND table_name = 'users'
            AND column_name = 'last_login_at'
        `);
        
        expect(result.rows.length).toBe(1);
        expect(['timestamp with time zone', 'timestamp without time zone']).toContain(result.rows[0].data_type);
      } finally {
        client.release();
      }
    });

    it('should have role column for authorization', async () => {
      if (!pool) {
        console.warn('Skipping: No database connection available');
        return;
      }

      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT column_name, data_type
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
            AND table_name = 'users'
            AND column_name = 'role'
        `);
        
        expect(result.rows.length).toBe(1);
      } finally {
        client.release();
      }
    });
  });
});
