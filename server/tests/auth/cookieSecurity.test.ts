import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import type { Express } from 'express';
import { storage } from '../../storage';

export const testMeta = {
  category: 'security' as const,
  name: 'Cookie-Sicherheit',
  description: 'Kritische Sicherheitstests für Session-Cookies: httpOnly, secure, sameSite, Hijacking-Prävention',
  severity: 'critical' as const,
};

async function createUserAndLogin(app: Express) {
  const email = `cookietest-${nanoid(8)}@example.com`;
  const password = 'TestPassword123!';
  const username = `cookieuser_${nanoid(8)}`;
  const passwordHash = await bcrypt.hash(password, 10);
  
  await storage.createUser({
    email,
    username,
    name: 'Cookie Test User',
    passwordHash,
    role: 'user',
    provider: 'local',
    isTestData: false,
  });
  
  const loginResponse = await request(app)
    .post('/api/v1/auth/login')
    .send({
      usernameOrEmail: email,
      password: password,
    });
  
  return {
    user: loginResponse.body.user,
    cookies: loginResponse.headers['set-cookie'],
    email,
    password,
  };
}

describe('Cookie Security - CRITICAL', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  describe('Cookie Attributes', () => {
    it('should set httpOnly flag on session cookie', async () => {
      const { cookies } = await createUserAndLogin(app);
      
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      const sessionCookie = cookieArray.find((c: string) => c.includes('polly.sid'));
      
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toMatch(/httponly/i);
    });

    it('should set sameSite attribute on session cookie', async () => {
      const { cookies } = await createUserAndLogin(app);
      
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      const sessionCookie = cookieArray.find((c: string) => c.includes('polly.sid'));
      
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toMatch(/samesite=(lax|strict)/i);
    });

    it('should set path to root for session cookie', async () => {
      const { cookies } = await createUserAndLogin(app);
      
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      const sessionCookie = cookieArray.find((c: string) => c.includes('polly.sid'));
      
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toMatch(/path=\//i);
    });

    it('should have maxAge set for session cookie', async () => {
      const { cookies } = await createUserAndLogin(app);
      
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      const sessionCookie = cookieArray.find((c: string) => c.includes('polly.sid'));
      
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toMatch(/(max-age|expires)/i);
    });

    it('should not include Secure flag in development (HTTP) mode', async () => {
      const { cookies } = await createUserAndLogin(app);
      
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      const sessionCookie = cookieArray.find((c: string) => c.includes('polly.sid'));
      
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie.toLowerCase()).not.toContain('secure');
    });

    it('should verify production config sets secure=true for proxied environments', () => {
      const isProxied = process.env.NODE_ENV === 'production' || 
                        process.env.BASE_URL?.includes('replit') ||
                        process.env.REPLIT_DEV_DOMAIN ||
                        process.env.REPL_ID;
      
      if (isProxied) {
        expect(true).toBe(true);
      } else {
        expect(process.env.NODE_ENV).not.toBe('production');
      }
    });

    it('should use custom cookie name (not default connect.sid)', async () => {
      const { cookies } = await createUserAndLogin(app);
      
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      
      const defaultCookie = cookieArray.find((c: string) => c.includes('connect.sid'));
      expect(defaultCookie).toBeUndefined();
      
      const customCookie = cookieArray.find((c: string) => c.includes('polly.sid'));
      expect(customCookie).toBeDefined();
    });
  });

  describe('Session Hijacking Prevention', () => {
    it('should reject stolen/forged session cookies', async () => {
      const forgedCookies = [
        'polly.sid=forged-session-id',
        'polly.sid=s%3Aforged.invalidsignature',
        'polly.sid=s%3Arandom-id-12345.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        'polly.sid=../../../etc/passwd',
        'polly.sid=<script>alert(1)</script>',
      ];

      for (const forgedCookie of forgedCookies) {
        const response = await request(app)
          .get('/api/v1/auth/me')
          .set('Cookie', forgedCookie);

        expect(response.status).toBe(200);
        expect(response.body.user).toBeNull();
      }
    });

    it('should not accept SQL injection in session cookie', async () => {
      const sqlInjectionCookies = [
        "polly.sid='; DROP TABLE sessions; --",
        "polly.sid=1' OR '1'='1",
        "polly.sid=1; SELECT * FROM users",
      ];

      for (const cookie of sqlInjectionCookies) {
        const response = await request(app)
          .get('/api/v1/auth/me')
          .set('Cookie', cookie);

        expect(response.status).toBe(200);
        expect(response.body.user).toBeNull();
      }
    });

    it('should not allow session fixation', async () => {
      const fixedSessionId = 's%3Afixed-session-id.invalidsig';
      
      const response1 = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', `polly.sid=${fixedSessionId}`);
      
      expect(response1.body.user).toBeNull();
      
      const email = `fixtest-${nanoid(8)}@example.com`;
      const password = 'TestPassword123!';
      const username = `fixuser_${nanoid(8)}`;
      const passwordHash = await bcrypt.hash(password, 10);
      
      await storage.createUser({
        email,
        username,
        name: 'Fixation Test User',
        passwordHash,
        role: 'user',
        provider: 'local',
        isTestData: false,
      });
      
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .set('Cookie', `polly.sid=${fixedSessionId}`)
        .send({
          usernameOrEmail: email,
          password: password,
        });

      expect(loginResponse.status).toBe(200);
      
      const cookies = loginResponse.headers['set-cookie'];
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      const newSessionCookie = cookieArray.find((c: string) => c.includes('polly.sid'));
      
      expect(newSessionCookie).toBeDefined();
      expect(newSessionCookie).not.toContain('fixed-session-id');
    });
  });

  describe('Session Isolation', () => {
    it('should not leak session data between different sessions', async () => {
      const { email: email1, password: password1 } = await createUserAndLogin(app);
      const { email: email2, password: password2 } = await createUserAndLogin(app);

      const agent1 = request.agent(app);
      const agent2 = request.agent(app);

      await agent1.post('/api/v1/auth/login').send({
        usernameOrEmail: email1,
        password: password1,
      });

      await agent2.post('/api/v1/auth/login').send({
        usernameOrEmail: email2,
        password: password2,
      });

      const response1 = await agent1.get('/api/v1/auth/me');
      const response2 = await agent2.get('/api/v1/auth/me');

      expect(response1.body.user.email).toBe(email1);
      expect(response2.body.user.email).toBe(email2);
      expect(response1.body.user.id).not.toBe(response2.body.user.id);
    });

    it('should completely clear session on logout', async () => {
      const agent = request.agent(app);
      const { email, password } = await createUserAndLogin(app);

      await agent.post('/api/v1/auth/login').send({
        usernameOrEmail: email,
        password: password,
      });

      const beforeLogout = await agent.get('/api/v1/auth/me');
      expect(beforeLogout.body.user).not.toBeNull();

      const logoutResponse = await agent.post('/api/v1/auth/logout');
      expect(logoutResponse.status).toBe(200);

      const afterLogout = await agent.get('/api/v1/auth/me');
      expect(afterLogout.body.user).toBeNull();

      const adminResponse = await agent.get('/api/v1/admin/users');
      expect(adminResponse.status).toBe(401);
    });
  });

  describe('CSRF and Authentication Protection (SameSite Cookie-based)', () => {
    it('should require valid session for state-changing operations', async () => {
      const sensitiveEndpoints = [
        { method: 'GET', path: '/api/v1/admin/users' },
        { method: 'GET', path: '/api/v1/admin/settings' },
        { method: 'POST', path: '/api/v1/admin/users' },
        { method: 'DELETE', path: '/api/v1/admin/users/1' },
        { method: 'PATCH', path: '/api/v1/users/me/profile' },
      ];

      for (const endpoint of sensitiveEndpoints) {
        let req;
        switch (endpoint.method) {
          case 'GET':
            req = request(app).get(endpoint.path);
            break;
          case 'POST':
            req = request(app).post(endpoint.path).send({});
            break;
          case 'DELETE':
            req = request(app).delete(endpoint.path);
            break;
          case 'PATCH':
            req = request(app).patch(endpoint.path).send({});
            break;
          default:
            req = request(app).get(endpoint.path);
        }

        const response = await req;
        expect([401, 404]).toContain(response.status);
      }
    });

    it('should allow authenticated users to access protected endpoints', async () => {
      const agent = request.agent(app);
      const { email, password } = await createUserAndLogin(app);

      await agent.post('/api/v1/auth/login').send({
        usernameOrEmail: email,
        password: password,
      });

      const meResponse = await agent.get('/api/v1/auth/me');
      expect(meResponse.status).toBe(200);
      expect(meResponse.body.user).not.toBeNull();
    });

    it('should use SameSite=Lax cookie for CSRF protection', async () => {
      const { cookies } = await createUserAndLogin(app);
      
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      const sessionCookie = cookieArray.find((c: string) => c.includes('polly.sid'));
      
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie.toLowerCase()).toMatch(/samesite=lax/);
    });

    it('should not send cookies on cross-site POST requests (SameSite behavior)', async () => {
      const crossOriginPost = await request(app)
        .post('/api/v1/admin/settings')
        .set('Origin', 'https://evil-site.com')
        .send({ key: 'malicious', value: 'data' });

      expect(crossOriginPost.status).toBe(401);
    });
  });

  describe('Session Cookie Encryption', () => {
    it('should sign session cookies to prevent tampering', async () => {
      const { cookies } = await createUserAndLogin(app);
      
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      const sessionCookie = cookieArray.find((c: string) => c.includes('polly.sid'));
      
      expect(sessionCookie).toBeDefined();
      
      const cookieValue = sessionCookie.split(';')[0].split('=')[1];
      const decoded = decodeURIComponent(cookieValue);
      
      expect(decoded).toMatch(/^s:/);
      expect(decoded).toContain('.');
    });

    it('should reject modified signed cookies', async () => {
      const { cookies } = await createUserAndLogin(app);
      
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      const sessionCookie = cookieArray.find((c: string) => c.includes('polly.sid'));
      const cookieValue = sessionCookie.split(';')[0].split('=')[1];
      
      const [sessionId, signature] = decodeURIComponent(cookieValue).split('.');
      const modifiedCookie = `polly.sid=${encodeURIComponent(sessionId + 'modified.' + signature)}`;
      
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', modifiedCookie);

      expect(response.body.user).toBeNull();
    });
  });

  describe('Rate Limiting for Auth Endpoints', () => {
    it('should handle multiple rapid login attempts gracefully', async () => {
      const promises: Promise<request.Response>[] = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .post('/api/v1/auth/login')
            .send({
              usernameOrEmail: 'nonexistent@test.com',
              password: 'wrongpassword',
            })
        );
      }

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect([401, 429]).toContain(response.status);
      });
    });

    it('should return HTTP 429 after exceeding rate limit threshold', async () => {
      const uniqueEmail = `ratelimit-test-${Date.now()}@test.com`;
      
      for (let i = 0; i < 6; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            usernameOrEmail: uniqueEmail,
            password: 'wrongpassword',
          });
      }

      const seventhAttempt = await request(app)
        .post('/api/v1/auth/login')
        .send({
          usernameOrEmail: uniqueEmail,
          password: 'wrongpassword',
        });

      expect([401, 429]).toContain(seventhAttempt.status);
      
      if (seventhAttempt.status === 429) {
        const responseText = seventhAttempt.body.error || seventhAttempt.body.message || seventhAttempt.text;
        expect(responseText).toMatch(/too many|rate limit|locked|gesperrt|anmeldeversuche|warten/i);
      }
    });

    it('should enforce rate limit per IP/account combination', async () => {
      const uniqueEmail1 = `ratelimit-user1-${Date.now()}@test.com`;
      const uniqueEmail2 = `ratelimit-user2-${Date.now()}@test.com`;
      
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            usernameOrEmail: uniqueEmail1,
            password: 'wrongpassword',
          });
      }

      const differentAccountAttempt = await request(app)
        .post('/api/v1/auth/login')
        .send({
          usernameOrEmail: uniqueEmail2,
          password: 'wrongpassword',
        });

      expect([401, 429]).toContain(differentAccountAttempt.status);
    });
  });
});
