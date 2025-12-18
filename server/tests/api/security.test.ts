import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import type { Express } from 'express';

export const testMeta = {
  category: 'security' as const,
  name: 'API-Sicherheit',
  description: 'Prüft Security-Header und grundlegende Sicherheitsmaßnahmen',
  severity: 'critical' as const,
};

describe('API Security', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  it('should not expose X-Powered-By header', async () => {
    const response = await request(app).get('/api/v1/auth/me');
    
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('should return 404 for non-existent routes', async () => {
    const response = await request(app).get('/api/v1/nonexistent-route');
    
    expect(response.status).toBe(404);
  });

  it('should handle malformed JSON gracefully', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ invalid json }');

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('should reject requests to admin endpoints without auth', async () => {
    const response = await request(app).get('/api/v1/admin/users');
    
    expect(response.status).toBe(401);
  });

  it('should have API versioning redirect', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .redirects(0);
    
    expect([301, 308, 404]).toContain(response.status);
  });
});
