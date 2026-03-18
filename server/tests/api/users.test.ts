import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import type { Express } from 'express';
import { ADMIN_USERNAME, ADMIN_PASSWORD } from '../testCredentials';

let app: Express;
let agent: ReturnType<typeof request.agent>;

async function loginAsAdmin(ag: ReturnType<typeof request.agent>) {
  const res = await ag
    .post('/api/v1/auth/login')
    .send({ usernameOrEmail: ADMIN_USERNAME, password: ADMIN_PASSWORD });
  return res;
}

describe('User Routes API', () => {
  beforeAll(async () => {
    app = await createTestApp();
    agent = request.agent(app);
    await loginAsAdmin(agent);
  });

  describe('GET /api/v1/user/profile', () => {
    it('should return 401 when not authenticated', async () => {
      const res = await request(app).get('/api/v1/user/profile');
      expect(res.status).toBe(401);
    });

    it('should return user profile when authenticated', async () => {
      const res = await agent.get('/api/v1/user/profile');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('username');
      expect(res.body).toHaveProperty('email');
      expect(res.body).toHaveProperty('role');
      expect(res.body).toHaveProperty('themePreference');
      expect(res.body).toHaveProperty('languagePreference');
      expect(res.body).not.toHaveProperty('passwordHash');
    });
  });

  describe('PUT /api/v1/user/profile', () => {
    it('should return 401 when not authenticated', async () => {
      const res = await request(app)
        .put('/api/v1/user/profile')
        .send({ name: 'Test' });
      expect(res.status).toBe(401);
    });

    it('should update profile name', async () => {
      const originalProfile = await agent.get('/api/v1/user/profile');
      const originalName = originalProfile.body.name;

      const res = await agent
        .put('/api/v1/user/profile')
        .send({ name: 'Test Update Name' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Test Update Name');

      await agent.put('/api/v1/user/profile').send({ name: originalName });
    });

    it('should reject empty updates', async () => {
      const res = await agent.put('/api/v1/user/profile').send({});
      expect(res.status).toBe(400);
    });

    it('should reject invalid theme preference', async () => {
      const res = await agent
        .put('/api/v1/user/profile')
        .send({ themePreference: 'invalid' });
      expect(res.status).toBe(400);
    });

    it('should accept valid theme preference', async () => {
      const res = await agent
        .put('/api/v1/user/profile')
        .send({ themePreference: 'dark' });
      expect(res.status).toBe(200);
      expect(res.body.themePreference).toBe('dark');

      await agent.put('/api/v1/user/profile').send({ themePreference: 'system' });
    });
  });

  describe('PATCH /api/v1/users/me/language', () => {
    it('should return 401 when not authenticated', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me/language')
        .send({ language: 'en' });
      expect(res.status).toBe(401);
    });

    it('should update language to en', async () => {
      const res = await agent
        .patch('/api/v1/users/me/language')
        .send({ language: 'en' });
      expect(res.status).toBe(200);
      expect(res.body.languagePreference).toBe('en');
    });

    it('should update language to de', async () => {
      const res = await agent
        .patch('/api/v1/users/me/language')
        .send({ language: 'de' });
      expect(res.status).toBe(200);
      expect(res.body.languagePreference).toBe('de');
    });

    it('should reject invalid language', async () => {
      const res = await agent
        .patch('/api/v1/users/me/language')
        .send({ language: 'fr' });
      expect(res.status).toBe(400);
    });

    it('should reject missing language', async () => {
      const res = await agent
        .patch('/api/v1/users/me/language')
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/v1/user/theme', () => {
    it('should return 401 when not authenticated', async () => {
      const res = await request(app)
        .put('/api/v1/user/theme')
        .send({ themePreference: 'dark' });
      expect(res.status).toBe(401);
    });

    it('should update theme to dark', async () => {
      const res = await agent
        .put('/api/v1/user/theme')
        .send({ themePreference: 'dark' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.themePreference).toBe('dark');
    });

    it('should update theme to light', async () => {
      const res = await agent
        .put('/api/v1/user/theme')
        .send({ themePreference: 'light' });
      expect(res.status).toBe(200);
      expect(res.body.themePreference).toBe('light');
    });

    it('should reset theme to system', async () => {
      const res = await agent
        .put('/api/v1/user/theme')
        .send({ themePreference: 'system' });
      expect(res.status).toBe(200);
      expect(res.body.themePreference).toBe('system');
    });

    it('should reject invalid theme', async () => {
      const res = await agent
        .put('/api/v1/user/theme')
        .send({ themePreference: 'neon' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/user/polls', () => {
    it('should return 401 when not authenticated', async () => {
      const res = await request(app).get('/api/v1/user/polls');
      expect(res.status).toBe(401);
    });

    it('should return array of polls', async () => {
      const res = await agent.get('/api/v1/user/polls');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/v1/user/participations', () => {
    it('should return 401 when not authenticated', async () => {
      const res = await request(app).get('/api/v1/user/participations');
      expect(res.status).toBe(401);
    });

    it('should return array of participations', async () => {
      const res = await agent.get('/api/v1/user/participations');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
