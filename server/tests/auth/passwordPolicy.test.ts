import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import { ADMIN_USERNAME, ADMIN_PASSWORD } from '../testCredentials';
import type { Express } from 'express';

export const testMeta = {
  category: 'auth' as const,
  name: 'Passwort-Policy',
  description: 'Prüft den öffentlichen password-policy Endpunkt und die Policy-Durchsetzung bei Passwortänderungen',
  severity: 'high' as const,
};

describe('Auth - Password Policy Endpoint', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  it('GET /api/v1/auth/password-policy responds 200 without authentication', async () => {
    const res = await request(app).get('/api/v1/auth/password-policy');
    expect(res.status).toBe(200);
  });

  it('GET /api/v1/auth/password-policy returns minLength as number >= 8', async () => {
    const res = await request(app).get('/api/v1/auth/password-policy');
    expect(res.status).toBe(200);
    expect(typeof res.body.minLength).toBe('number');
    expect(res.body.minLength).toBeGreaterThanOrEqual(8);
  });

  it('GET /api/v1/auth/password-policy returns all required policy fields', async () => {
    const res = await request(app).get('/api/v1/auth/password-policy');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('requireUppercase');
    expect(res.body).toHaveProperty('requireLowercase');
    expect(res.body).toHaveProperty('requireNumbers');
    expect(res.body).toHaveProperty('requireSpecialChars');
    expect(typeof res.body.requireUppercase).toBe('boolean');
    expect(typeof res.body.requireLowercase).toBe('boolean');
    expect(typeof res.body.requireNumbers).toBe('boolean');
    expect(typeof res.body.requireSpecialChars).toBe('boolean');
  });
});

describe('Auth - Change Password Policy Enforcement', () => {
  let app: Express;
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    app = await createTestApp();
    agent = request.agent(app);
    await agent
      .post('/api/v1/auth/login')
      .send({ usernameOrEmail: ADMIN_USERNAME, password: ADMIN_PASSWORD });
  });

  it('rejects change-password when not authenticated', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .send({ currentPassword: 'anything', newPassword: 'NewSecurePass123!' });
    expect(res.status).toBe(401);
  });

  it('rejects change-password with missing fields', async () => {
    const res = await agent.post('/api/v1/auth/change-password').send({});
    expect(res.status).toBe(400);
  });

  it('rejects change-password with wrong current password', async () => {
    const res = await agent
      .post('/api/v1/auth/change-password')
      .send({ currentPassword: 'DefWrongPass999!', newPassword: 'NewSecurePass123!' });
    expect(res.status).toBe(400);
  });

  it('rejects change-password with new password that violates the policy', async () => {
    const res = await agent
      .post('/api/v1/auth/change-password')
      .send({ currentPassword: ADMIN_PASSWORD, newPassword: 'weak' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });
});
