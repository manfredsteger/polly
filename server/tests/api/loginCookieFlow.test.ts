import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import { ADMIN_USERNAME, ADMIN_PASSWORD } from '../testCredentials';
import type { Express } from 'express';

export const testMeta = {
  category: 'security' as const,
  name: 'Login-Cookie Round-Trip',
  description:
    'Regression test for the Docker login bug — login must set a session cookie that the next request can use to access an authenticated endpoint, on plain HTTP.',
  severity: 'critical' as const,
};

/**
 * Regression: in the Docker variant the session cookie was marked Secure
 * even on plain-HTTP deployments. The login POST returned 200 but the
 * cookie was silently dropped by the browser, and the next request had no
 * session — the user bounced back to the login page with no error.
 *
 * This test mirrors the Docker scenario by running the test app over plain
 * HTTP (supertest never speaks HTTPS) and verifying the cookie survives
 * the round-trip.
 */
describe('API - Login cookie round-trip (Docker / plain HTTP)', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  it('logs in and accesses /api/v1/users/me with the same cookie', async () => {
    const agent = request.agent(app);

    const loginRes = await agent
      .post('/api/v1/auth/login')
      .send({ usernameOrEmail: ADMIN_USERNAME, password: ADMIN_PASSWORD });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body?.user?.username).toBe(ADMIN_USERNAME);

    // The server must have set a session cookie. supertest agent stores it.
    const setCookie = loginRes.headers['set-cookie'];
    expect(setCookie, 'login response must Set-Cookie polly.sid').toBeDefined();
    const cookieHeader = Array.isArray(setCookie) ? setCookie.join(';') : String(setCookie);
    expect(cookieHeader).toMatch(/polly\.sid=/);

    // Regression: the cookie must NOT be marked Secure when the app is
    // reached over plain HTTP (Docker default). A Secure flag here would
    // cause browsers to silently drop the cookie and bounce the user
    // back to the login page — the exact bug shipped in beta.2.
    expect(
      cookieHeader,
      'session cookie must not be Secure on plain-HTTP deployments',
    ).not.toMatch(/;\s*Secure/i);

    const meRes = await agent.get('/api/v1/auth/me');
    expect(meRes.status).toBe(200);
    expect(
      meRes.body?.user?.username,
      'session cookie must carry an authenticated user across requests',
    ).toBe(ADMIN_USERNAME);
  });

  it('returns user=null on /me when no cookie is sent (sanity check)', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(200);
    expect(res.body?.user).toBeNull();
  });
});
