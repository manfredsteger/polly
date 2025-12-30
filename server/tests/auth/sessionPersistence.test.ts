import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import type { Express } from 'express';
import { storage } from '../../storage';

export const testMeta = {
  category: 'auth' as const,
  name: 'Session-Persistenz',
  description: 'Kritische Tests für Session-Persistenz nach Login, Reload und zwischen Requests',
  severity: 'critical' as const,
};

async function createTestUserDirectly() {
  const email = `sessiontest-${nanoid(8)}@example.com`;
  const password = 'TestPassword123!';
  const username = `sessuser_${nanoid(8)}`;
  const passwordHash = await bcrypt.hash(password, 10);
  
  await storage.createUser({
    email,
    username,
    name: 'Session Test User',
    passwordHash,
    role: 'user',
    provider: 'local',
    isTestData: true,
  });
  
  return { email, password, username, name: 'Session Test User' };
}

describe('Session Persistence - CRITICAL', () => {
  let app: Express;
  let testUser: { email: string; password: string; username: string; name: string };

  beforeAll(async () => {
    app = await createTestApp();
    testUser = await createTestUserDirectly();
  });

  describe('Login Session Creation', () => {
    it('should create a valid session on successful login', async () => {
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          usernameOrEmail: testUser.email,
          password: testUser.password,
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.user).toBeDefined();
      expect(loginResponse.body.user.email).toBe(testUser.email);
      
      const cookies = loginResponse.headers['set-cookie'];
      expect(cookies).toBeDefined();
      
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      expect(cookieArray.length).toBeGreaterThan(0);
      
      const sessionCookie = cookieArray.find((c: string) => c.startsWith('polly.sid='));
      expect(sessionCookie).toBeDefined();
    });

    it('should return user data immediately after login', async () => {
      const agent = request.agent(app);

      const loginResponse = await agent
        .post('/api/v1/auth/login')
        .send({
          usernameOrEmail: testUser.email,
          password: testUser.password,
        });

      expect(loginResponse.status).toBe(200);

      const authResponse = await agent.get('/api/v1/auth/me');
      
      expect(authResponse.status).toBe(200);
      expect(authResponse.body.user).not.toBeNull();
      expect(authResponse.body.user.email).toBe(testUser.email);
    });
  });

  describe('Session Persistence Across Multiple Requests', () => {
    it('should maintain session across multiple sequential requests', async () => {
      const agent = request.agent(app);

      await agent
        .post('/api/v1/auth/login')
        .send({
          usernameOrEmail: testUser.email,
          password: testUser.password,
        });

      for (let i = 0; i < 5; i++) {
        const response = await agent.get('/api/v1/auth/me');
        expect(response.status).toBe(200);
        expect(response.body.user).not.toBeNull();
        expect(response.body.user.email).toBe(testUser.email);
      }
    });

    it('should maintain session for protected endpoints', async () => {
      const agent = request.agent(app);

      await agent
        .post('/api/v1/auth/login')
        .send({
          usernameOrEmail: testUser.email,
          password: testUser.password,
        });

      const meResponse = await agent.get('/api/v1/auth/me');
      expect(meResponse.body.user).not.toBeNull();

      const profileResponse = await agent.get('/api/v1/users/me/profile');
      expect([200, 404]).toContain(profileResponse.status);

      const meAgainResponse = await agent.get('/api/v1/auth/me');
      expect(meAgainResponse.body.user).not.toBeNull();
    });
  });

  describe('Session After Logout', () => {
    it('should invalidate session after logout', async () => {
      const agent = request.agent(app);

      await agent
        .post('/api/v1/auth/login')
        .send({
          usernameOrEmail: testUser.email,
          password: testUser.password,
        });

      const beforeLogout = await agent.get('/api/v1/auth/me');
      expect(beforeLogout.body.user).not.toBeNull();

      await agent.post('/api/v1/auth/logout');

      const afterLogout = await agent.get('/api/v1/auth/me');
      expect(afterLogout.body.user).toBeNull();
    });

    it('should not allow access to protected endpoints after logout', async () => {
      const agent = request.agent(app);

      await agent
        .post('/api/v1/auth/login')
        .send({
          usernameOrEmail: testUser.email,
          password: testUser.password,
        });

      await agent.post('/api/v1/auth/logout');

      const protectedResponse = await agent.get('/api/v1/admin/users');
      expect(protectedResponse.status).toBe(401);
    });
  });

  describe('Session Cookie Validity', () => {
    it('should reject requests with manipulated session cookie', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', 'polly.sid=s%3Ainvalid-session-id.fake-signature');

      expect(response.status).toBe(200);
      expect(response.body.user).toBeNull();
    });

    it('should reject requests with expired session cookie format', async () => {
      const response = await request(app)
        .get('/api/v1/admin/users')
        .set('Cookie', 'polly.sid=completely-invalid-format');

      expect(response.status).toBe(401);
    });
  });

  describe('Multiple User Sessions', () => {
    it('should maintain separate sessions for different users', async () => {
      const agent1 = request.agent(app);
      const agent2 = request.agent(app);
      
      const user2 = await createTestUserDirectly();

      await agent1
        .post('/api/v1/auth/login')
        .send({
          usernameOrEmail: testUser.email,
          password: testUser.password,
        });

      await agent2
        .post('/api/v1/auth/login')
        .send({
          usernameOrEmail: user2.email,
          password: user2.password,
        });

      const response1 = await agent1.get('/api/v1/auth/me');
      const response2 = await agent2.get('/api/v1/auth/me');

      expect(response1.body.user.email).toBe(testUser.email);
      expect(response2.body.user.email).toBe(user2.email);
      expect(response1.body.user.id).not.toBe(response2.body.user.id);
    });
  });
});
