import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import type { Express } from 'express';

export const testMeta = {
  category: 'security' as const,
  name: 'Admin-Endpunkte',
  description: 'Prüft Zugriffskontrolle und Funktionalität der Admin-Schnittstellen',
  severity: 'critical' as const,
};

describe('API - Admin Endpoints', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  it('should reject access to admin settings without auth', async () => {
    const response = await request(app).get('/api/v1/admin/settings');
    
    expect(response.status).toBe(401);
  });

  it('should reject access to user list without auth', async () => {
    const response = await request(app).get('/api/v1/admin/users');
    
    expect(response.status).toBe(401);
  });

  it('should reject access to test configurations without auth', async () => {
    const response = await request(app).get('/api/v1/admin/tests/configurations');
    
    expect(response.status).toBe(401);
  });

  it('should reject POST to admin endpoints without auth', async () => {
    const response = await request(app)
      .post('/api/v1/admin/settings')
      .send({ siteName: 'Test' });
    
    expect(response.status).toBe(401);
  });

  it('should reject DELETE to admin endpoints without auth', async () => {
    const response = await request(app)
      .delete('/api/v1/admin/users/1');
    
    expect(response.status).toBe(401);
  });

  it('should reject access to ClamAV settings without auth', async () => {
    const response = await request(app).get('/api/v1/admin/clamav');
    
    expect(response.status).toBe(401);
  });

  it('should reject access to pentest tools config without auth', async () => {
    const response = await request(app).get('/api/v1/admin/pentest-tools/config');
    
    expect(response.status).toBe(401);
  });

  it('should reject running tests without auth', async () => {
    const response = await request(app)
      .post('/api/v1/admin/tests/run');
    
    expect(response.status).toBe(401);
  });
});
