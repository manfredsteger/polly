import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { createTestApp } from '../testApp';
import { ADMIN_USERNAME, ADMIN_PASSWORD } from '../testCredentials';
import { storage } from '../../storage';
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

  it('should reject access to customization settings without auth', async () => {
    const response = await request(app).get('/api/v1/admin/customization');
    
    expect(response.status).toBe(401);
  });

  it('should reject updating customization settings without auth', async () => {
    const response = await request(app)
      .put('/api/v1/admin/customization')
      .send({ 
        branding: { siteName: 'Test', siteNameAccent: 'App' }
      });
    
    expect(response.status).toBe(401);
  });

  it('should reject access to deletion requests without auth', async () => {
    const response = await request(app).get('/api/v1/admin/deletion-requests');
    
    expect(response.status).toBe(401);
  });

  it('should reject confirming deletion without auth', async () => {
    const response = await request(app)
      .post('/api/v1/admin/deletion-requests/1/confirm');
    
    expect(response.status).toBe(401);
  });

  it('should reject rejecting deletion without auth', async () => {
    const response = await request(app)
      .post('/api/v1/admin/deletion-requests/1/reject');
    
    expect(response.status).toBe(401);
  });
});

describe('API - Admin Password Management', () => {
  let app: Express;
  let agent: ReturnType<typeof request.agent>;
  let localUserId: number;
  let oidcUserId: number;
  let originalPasswordHash: string;

  beforeAll(async () => {
    app = await createTestApp();
    agent = request.agent(app);
    await agent
      .post('/api/v1/auth/login')
      .send({ usernameOrEmail: ADMIN_USERNAME, password: ADMIN_PASSWORD });

    const suffix = nanoid(8);
    originalPasswordHash = await bcrypt.hash('OriginalPass123!', 10);

    const localUser = await storage.createUser({
      email: `pwd-local-${suffix}@test.local`,
      username: `pwd_local_${suffix}`,
      name: 'Password Test Local',
      passwordHash: originalPasswordHash,
      role: 'user',
      provider: 'local',
      isTestData: true,
    });
    localUserId = localUser.id;

    const oidcUser = await storage.createUser({
      email: `pwd-oidc-${suffix}@test.local`,
      username: `pwd_oidc_${suffix}`,
      name: 'Password Test OIDC',
      role: 'user',
      provider: 'keycloak',
      isTestData: true,
    });
    oidcUserId = oidcUser.id;
  });

  afterAll(async () => {
    for (const id of [localUserId, oidcUserId]) {
      try { await storage.deleteUser(id); } catch {}
    }
  });

  describe('POST /admin/users/:id/send-password-reset', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await request(app).post(`/api/v1/admin/users/${localUserId}/send-password-reset`);
      expect(res.status).toBe(401);
    });

    it('returns 404 for unknown user', async () => {
      const res = await agent.post('/api/v1/admin/users/9999999/send-password-reset');
      expect(res.status).toBe(404);
    });

    it('rejects non-local users', async () => {
      const res = await agent.post(`/api/v1/admin/users/${oidcUserId}/send-password-reset`);
      expect(res.status).toBe(400);
    });

    it('succeeds for valid local user with email', async () => {
      const res = await agent.post(`/api/v1/admin/users/${localUserId}/send-password-reset`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /admin/users/:id/set-password', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/users/${localUserId}/set-password`)
        .send({ password: 'NewSecurePass123!' });
      expect(res.status).toBe(401);
    });

    it('returns 404 for unknown user', async () => {
      const res = await agent
        .post('/api/v1/admin/users/9999999/set-password')
        .send({ password: 'NewSecurePass123!' });
      expect(res.status).toBe(404);
    });

    it('rejects weak password', async () => {
      const res = await agent
        .post(`/api/v1/admin/users/${localUserId}/set-password`)
        .send({ password: 'short' });
      expect(res.status).toBe(400);
    });

    it('rejects missing password', async () => {
      const res = await agent
        .post(`/api/v1/admin/users/${localUserId}/set-password`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('rejects non-local users', async () => {
      const res = await agent
        .post(`/api/v1/admin/users/${oidcUserId}/set-password`)
        .send({ password: 'NewSecurePass123!' });
      expect(res.status).toBe(400);
    });

    it('updates password for valid local user', async () => {
      const newPassword = 'NewSecurePass456!';
      const res = await agent
        .post(`/api/v1/admin/users/${localUserId}/set-password`)
        .send({ password: newPassword });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updated = await storage.getUser(localUserId);
      expect(updated?.passwordHash).toBeTruthy();
      expect(updated?.passwordHash).not.toBe(originalPasswordHash);
      const matches = await bcrypt.compare(newPassword, updated!.passwordHash!);
      expect(matches).toBe(true);
    });
  });
});

describe('API - Admin User Username Update', () => {
  let app: Express;
  let agent: ReturnType<typeof request.agent>;
  let userAId: number;
  let userBId: number;
  let originalUsernameA: string;

  beforeAll(async () => {
    app = await createTestApp();
    agent = request.agent(app);
    await agent
      .post('/api/v1/auth/login')
      .send({ usernameOrEmail: ADMIN_USERNAME, password: ADMIN_PASSWORD });

    const suffix = Math.random().toString(36).slice(2, 10);
    originalUsernameA = `uname_a_${suffix}`;

    const userA = await storage.createUser({
      email: `uname-a-${suffix}@test.local`,
      username: originalUsernameA,
      name: 'Username Test A',
      passwordHash: await bcrypt.hash('TestPass123!', 10),
      role: 'user',
      provider: 'local',
      isTestData: true,
    });
    userAId = userA.id;

    const userB = await storage.createUser({
      email: `uname-b-${suffix}@test.local`,
      username: `uname_b_${suffix}`,
      name: 'Username Test B',
      passwordHash: await bcrypt.hash('TestPass123!', 10),
      role: 'user',
      provider: 'local',
      isTestData: true,
    });
    userBId = userB.id;
  });

  afterAll(async () => {
    for (const id of [userAId, userBId]) {
      try { await storage.deleteUser(id); } catch {}
    }
  });

  describe('PATCH /admin/users/:id — username field', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${userAId}`)
        .send({ username: 'new_name' });
      expect(res.status).toBe(401);
    });

    it('updates username successfully', async () => {
      const alphaSuffix = Math.random().toString(36).slice(2, 8);
      const newUsername = `updated_${alphaSuffix}`;
      const res = await agent
        .patch(`/api/v1/admin/users/${userAId}`)
        .send({ username: newUsername });
      expect(res.status).toBe(200);
      expect(res.body.username).toBe(newUsername.toLowerCase());

      const updated = await storage.getUser(userAId);
      expect(updated?.username).toBe(newUsername.toLowerCase());
      originalUsernameA = updated!.username;
    });

    it('rejects username shorter than 3 characters', async () => {
      const res = await agent
        .patch(`/api/v1/admin/users/${userAId}`)
        .send({ username: 'ab' });
      expect(res.status).toBe(400);
    });

    it('rejects username with invalid characters (space)', async () => {
      const res = await agent
        .patch(`/api/v1/admin/users/${userAId}`)
        .send({ username: 'bad name' });
      expect(res.status).toBe(400);
    });

    it('rejects username with invalid characters (hyphen)', async () => {
      const res = await agent
        .patch(`/api/v1/admin/users/${userAId}`)
        .send({ username: 'bad-name' });
      expect(res.status).toBe(400);
    });

    it('rejects username already taken by another user (409)', async () => {
      const userBCurrent = await storage.getUser(userBId);
      const res = await agent
        .patch(`/api/v1/admin/users/${userAId}`)
        .send({ username: userBCurrent!.username });
      expect(res.status).toBe(409);
    });

    it('allows setting the same username the user already has (no conflict)', async () => {
      const current = await storage.getUser(userAId);
      const res = await agent
        .patch(`/api/v1/admin/users/${userAId}`)
        .send({ username: current!.username });
      expect(res.status).toBe(200);
    });

    it('trims and lowercases the username', async () => {
      const alphaSuffix = Math.random().toString(36).slice(2, 8);
      const res = await agent
        .patch(`/api/v1/admin/users/${userAId}`)
        .send({ username: `  Mixed_Case_${alphaSuffix}  ` });
      expect(res.status).toBe(200);
      expect(res.body.username).toBe(`mixed_case_${alphaSuffix}`);
    });
  });
});
