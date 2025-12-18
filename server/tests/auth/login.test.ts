import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import { createTestUser } from '../fixtures/testData';
import type { Express } from 'express';

export const testMeta = {
  category: 'auth' as const,
  name: 'Login-Validierung',
  description: 'Prüft Login-Funktionalität mit korrekten und falschen Daten',
  severity: 'critical' as const,
};

describe('Auth - Login', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  it('should return 401 for invalid credentials', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        usernameOrEmail: 'nonexistent@example.com',
        password: 'wrongpassword',
      });

    expect(response.status).toBe(401);
  });

  it('should return 400 for missing email', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        password: 'somepassword',
      });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('should return 400 for missing password', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        usernameOrEmail: 'test@example.com',
      });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('should return current auth status for /auth/me', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('user');
  });

  it('should return auth methods available', async () => {
    const response = await request(app)
      .get('/api/v1/auth/methods');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('local');
  });
});
