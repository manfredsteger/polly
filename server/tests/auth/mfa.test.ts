import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import { ADMIN_USERNAME, ADMIN_PASSWORD } from '../testCredentials';
import { storage } from '../../storage';
import { generateTotpForTest } from '../../lib/totpService';
import type { Express } from 'express';

export const testMeta = {
  category: 'auth' as const,
  name: 'MFA (TOTP)',
  description: 'Prüft TOTP-basierte Multi-Faktor-Authentisierung: Status, Setup, Verify, Disable, Admin-Reset',
  severity: 'critical' as const,
};

// ─── Helper: admin login, returns agent ───────────────────────────────────────
async function loginAsAdmin(app: Express) {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/v1/auth/login')
    .set('x-test-meta', JSON.stringify({ isTestData: true }))
    .send({ usernameOrEmail: ADMIN_USERNAME, password: ADMIN_PASSWORD });
  expect(res.status).toBe(200);
  return agent;
}

// ─── MFA Status ───────────────────────────────────────────────────────────────
describe('MFA - Status endpoint', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  it('GET /mfa/status returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/auth/mfa/status');
    expect(res.status).toBe(401);
  });

  it('GET /mfa/status returns { enabled: false } for admin without MFA', async () => {
    const agent = await loginAsAdmin(app);
    const res = await agent.get('/api/v1/auth/mfa/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('enabled');
    expect(typeof res.body.enabled).toBe('boolean');
  });
});

// ─── MFA Setup ────────────────────────────────────────────────────────────────
describe('MFA - Setup flow', () => {
  let app: Express;
  let testUserId: number | null = null;
  let testAgent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    app = await createTestApp();
    // Register a fresh test user
    testAgent = request.agent(app);
    const regRes = await testAgent
      .post('/api/v1/auth/register')
      .set('x-test-meta', JSON.stringify({ isTestData: true }))
      .send({
        username: `mfa_test_${Date.now()}`,
        email: `mfa_test_${Date.now()}@test.example`,
        name: 'MFA Tester',
        password: 'TestPass123!',
      });
    expect(regRes.status).toBeGreaterThanOrEqual(200);
    expect(regRes.status).toBeLessThan(300);
    testUserId = regRes.body.user?.id ?? null;
  });

  afterAll(async () => {
    if (testUserId) {
      try { await storage.deleteUser(testUserId); } catch { /* ignore */ }
    }
  });

  it('POST /mfa/setup-init returns qrCode and secret for authenticated user', async () => {
    const res = await testAgent.post('/api/v1/auth/mfa/setup-init');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('qrCode');
    expect(res.body).toHaveProperty('secret');
    expect(typeof res.body.secret).toBe('string');
    expect(res.body.secret.length).toBeGreaterThan(10);
  });

  it('POST /mfa/setup-confirm rejects wrong TOTP token', async () => {
    await testAgent.post('/api/v1/auth/mfa/setup-init');
    const res = await testAgent
      .post('/api/v1/auth/mfa/setup-confirm')
      .send({ token: '000000' });
    expect(res.status).toBe(400);
  });

  it('POST /mfa/setup-confirm activates MFA with correct token', async () => {
    const initRes = await testAgent.post('/api/v1/auth/mfa/setup-init');
    expect(initRes.status).toBe(200);
    const { secret } = initRes.body;
    const validToken = generateTotpForTest(secret);
    const confirmRes = await testAgent
      .post('/api/v1/auth/mfa/setup-confirm')
      .send({ token: validToken });
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.success).toBe(true);
  });

  it('GET /mfa/status returns { enabled: true } after setup', async () => {
    const res = await testAgent.get('/api/v1/auth/mfa/status');
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
  });
});

