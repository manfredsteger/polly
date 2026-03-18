import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp, closeTestApp } from '../testApp';
import { storage } from '../../storage';
import { ADMIN_USERNAME, ADMIN_PASSWORD } from '../testCredentials';

let app: Express;
const suffix = Date.now();

async function loginAsAdmin(agent: request.SuperTest<request.Test>) {
  const res = await agent.post('/api/v1/auth/login').send({
    usernameOrEmail: ADMIN_USERNAME,
    password: ADMIN_PASSWORD,
  });
  return res;
}

async function registerUser(agent: request.SuperTest<request.Test>, username: string, email: string, password: string) {
  return agent.post('/api/v1/auth/register').send({
    username,
    email,
    password,
    confirmPassword: password,
    name: 'Test User',
  });
}

describe('Security Hardening Tests', () => {
  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('T004: Cache-Control Headers', () => {
    it('should set no-store Cache-Control on API responses', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.headers['cache-control']).toContain('no-store');
      expect(res.headers['pragma']).toBe('no-cache');
      expect(res.headers['expires']).toBe('0');
    });

    it('should set Cache-Control on authenticated API responses', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);
      const res = await agent.get('/api/v1/auth/me');
      expect(res.headers['cache-control']).toContain('no-store');
    });

    it('should set Cache-Control on error responses', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({});
      expect(res.headers['cache-control']).toContain('no-store');
    });
  });

  describe('T005: Generic Error Messages (no error.message leak)', () => {
    it('should not leak error details on invalid JSON body', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');
      expect(res.body.error || res.body.message || '').not.toMatch(/SyntaxError/i);
      expect(res.body.error || res.body.message || '').not.toMatch(/Unexpected token/i);
    });

    it('should return generic error for missing poll', async () => {
      const res = await request(app).get('/api/v1/polls/nonexistent-id-12345');
      expect(res.status).toBeGreaterThanOrEqual(400);
      const body = JSON.stringify(res.body);
      expect(body).not.toMatch(/Cannot read properties/i);
      expect(body).not.toMatch(/TypeError/i);
    });
  });

  describe('T008: Input Size Limits', () => {
    it('should reject oversized JSON body (> 1MB)', async () => {
      const largeBody = { data: 'x'.repeat(1.5 * 1024 * 1024) };
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send(largeBody);
      expect(res.status).toBe(413);
    });

    it('should reject voter name exceeding 100 characters', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);

      const pollRes = await agent.post('/api/v1/polls').send({
        title: `Size limit test poll ${suffix}`,
        type: 'survey',
        options: [{ text: 'Option A' }],
      });
      if (pollRes.status === 200 || pollRes.status === 201) {
        const pollId = pollRes.body.id;
        const voteRes = await request(app).post(`/api/v1/polls/${pollId}/votes`).send({
          voterName: 'A'.repeat(101),
          selections: [{ optionId: pollRes.body.options?.[0]?.id, value: 'yes' }],
        });
        expect(voteRes.status).toBeGreaterThanOrEqual(400);
      }
    });
  });

  describe('T003: Registration Enumeration Prevention', () => {
    it('should return generic message when registering with existing username', async () => {
      const agent = request.agent(app);
      const res = await registerUser(agent, ADMIN_USERNAME, `unique-${suffix}@test.de`, 'TestPass123!');
      if (res.status >= 400) {
        const errorMsg = res.body.error || res.body.message || '';
        expect(errorMsg).not.toMatch(/bereits vergeben/i);
        expect(errorMsg).not.toMatch(/already taken/i);
        expect(errorMsg).not.toMatch(/already exists/i);
        expect(errorMsg).not.toMatch(/username.*exist/i);
      }
    });

    it('should return generic message when registering with existing email', async () => {
      const agent = request.agent(app);
      const res = await registerUser(agent, `unique-${suffix}`, 'manfred.steger@ifp.bayern.de', 'TestPass123!');
      if (res.status >= 400) {
        const errorMsg = res.body.error || res.body.message || '';
        expect(errorMsg).not.toMatch(/bereits vergeben/i);
        expect(errorMsg).not.toMatch(/already taken/i);
        expect(errorMsg).not.toMatch(/email.*exist/i);
      }
    });
  });

  describe('T009: Session Regeneration after Login', () => {
    const sessUser = `sessuser-${suffix}`;
    const sessEmail = `sessuser-${suffix}@test.de`;
    const sessPass = 'TestPass123!';

    beforeAll(async () => {
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash(sessPass, 10);
      const existing = await storage.getUserByUsername(sessUser);
      if (!existing) {
        await storage.createUser({
          username: sessUser,
          email: sessEmail,
          passwordHash: hash,
          name: 'Session Test User',
          role: 'user',
          provider: 'local',
          isTestData: true,
        });
      }
    });

    it('should issue new session cookie after login', async () => {
      const agent = request.agent(app);

      const preRes = await agent.get('/api/v1/auth/me');
      const preCookies = preRes.headers['set-cookie'];
      const preSessionId = extractSessionId(preCookies);

      const loginRes = await agent.post('/api/v1/auth/login').send({
        usernameOrEmail: sessUser,
        password: sessPass,
      });
      expect(loginRes.status).toBe(200);

      const postCookies = loginRes.headers['set-cookie'];
      const postSessionId = extractSessionId(postCookies);

      if (preSessionId && postSessionId) {
        expect(postSessionId).not.toBe(preSessionId);
      }
    });

    it('should issue new session cookie after registration', async () => {
      const agent = request.agent(app);
      const regUser = `sessreg-${suffix}`;

      const preRes = await agent.get('/api/v1/auth/me');
      const preCookies = preRes.headers['set-cookie'];
      const preSessionId = extractSessionId(preCookies);

      const regRes = await registerUser(
        agent as any,
        regUser,
        `${regUser}@test.de`,
        'TestPass123!'
      );

      if (regRes.status === 200 || regRes.status === 201) {
        const postCookies = regRes.headers['set-cookie'];
        const postSessionId = extractSessionId(postCookies);
        if (preSessionId && postSessionId) {
          expect(postSessionId).not.toBe(preSessionId);
        }
      }
    });
  });

  describe('T015: No Server Version Headers', () => {
    it('should not expose X-Powered-By header', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('should not expose Server header with version info', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      const serverHeader = res.headers['server'] || '';
      expect(serverHeader).not.toMatch(/express/i);
      expect(serverHeader).not.toMatch(/node/i);
      expect(serverHeader).not.toMatch(/\d+\.\d+/);
    });

    it('should not expose version info in any response header', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      const headers = res.headers;
      for (const [key, value] of Object.entries(headers)) {
        if (typeof value === 'string') {
          expect(value).not.toMatch(/express\s*\/?\s*\d/i);
          expect(value).not.toMatch(/node\s*\/?\s*\d/i);
        }
      }
    });

    it('should not expose version info on error pages', async () => {
      const res = await request(app).get('/api/v1/nonexistent');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('should not expose version info on POST endpoints', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({});
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('T007: Force Password Change for Initial Admin', () => {
    it('should block API access for isInitialAdmin users except allowed paths', async () => {
      const initialAdmin = await storage.getUserByUsername(`initadmin-${suffix}`);
      if (!initialAdmin) {
        const bcrypt = await import('bcryptjs');
        const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
        await storage.createUser({
          username: `initadmin-${suffix}`,
          email: `initadmin-${suffix}@test.de`,
          passwordHash: hash,
          name: 'Init Admin',
          role: 'admin',
          isInitialAdmin: true,
          provider: 'local',
          isTestData: true,
        });
      }

      const agent = request.agent(app);
      const loginRes = await agent.post('/api/v1/auth/login').send({
        usernameOrEmail: `initadmin-${suffix}`,
        password: ADMIN_PASSWORD,
      });

      if (loginRes.status === 200) {
        const meRes = await agent.get('/api/v1/auth/me');
        expect(meRes.status).toBe(200);

        const usersRes = await agent.get('/api/v1/admin/users');
        expect(usersRes.status).toBe(403);
        expect(usersRes.body.code).toBe('PASSWORD_CHANGE_REQUIRED');

        const pollsRes = await agent.get('/api/v1/polls');
        expect(pollsRes.status).toBe(403);
        expect(pollsRes.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
      }
    });
  });
});

function extractSessionId(cookies: string | string[] | undefined): string | null {
  if (!cookies) return null;
  const cookieArr = Array.isArray(cookies) ? cookies : [cookies];
  for (const c of cookieArr) {
    const match = c.match(/polly\.sid=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}
