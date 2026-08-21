import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import type { Express } from 'express';
import { ADMIN_USERNAME, ADMIN_PASSWORD } from '../testCredentials';
import { storage } from '../../storage';
import { generateTotpForTest } from '../../lib/totpService';

let app: Express;
let adminAgent: ReturnType<typeof request.agent>;

describe('GET /api/v1/admin/mfa-coverage', () => {
  const createdUserIds: number[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    adminAgent = request.agent(app);
    const loginRes = await adminAgent
      .post('/api/v1/auth/login')
      .send({ usernameOrEmail: ADMIN_USERNAME, password: ADMIN_PASSWORD });
    expect(loginRes.status).toBe(200);
  });

  afterAll(async () => {
    for (const id of createdUserIds) {
      try { await storage.deleteUser(id); } catch { /* ignore */ }
    }
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await request(app).get('/api/v1/admin/mfa-coverage');
    expect(res.status).toBe(401);
  });

  it('returns total, withMfa, withoutMfa counts for admins', async () => {
    const res = await adminAgent.get('/api/v1/admin/mfa-coverage');
    expect(res.status).toBe(200);
    expect(typeof res.body.total).toBe('number');
    expect(typeof res.body.withMfa).toBe('number');
    expect(typeof res.body.withoutMfa).toBe('number');
    expect(Array.isArray(res.body.adminsMissingMfa)).toBe(true);
    expect(res.body.withMfa + res.body.withoutMfa).toBe(res.body.total);
  });

  it('reflects an admin without MFA in withoutMfa count', async () => {
    // Create a non-MFA admin user
    const username = `mfacov_test_${Date.now()}`;
    const regRes = await request.agent(app)
      .post('/api/v1/auth/register')
      .set('x-test-meta', JSON.stringify({ isTestData: true }))
      .send({
        username,
        email: `${username}@test.example`,
        name: 'MFA Coverage Tester',
        password: 'TestPass123!',
      });
    expect(regRes.status).toBeGreaterThanOrEqual(200);
    const userId: number = regRes.body.user.id;
    createdUserIds.push(userId);

    // Promote to admin
    await storage.updateUser(userId, { role: 'admin' } as any);

    const res = await adminAgent.get('/api/v1/admin/mfa-coverage');
    expect(res.status).toBe(200);
    expect(res.body.adminsMissingMfa).toContain(username);
    expect(res.body.withoutMfa).toBeGreaterThanOrEqual(1);
  });

  it('reflects an admin with MFA in withMfa count', async () => {
    const username = `mfacov_totp_${Date.now()}`;
    const userAgent = request.agent(app);
    const regRes = await userAgent
      .post('/api/v1/auth/register')
      .set('x-test-meta', JSON.stringify({ isTestData: true }))
      .send({
        username,
        email: `${username}@test.example`,
        name: 'MFA Coverage TOTP Tester',
        password: 'TestPass123!',
      });
    expect(regRes.status).toBeGreaterThanOrEqual(200);
    const userId: number = regRes.body.user.id;
    createdUserIds.push(userId);

    // Enable MFA for this user
    await storage.updateUser(userId, { role: 'admin', totpEnabled: true, totpSecret: 'TESTSECRET' } as any);

    const res = await adminAgent.get('/api/v1/admin/mfa-coverage');
    expect(res.status).toBe(200);
    expect(res.body.adminsMissingMfa).not.toContain(username);
  });
});

describe('MFA_ADMIN_REQUIRED env-var override', () => {
  let app: Express;
  let adminAgent: ReturnType<typeof request.agent>;
  const createdUserIds: number[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    adminAgent = request.agent(app);
    const loginRes = await adminAgent
      .post('/api/v1/auth/login')
      .send({ usernameOrEmail: ADMIN_USERNAME, password: ADMIN_PASSWORD });
    expect(loginRes.status).toBe(200);
    // Enable adminMfaRequired in DB
    await adminAgent
      .put('/api/v1/admin/customization')
      .send({ mfa: { adminMfaRequired: true } });
  });

  afterAll(async () => {
    // Reset policy
    await adminAgent
      .put('/api/v1/admin/customization')
      .send({ mfa: { adminMfaRequired: false } });
    for (const id of createdUserIds) {
      try { await storage.deleteUser(id); } catch { /* ignore */ }
    }
    delete process.env.MFA_ADMIN_REQUIRED;
  });

  it('env MFA_ADMIN_REQUIRED=false bypasses the DB setup requirement for admin without TOTP', async () => {
    const username = `mfa_envovr_${Date.now()}`;
    const password = 'TestPass123!';
    const regAgent = request.agent(app);
    const regRes = await regAgent
      .post('/api/v1/auth/register')
      .set('x-test-meta', JSON.stringify({ isTestData: true }))
      .send({
        username,
        email: `${username}@test.example`,
        name: 'Env Override Tester',
        password,
      });
    expect(regRes.status).toBeGreaterThanOrEqual(200);
    const userId: number = regRes.body.user.id;
    createdUserIds.push(userId);
    await storage.updateUser(userId, { role: 'admin', emailVerified: true } as any);

    // With MFA_ADMIN_REQUIRED=false the admin without TOTP should log in directly
    // even though adminMfaRequired is true in DB.
    process.env.MFA_ADMIN_REQUIRED = 'false';
    try {
      const freshAgent = request.agent(app);
      const loginRes = await freshAgent
        .post('/api/v1/auth/login')
        .send({ usernameOrEmail: username, password });
      expect(loginRes.body.requiresMfaSetup).toBeFalsy();
      expect(loginRes.body.user).toBeDefined();
    } finally {
      delete process.env.MFA_ADMIN_REQUIRED;
    }
  });

  it('env MFA_ADMIN_REQUIRED=false also bypasses the TOTP challenge for already-enrolled admins', async () => {
    // This is the primary recovery scenario: an admin who HAS TOTP enabled
    // but has lost their authenticator app should still be able to log in when
    // the operator sets MFA_ADMIN_REQUIRED=false in the environment.
    const username = `mfa_totp_ovr_${Date.now()}`;
    const password = 'TestPass123!';
    const regAgent = request.agent(app);
    const regRes = await regAgent
      .post('/api/v1/auth/register')
      .set('x-test-meta', JSON.stringify({ isTestData: true }))
      .send({
        username,
        email: `${username}@test.example`,
        name: 'TOTP Override Tester',
        password,
      });
    expect(regRes.status).toBeGreaterThanOrEqual(200);
    const userId: number = regRes.body.user.id;
    createdUserIds.push(userId);
    // Mark as admin with TOTP enrolled (simulates lost-authenticator scenario)
    await storage.updateUser(userId, {
      role: 'admin',
      emailVerified: true,
      totpEnabled: true,
      totpSecret: 'TESTSECRET234567',
    } as any);

    // Without the override the login should demand TOTP
    const normalAgent = request.agent(app);
    const normalRes = await normalAgent
      .post('/api/v1/auth/login')
      .send({ usernameOrEmail: username, password });
    expect(normalRes.body.requiresMfa).toBe(true);

    // With MFA_ADMIN_REQUIRED=false the login should succeed without TOTP
    process.env.MFA_ADMIN_REQUIRED = 'false';
    try {
      const overrideAgent = request.agent(app);
      const overrideRes = await overrideAgent
        .post('/api/v1/auth/login')
        .send({ usernameOrEmail: username, password });
      expect(overrideRes.body.requiresMfa).toBeFalsy();
      expect(overrideRes.body.user).toBeDefined();
    } finally {
      delete process.env.MFA_ADMIN_REQUIRED;
    }
  });
});
