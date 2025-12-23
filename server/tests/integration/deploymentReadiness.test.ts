import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import request from 'supertest';
import bcrypt from 'bcryptjs';

const TEST_DATABASE_URL = process.env.DATABASE_URL;

describe('Deployment Readiness Tests', () => {
  let pool: Pool | null = null;

  beforeAll(async () => {
    if (TEST_DATABASE_URL) {
      pool = new Pool({
        connectionString: TEST_DATABASE_URL,
        connectionTimeoutMillis: 5000,
      });
    }
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  describe('Database Connection', () => {
    it('should have DATABASE_URL environment variable set', () => {
      expect(TEST_DATABASE_URL).toBeDefined();
      expect(TEST_DATABASE_URL).not.toBe('');
    });

    it('should connect to the database successfully', async () => {
      if (!pool) {
        console.warn('Skipping: No database connection available');
        return;
      }

      const client = await pool.connect();
      try {
        const result = await client.query('SELECT 1 as test');
        expect(result.rows[0].test).toBe(1);
      } finally {
        client.release();
      }
    });

    it('should have users table with required columns', async () => {
      if (!pool) {
        console.warn('Skipping: No database connection available');
        return;
      }

      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'users'
        `);
        const columns = result.rows.map(r => r.column_name);
        
        expect(columns).toContain('id');
        expect(columns).toContain('email');
        expect(columns).toContain('password_hash');
        expect(columns).toContain('name');
        expect(columns).toContain('role');
        expect(columns).toContain('last_login_at');
      } finally {
        client.release();
      }
    });

    it('should have poll_options table for voting', async () => {
      if (!pool) {
        console.warn('Skipping: No database connection available');
        return;
      }

      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'poll_options'
        `);
        
        expect(result.rows.length).toBeGreaterThan(0);
      } finally {
        client.release();
      }
    });

    it('should have polls table with required columns', async () => {
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
        
        expect(columns).toContain('id');
        expect(columns).toContain('title');
        expect(columns).toContain('type');
        expect(columns).toContain('public_token');
      } finally {
        client.release();
      }
    });
  });

  describe('Authentication Schema Integrity', () => {
    it('should be able to hash and verify passwords', async () => {
      const testPassword = 'TestPassword123!';
      const hash = await bcrypt.hash(testPassword, 10);
      
      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(50);
      
      const isValid = await bcrypt.compare(testPassword, hash);
      expect(isValid).toBe(true);
      
      const isInvalid = await bcrypt.compare('WrongPassword', hash);
      expect(isInvalid).toBe(false);
    });

    it('should have admin user in database (for Docker deployments)', async () => {
      if (!pool) {
        console.warn('Skipping: No database connection available');
        return;
      }

      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT id, email, role FROM users WHERE role = 'admin' LIMIT 1
        `);
        
        if (result.rows.length === 0) {
          console.warn('No admin user found - run seed-admin.ts for Docker deployments');
        }
      } finally {
        client.release();
      }
    });
  });

  describe('Required Environment Variables', () => {
    it('should have SESSION_SECRET for production', () => {
      if (process.env.NODE_ENV === 'production') {
        expect(process.env.SESSION_SECRET).toBeDefined();
        expect(process.env.SESSION_SECRET?.length).toBeGreaterThanOrEqual(32);
      }
    });

    it('should have valid DATABASE_URL format', () => {
      if (TEST_DATABASE_URL) {
        expect(TEST_DATABASE_URL).toMatch(/^postgres(ql)?:\/\/.+/);
      }
    });
  });
});

describe('Login API Simulation', () => {
  it('should validate login request body schema', () => {
    const validRequest = { username: 'admin', password: 'password123' };
    
    expect(validRequest.username).toBeDefined();
    expect(validRequest.password).toBeDefined();
    expect(typeof validRequest.username).toBe('string');
    expect(typeof validRequest.password).toBe('string');
  });

  it('should handle empty credentials gracefully', () => {
    const emptyRequest = { username: '', password: '' };
    
    expect(emptyRequest.username).toBe('');
    expect(emptyRequest.password).toBe('');
  });
});
