import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createTestApp } from '../testApp';
import { storage } from '../../storage';
import type { Express } from 'express';

let app: Express;
let adminAgent: ReturnType<typeof request.agent>;
let origDeprovisionConfig: any;

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'manfredsteger';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test';

const DEPROVISION_USER = 'deprovision-service';
const DEPROVISION_PASS = 'super-secret-deprovision-pw!';

function basicAuth(user: string, pass: string): string {
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

describe('Deprovision Endpoint Security Tests', () => {
  beforeAll(async () => {
    const setting = await storage.getSetting('deprovision_config');
    origDeprovisionConfig = setting?.value || null;

    app = await createTestApp();
    adminAgent = request.agent(app);

    await adminAgent
      .post('/api/v1/auth/login')
      .send({ usernameOrEmail: ADMIN_USERNAME, password: ADMIN_PASSWORD });

    const passwordHash = await bcrypt.hash(DEPROVISION_PASS, 10);
    await storage.setSetting({
      key: 'deprovision_config',
      value: {
        enabled: true,
        username: DEPROVISION_USER,
        passwordHash,
      },
    });
  });

  afterAll(async () => {
    if (origDeprovisionConfig !== null) {
      await storage.setSetting({ key: 'deprovision_config', value: origDeprovisionConfig });
    } else {
      await storage.deleteSetting('deprovision_config');
    }
  });

  describe('Authentication enforcement', () => {
    it('should reject requests without Authorization header', async () => {
      const res = await request(app)
        .delete('/api/v1/deprovision/user')
        .send({ email: 'someone@test.com' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_REQUIRED');
    });

    it('should reject requests with wrong username', async () => {
      const res = await request(app)
        .delete('/api/v1/deprovision/user')
        .set('Authorization', basicAuth('wrong-user', DEPROVISION_PASS))
        .send({ email: 'someone@test.com' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject requests with wrong password', async () => {
      const res = await request(app)
        .delete('/api/v1/deprovision/user')
        .set('Authorization', basicAuth(DEPROVISION_USER, 'wrong-password'))
        .send({ email: 'someone@test.com' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject requests with empty credentials', async () => {
      const res = await request(app)
        .delete('/api/v1/deprovision/user')
        .set('Authorization', basicAuth('', ''))
        .send({ email: 'someone@test.com' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject requests with malformed Basic auth', async () => {
      const res = await request(app)
        .delete('/api/v1/deprovision/user')
        .set('Authorization', 'Basic !!!invalid-base64!!!')
        .send({ email: 'someone@test.com' });

      expect(res.status).toBe(401);
    });

    it('should reject Bearer token auth (only Basic allowed)', async () => {
      const res = await request(app)
        .delete('/api/v1/deprovision/user')
        .set('Authorization', 'Bearer some-token')
        .send({ email: 'someone@test.com' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_REQUIRED');
    });
  });

  describe('Service disabled check', () => {
    it('should return 503 when deprovision service is disabled', async () => {
      await storage.setSetting({
        key: 'deprovision_config',
        value: {
          enabled: false,
          username: DEPROVISION_USER,
          passwordHash: await bcrypt.hash(DEPROVISION_PASS, 10),
        },
      });

      const res = await request(app)
        .delete('/api/v1/deprovision/user')
        .set('Authorization', basicAuth(DEPROVISION_USER, DEPROVISION_PASS))
        .send({ email: 'someone@test.com' });

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('SERVICE_DISABLED');

      await storage.setSetting({
        key: 'deprovision_config',
        value: {
          enabled: true,
          username: DEPROVISION_USER,
          passwordHash: await bcrypt.hash(DEPROVISION_PASS, 10),
        },
      });
    });
  });

  describe('Input validation', () => {
    it('should require at least one user identifier', async () => {
      const res = await request(app)
        .delete('/api/v1/deprovision/user')
        .set('Authorization', basicAuth(DEPROVISION_USER, DEPROVISION_PASS))
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_USER_IDENTIFIER');
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .delete('/api/v1/deprovision/user')
        .set('Authorization', basicAuth(DEPROVISION_USER, DEPROVISION_PASS))
        .send({ email: 'nonexistent-deprovision@test.com' });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('USER_NOT_FOUND');
    });

    it('should reject invalid action', async () => {
      const res = await request(app)
        .delete('/api/v1/deprovision/user')
        .set('Authorization', basicAuth(DEPROVISION_USER, DEPROVISION_PASS))
        .send({ email: 'someone@test.com', action: 'hack' });

      expect([400, 404]).toContain(res.status);
    });
  });

  describe('Successful operations with valid credentials', () => {
    it('should delete a user with valid credentials', async () => {
      const suffix = Date.now();
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: `deprov_del_${suffix}`,
          email: `deprov-del-${suffix}@test.com`,
          password: 'TestPass123!@',
          name: 'Delete Target',
        });
      expect([200, 201]).toContain(registerRes.status);

      const res = await request(app)
        .delete('/api/v1/deprovision/user')
        .set('Authorization', basicAuth(DEPROVISION_USER, DEPROVISION_PASS))
        .send({ email: `deprov-del-${suffix}@test.com`, action: 'delete' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.action).toBe('deleted');
    });

    it('should anonymize a user with valid credentials', async () => {
      const suffix = Date.now();
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: `deprov_anon_${suffix}`,
          email: `deprov-anon-${suffix}@test.com`,
          password: 'TestPass123!@',
          name: 'Anon Target',
        });
      expect([200, 201]).toContain(registerRes.status);

      const res = await request(app)
        .delete('/api/v1/deprovision/user')
        .set('Authorization', basicAuth(DEPROVISION_USER, DEPROVISION_PASS))
        .send({ email: `deprov-anon-${suffix}@test.com`, action: 'anonymize' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.action).toBe('anonymized');
    });
  });

  describe('Timing attack resistance', () => {
    it('should not reveal valid username by timing difference', async () => {
      const iterations = 5;
      const wrongUserTimes: number[] = [];
      const wrongPassTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start1 = performance.now();
        await request(app)
          .delete('/api/v1/deprovision/user')
          .set('Authorization', basicAuth('completely-wrong-user', 'wrong'))
          .send({ email: 'x@test.com' });
        wrongUserTimes.push(performance.now() - start1);

        const start2 = performance.now();
        await request(app)
          .delete('/api/v1/deprovision/user')
          .set('Authorization', basicAuth(DEPROVISION_USER, 'wrong-password'))
          .send({ email: 'x@test.com' });
        wrongPassTimes.push(performance.now() - start2);
      }

      const avgWrongUser = wrongUserTimes.reduce((a, b) => a + b, 0) / iterations;
      const avgWrongPass = wrongPassTimes.reduce((a, b) => a + b, 0) / iterations;
      const timeDiff = Math.abs(avgWrongUser - avgWrongPass);

      expect(timeDiff).toBeLessThan(200);
    });
  });
});
