import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import type { Express } from 'express';

export const testMeta = {
  category: 'database' as const,
  name: 'System-Einstellungen',
  description: 'Prüft Lesen und Persistenz von System-Einstellungen',
  severity: 'medium' as const,
};

describe('Data - System Settings', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  describe('Public Settings Access', () => {
    it('should allow public access to theme settings', async () => {
      const response = await request(app)
        .get('/api/v1/public/theme');

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toBeDefined();
      }
    });

    it('should return auth methods publicly', async () => {
      const response = await request(app)
        .get('/api/v1/auth/methods');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('local');
    });
  });

  describe('Protected Settings Access', () => {
    it('should require auth for admin settings', async () => {
      const response = await request(app)
        .get('/api/v1/admin/settings');

      expect(response.status).toBe(401);
    });

    it('should require auth for notification settings', async () => {
      const response = await request(app)
        .get('/api/v1/admin/notifications');

      expect(response.status).toBe(401);
    });

    it('should require auth for security settings', async () => {
      const response = await request(app)
        .get('/api/v1/admin/security');

      expect(response.status).toBe(401);
    });
  });

  describe('Health and Status', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/v1/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
    });
  });
});