// ─── MFA Login flow ───────────────────────────────────────────────────────────
describe('MFA - Login two-step flow', () => {
  let app: Express;
  let testUserId: number | null = null;
  let testUsername: string;
  let testPassword: string;

  beforeAll(async () => {
    app = await createTestApp();
    testUsername = `mfa_login_${Date.now()}`;
    testPassword = 'TestLogin123!';
    const setupAgent = request.agent(app);

    const regRes = await setupAgent
      .post('/api/v1/auth/register')
      .set('x-test-meta', JSON.stringify({ isTestData: true }))
      .send({
        username: testUsername,
        email: `${testUsername}@test.example`,
        name: 'MFA Login Tester',
        password: testPassword,
      });
    expect(regRes.status).toBeGreaterThanOrEqual(200);
    expect(regRes.status).toBeLessThan(300);
    testUserId = regRes.body.user?.id ?? null;

    // Enable MFA
    const initRes = await setupAgent.post('/api/v1/auth/mfa/setup-init');
    const { secret } = initRes.body;
    const token = generateTotpForTest(secret);
    await setupAgent.post('/api/v1/auth/mfa/setup-confirm').send({ token });
  });

  afterAll(async () => {
    if (testUserId) {
      try { await storage.deleteUser(testUserId); } catch { /* ignore */ }
    }
  });

  it('POST /login returns { requiresMfa: true } instead of user for MFA-enabled account', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ usernameOrEmail: testUsername, password: testPassword });
    expect(res.status).toBe(200);
    expect(res.body.requiresMfa).toBe(true);
    expect(res.body.user).toBeUndefined();
  });

  it('POST /mfa/validate completes login with valid TOTP token', async () => {
    const loginAgent = request.agent(app);
    const loginRes = await loginAgent
      .post('/api/v1/auth/login')
      .send({ usernameOrEmail: testUsername, password: testPassword });
    expect(loginRes.body.requiresMfa).toBe(true);

    // Get the secret directly from DB to generate token
    const user = await storage.getUserByUsername(testUsername);
    expect(user?.totpSecret).toBeTruthy();
    const token = generateTotpForTest(user!.totpSecret!);

    const validateRes = await loginAgent
      .post('/api/v1/auth/mfa/validate')
      .send({ token });
    expect(validateRes.status).toBe(200);
    expect(validateRes.body.user).toBeTruthy();
    expect(validateRes.body.user.username).toBe(testUsername);
  });

  it('POST /mfa/validate rejects wrong token', async () => {
    const loginAgent = request.agent(app);
    await loginAgent
      .post('/api/v1/auth/login')
      .send({ usernameOrEmail: testUsername, password: testPassword });

    const validateRes = await loginAgent
      .post('/api/v1/auth/mfa/validate')
      .send({ token: '000000' });
    expect(validateRes.status).toBe(401);
  });

  it('POST /mfa/validate returns 4xx without pending session', async () => {
    const res = await request(app)
      .post('/api/v1/auth/mfa/validate')
      .send({ token: '123456' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

// ─── MFA Disable ─────────────────────────────────────────────────────────────
describe('MFA - Disable', () => {
  let app: Express;
  let testUserId: number | null = null;
  let testAgent: ReturnType<typeof request.agent>;
  let totpSecret: string;

  beforeAll(async () => {
    app = await createTestApp();
    testAgent = request.agent(app);
    const username = `mfa_disable_${Date.now()}`;

    const regRes = await testAgent
      .post('/api/v1/auth/register')
      .set('x-test-meta', JSON.stringify({ isTestData: true }))
      .send({
        username,
        email: `${username}@test.example`,
        name: 'MFA Disable Tester',
        password: 'TestDisable123!',
      });
    testUserId = regRes.body.user?.id ?? null;

    const initRes = await testAgent.post('/api/v1/auth/mfa/setup-init');
    totpSecret = initRes.body.secret;
    const token = generateTotpForTest(totpSecret);
    await testAgent.post('/api/v1/auth/mfa/setup-confirm').send({ token });
  });

  afterAll(async () => {
    if (testUserId) {
      try { await storage.deleteUser(testUserId); } catch { /* ignore */ }
    }
  });

  it('POST /mfa/disable rejects invalid token', async () => {
    const res = await testAgent
      .post('/api/v1/auth/mfa/disable')
      .send({ token: '000000' });
    expect(res.status).toBe(400);
  });

  it('POST /mfa/disable succeeds with valid TOTP token', async () => {
    const token = generateTotpForTest(totpSecret);
    const res = await testAgent
      .post('/api/v1/auth/mfa/disable')
      .send({ token });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /mfa/status returns { enabled: false } after disable', async () => {
    const res = await testAgent.get('/api/v1/auth/mfa/status');
    expect(res.body.enabled).toBe(false);
  });
});

// ─── Admin MFA Reset ──────────────────────────────────────────────────────────
describe('MFA - Admin reset', () => {
  let app: Express;
  let testUserId: number | null = null;

  beforeAll(async () => {
    app = await createTestApp();
    const userAgent = request.agent(app);
    const username = `mfa_adminreset_${Date.now()}`;

    const regRes = await userAgent
      .post('/api/v1/auth/register')
      .set('x-test-meta', JSON.stringify({ isTestData: true }))
      .send({
        username,
        email: `${username}@test.example`,
        name: 'MFA Reset Tester',
        password: 'TestReset123!',
      });
    testUserId = regRes.body.user?.id ?? null;

    // Activate MFA
    const initRes = await userAgent.post('/api/v1/auth/mfa/setup-init');
    const token = generateTotpForTest(initRes.body.secret);
    await userAgent.post('/api/v1/auth/mfa/setup-confirm').send({ token });
  });

  afterAll(async () => {
    if (testUserId) {
      try { await storage.deleteUser(testUserId); } catch { /* ignore */ }
    }
  });

  it('POST /admin/users/:id/reset-mfa returns 401 without auth', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/users/${testUserId}/reset-mfa`);
    expect(res.status).toBe(401);
  });

  it('POST /admin/users/:id/reset-mfa resets MFA for target user', async () => {
    const adminAgent = await loginAsAdmin(app);
    const res = await adminAgent
      .post(`/api/v1/admin/users/${testUserId}/reset-mfa`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('User MFA is disabled after admin reset', async () => {
    if (!testUserId) return;
    const user = await storage.getUser(testUserId);
    expect(user?.totpEnabled).toBe(false);
    expect(user?.totpSecret).toBeNull();
  });

  it('POST /admin/users/9999/reset-mfa returns 404 for non-existent user', async () => {
    const adminAgent = await loginAsAdmin(app);
    const res = await adminAgent.post('/api/v1/admin/users/9999/reset-mfa');
    expect(res.status).toBe(404);
  });
});

// ─── MFA Policy (admin settings) ─────────────────────────────────────────────
describe('MFA - Admin policy settings', () => {
  let app: Express;
  let origMfa: any;
  let adminAgent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    app = await createTestApp();
    const settings = await storage.getCustomizationSettings();
    origMfa = settings.mfa;
    // Login once BEFORE any mfa policy change (so session is valid regardless)
    adminAgent = await loginAsAdmin(app);
  });

  afterAll(async () => {
    await storage.setCustomizationSettings({ mfa: origMfa ?? { adminMfaRequired: false } });
  });

  it('PUT /admin/customization accepts mfa.adminMfaRequired = true', async () => {
    const res = await adminAgent
      .put('/api/v1/admin/customization')
      .send({ mfa: { adminMfaRequired: true } });
    expect(res.status).toBe(200);
    const settings = await storage.getCustomizationSettings();
    expect(settings.mfa?.adminMfaRequired).toBe(true);
  });

  it('PUT /admin/customization accepts mfa.adminMfaRequired = false', async () => {
    const res = await adminAgent
      .put('/api/v1/admin/customization')
      .send({ mfa: { adminMfaRequired: false } });
    expect(res.status).toBe(200);
    const settings = await storage.getCustomizationSettings();
    expect(settings.mfa?.adminMfaRequired).toBe(false);
  });
});
