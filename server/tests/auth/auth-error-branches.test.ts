/**
 * Scenario tests for login, registration, account and MFA error branches in
 * server/routes/auth.ts: rate limits and lockouts, forced MFA setup, session
 * store failures (regenerate/save/destroy), SSO (Keycloak) entry and callback
 * paths, single logout, and the 500 handlers. Session failures are simulated
 * by stubbing express-session's Session prototype for exactly one call.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import session from 'express-session';
import type { Express } from 'express';
import { createTestApp } from '../testApp';
import { storage } from '../../storage';
import { authService } from '../../services/authService';
import { tokenService } from '../../services/tokenService';
import { emailService } from '../../services/emailService';
import { loginRateLimiter } from '../../services/rateLimiterService';
import { emailCheckRateLimits, EMAIL_CHECK_LIMIT } from '../../routes/common';
import { generateTotpForTest, generateTotpSecret } from '../../lib/totpService';
import { createLoggedInUser, type CreatedTestUser } from '../fixtures/users';

export const testMeta = {
  category: 'auth' as const,
  name: 'Anmeldung – Fehlerpfade',
  description: 'Prüft Login-, Registrierungs-, SSO- und MFA-Fehlerpfade',
  severity: 'critical' as const,
};

type SessionMethod = 'regenerate' | 'save' | 'destroy';
const SessionProto = (session as unknown as { Session: { prototype: Record<SessionMethod, (cb: (err?: Error) => void) => unknown> } }).Session.prototype;

/** Make the next call of a session method fail with an error. */
function failSessionOnce(method: SessionMethod) {
  return vi.spyOn(SessionProto, method).mockImplementationOnce(function (this: unknown, cb: (err?: Error) => void) {
    cb(new Error(`${method} failed`));
    return this;
  });
}

let app: Express;
const createdUserIds: number[] = [];

async function newUser(overrides: Parameters<typeof createLoggedInUser>[1] = {}): Promise<CreatedTestUser> {
  const user = await createLoggedInUser(app, overrides);
  createdUserIds.push(user.id);
  return user;
}

const ENV_KEYS = ['KEYCLOAK_REALM', 'KEYCLOAK_AUTH_SERVER_URL', 'KEYCLOAK_URL', 'KEYCLOAK_ISSUER_URL', 'SSO_BUTTON_LABEL', 'HIDE_LOGIN_FORM', 'SSO_AUTO_REDIRECT', 'SSO_SINGLE_LOGOUT'] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeAll(async () => {
  app = await createTestApp();
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

afterAll(async () => {
  for (const id of createdUserIds) {
    await storage.deleteUser(id).catch(() => {});
  }
});

describe('GET /auth/me and deletion requests', () => {
  it('drops the session when the logged-in user was deleted', async () => {
    const user = await newUser();
    vi.spyOn(storage, 'getUser').mockResolvedValueOnce(undefined);
    const res = await user.agent.get('/api/v1/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
    // The session is gone, so the next call is anonymous as well.
    vi.restoreAllMocks();
    const after = await user.agent.get('/api/v1/auth/me');
    expect(after.body.user).toBeNull();
  });

  it('returns 500 when the user lookup fails', async () => {
    const user = await newUser();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(storage, 'getUser').mockRejectedValueOnce(new Error('db down'));
    expect((await user.agent.get('/api/v1/auth/me')).status).toBe(500);
  });

  it('notifies admins about a deletion request and tolerates notification failures', async () => {
    const user = await newUser();
    vi.spyOn(storage, 'getAdminUsers').mockResolvedValueOnce([{ email: 'boss@test.example' } as any]);
    const notify = vi.spyOn(emailService, 'sendDeletionRequestNotification').mockRejectedValueOnce(new Error('smtp down'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await user.agent.post('/api/v1/auth/request-deletion');
    expect(res.status).toBe(200);
    expect(notify).toHaveBeenCalledWith(['boss@test.example'], expect.any(String), user.email, expect.stringContaining('deletion-requests'));
    await vi.waitFor(() => expect(err).toHaveBeenCalledWith('[GDPR] Failed to notify admins:', expect.any(Error)));

    const again = await user.agent.post('/api/v1/auth/request-deletion');
    expect(again.status).toBe(400);
  });

  it('keeps the deletion request when the admin lookup throws', async () => {
    const user = await newUser();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(storage, 'getAdminUsers').mockRejectedValueOnce(new Error('db down'));
    const res = await user.agent.post('/api/v1/auth/request-deletion');
    expect(res.status).toBe(200);
    expect(res.body.deletionRequestedAt).toBeTruthy();
  });

  it('returns 404/500 for deletion requests of vanished users or failing storage', async () => {
    const user = await newUser();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.spyOn(storage, 'getUser').mockResolvedValue(undefined);
    expect((await user.agent.post('/api/v1/auth/request-deletion')).status).toBe(404);
    expect((await user.agent.delete('/api/v1/auth/request-deletion')).status).toBe(404);
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.spyOn(storage, 'requestDeletion').mockRejectedValueOnce(new Error('db down'));
    expect((await user.agent.post('/api/v1/auth/request-deletion')).status).toBe(500);
    vi.spyOn(storage, 'getUser').mockRejectedValue(new Error('db down'));
    expect((await user.agent.delete('/api/v1/auth/request-deletion')).status).toBe(500);
  });
});

describe('GET /auth/methods – SSO configuration', () => {
  it('exposes the Keycloak account URL, DB button label, hidden form and auto-redirect', async () => {
    vi.spyOn(authService, 'isKeycloakEnabled').mockReturnValue(true);
    process.env.KEYCLOAK_REALM = 'kita';
    process.env.KEYCLOAK_URL = 'https://sso.example.com';
    process.env.KEYCLOAK_ISSUER_URL = 'https://sso.example.com/realms/kita///';
    process.env.HIDE_LOGIN_FORM = 'TRUE';
    process.env.SSO_AUTO_REDIRECT = 'true';
    const getSetting = storage.getSetting.bind(storage);
    vi.spyOn(storage, 'getSetting').mockImplementation(async (key: string) =>
      key === 'oidc_button_label' ? ({ key, value: 'Mit KitaHub anmelden' } as any) : getSetting(key),
    );

    const res = await request(app).get('/api/v1/auth/methods');
    expect(res.status).toBe(200);
    expect(res.body.keycloak).toBe(true);
    expect(res.body.keycloakAccountUrl).toBe('https://sso.example.com/realms/kita/account');
    expect(res.body.ssoButtonLabel).toBe('Mit KitaHub anmelden');
    expect(res.body.showLoginForm).toBe(false);
    expect(res.body.autoRedirectSso).toBe(true);
  });

  it('falls back to the env button label when no DB label is stored', async () => {
    vi.spyOn(authService, 'isKeycloakEnabled').mockReturnValue(true);
    delete process.env.KEYCLOAK_REALM;
    delete process.env.HIDE_LOGIN_FORM;
    process.env.SSO_BUTTON_LABEL = 'Firmen-SSO';
    const getSetting = storage.getSetting.bind(storage);
    vi.spyOn(storage, 'getSetting').mockImplementation(async (key: string) =>
      key === 'oidc_button_label' ? undefined : getSetting(key),
    );
    const res = await request(app).get('/api/v1/auth/methods');
    expect(res.body.ssoButtonLabel).toBe('Firmen-SSO');
    expect(res.body.keycloakAccountUrl).toBeUndefined();
    expect(res.body.showLoginForm).toBe(true);
  });

  it('returns safe defaults when settings cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(storage, 'getSetting').mockRejectedValueOnce(new Error('db down'));
    const res = await request(app).get('/api/v1/auth/methods');
    expect(res.status).toBe(200);
    expect(res.body.registrationEnabled).toBe(true);
    expect(res.body.showLoginForm).toBe(true);
  });
});

describe('POST /auth/check-email – rate limit and identity branches', () => {
  afterEach(() => emailCheckRateLimits.clear());

  it('blocks once the per-IP limit is exhausted and resets after the window', async () => {
    emailCheckRateLimits.clear();
    const first = await request(app).post('/api/v1/auth/check-email').send({ email: 'free@test.example' });
    expect(first.status).toBe(200);
    const [ip] = [...emailCheckRateLimits.keys()];

    emailCheckRateLimits.set(ip, { count: EMAIL_CHECK_LIMIT, resetTime: Date.now() + 60_000 });
    const blocked = await request(app).post('/api/v1/auth/check-email').send({ email: 'free@test.example' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.retryAfter).toBeGreaterThan(0);

    emailCheckRateLimits.set(ip, { count: EMAIL_CHECK_LIMIT, resetTime: Date.now() - 1 });
    emailCheckRateLimits.set('203.0.113.9', { count: 1, resetTime: Date.now() - 10 * 60_000 });
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const reset = await request(app).post('/api/v1/auth/check-email').send({ email: 'free@test.example' });
    expect(reset.status).toBe(200);
    expect(emailCheckRateLimits.get(ip)?.count).toBe(1);
    expect(emailCheckRateLimits.has('203.0.113.9')).toBe(false);
  });

  it('asks Keycloak about unknown emails when OIDC is enabled', async () => {
    vi.spyOn(tokenService, 'isOIDCEnabled').mockReturnValue(true);
    const kc = vi.spyOn(tokenService, 'checkEmailExistsInKeycloak').mockResolvedValue(true);
    const res = await request(app).post('/api/v1/auth/check-email').send({ email: 'sso-only@test.example' });
    expect(res.status).toBe(200);
    expect(kc).toHaveBeenCalledWith('sso-only@test.example');
    expect(res.body).toMatchObject({ registered: true, requiresLogin: true, isKitaHubUser: true });
  });

  it('recognises the logged-in user\'s own email', async () => {
    const user = await newUser();
    const res = await user.agent.post('/api/v1/auth/check-email').send({ email: user.email.toUpperCase() });
    expect(res.body).toMatchObject({ registered: true, requiresLogin: false, isOwnEmail: true });
  });

  it('returns 500 when the lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(storage, 'getUserByEmail').mockRejectedValueOnce(new Error('db down'));
    expect((await request(app).post('/api/v1/auth/check-email').send({ email: 'x@test.example' })).status).toBe(500);
  });
});

describe('POST /auth/login – error branches', () => {
  it('answers 429 while the rate limiter blocks the account', async () => {
    vi.spyOn(loginRateLimiter, 'checkRateLimit').mockResolvedValueOnce({ allowed: false, remainingAttempts: 0, retryAfter: 300 } as any);
    const res = await request(app).post('/api/v1/auth/login').send({ usernameOrEmail: 'x', password: 'y' });
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('Zu viele Anmeldeversuche');
    expect(res.body.retryAfter).toBe(300);
  });

  it('reports a lockout with the wait time in minutes', async () => {
    vi.spyOn(loginRateLimiter, 'recordFailedAttempt').mockResolvedValueOnce({ locked: true, retryAfter: 120, remainingAttempts: 0 });
    const res = await request(app).post('/api/v1/auth/login').send({ usernameOrEmail: 'nobody-here', password: 'wrong' });
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/2 Minuten/);

    vi.spyOn(loginRateLimiter, 'recordFailedAttempt').mockResolvedValueOnce({ locked: true, retryAfter: 60, remainingAttempts: 0 });
    const single = await request(app).post('/api/v1/auth/login').send({ usernameOrEmail: 'nobody-here', password: 'wrong' });
    expect(single.body.error).toMatch(/1 Minute\./);
  });

  it('forces MFA setup for users flagged as mfaRequired', async () => {
    const user = await newUser();
    await storage.updateUser(user.id, { mfaRequired: true } as any);
    const agent = request.agent(app);
    const res = await agent.post('/api/v1/auth/login').send({ usernameOrEmail: user.username, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ requiresMfaSetup: true });

    // Completing the forced setup logs the user in.
    const init = await agent.post('/api/v1/auth/mfa/setup-init');
    expect(init.status).toBe(200);
    const confirm = await agent.post('/api/v1/auth/mfa/setup-confirm').send({ token: generateTotpForTest(init.body.secret) });
    expect(confirm.status).toBe(200);
    expect(confirm.body.user.id).toBe(user.id);
    expect((await agent.get('/api/v1/auth/me')).body.user.id).toBe(user.id);
  });

  it.each([
    ['regenerate', 'plain login'],
    ['save', 'plain login'],
  ] as const)('returns 500 when session %s fails during a %s', async (method) => {
    const user = await newUser();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    failSessionOnce(method);
    const res = await request(app).post('/api/v1/auth/login').send({ usernameOrEmail: user.username, password: user.password });
    expect(res.status).toBe(500);
  });

  it.each(['regenerate', 'save'] as const)('returns 500 when session %s fails during the MFA challenge', async (method) => {
    const user = await newUser();
    await storage.updateUser(user.id, { totpSecret: generateTotpSecret(), totpEnabled: true } as any);
    failSessionOnce(method);
    const res = await request(app).post('/api/v1/auth/login').send({ usernameOrEmail: user.username, password: user.password });
    expect(res.status).toBe(500);
  });

  it.each(['regenerate', 'save'] as const)('returns 500 when session %s fails during forced MFA setup', async (method) => {
    const user = await newUser();
    await storage.updateUser(user.id, { mfaRequired: true } as any);
    failSessionOnce(method);
    const res = await request(app).post('/api/v1/auth/login').send({ usernameOrEmail: user.username, password: user.password });
    expect(res.status).toBe(500);
  });

  it('returns 500 when the credential check throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(authService, 'localLogin').mockRejectedValueOnce(new Error('db down'));
    const res = await request(app).post('/api/v1/auth/login').send({ usernameOrEmail: 'x', password: 'y' });
    expect(res.status).toBe(500);
  });
});

describe('POST /auth/register – error branches', () => {
  const body = () => {
    const s = Math.random().toString(36).slice(2, 10);
    return { username: `reg_${s}`, email: `reg-${s}@test.example`, name: 'Reg Test', password: 'SecurePass123!' };
  };

  afterEach(async () => {
    await storage.setSetting({ key: 'registration_enabled', value: true });
  });

  it('refuses registration when it is disabled', async () => {
    await storage.setSetting({ key: 'registration_enabled', value: false });
    const res = await request(app).post('/api/v1/auth/register').send(body());
    expect(res.status).toBe(403);
  });

  it('rejects passwords that violate the policy', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ ...body(), password: 'alllowercaseletters' });
    expect(res.status).toBe(400);
  });

  it('rejects a taken username', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(authService, 'localRegister').mockResolvedValueOnce(null);
    const res = await request(app).post('/api/v1/auth/register').send(body());
    expect(res.status).toBe(400);
  });

  it('stores the UI language and survives a failing preference update and token creation', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(emailService, 'sendWelcomeEmail').mockRejectedValue(new Error('smtp down'));
    const b = body();
    const res = await request(app).post('/api/v1/auth/register').set('x-polly-language', 'en').send(b);
    expect(res.status).toBe(200);
    expect(res.body.user.languagePreference).toBe('en');
    createdUserIds.push(res.body.user.id);

    vi.spyOn(storage, 'updateUser').mockRejectedValueOnce(new Error('db down'));
    vi.spyOn(storage, 'createEmailVerificationToken').mockRejectedValueOnce(new Error('db down'));
    const second = await request(app).post('/api/v1/auth/register').set('x-polly-language', 'en').send(body());
    expect(second.status).toBe(200);
    createdUserIds.push(second.body.user.id);
  });

  it.each(['regenerate', 'save'] as const)('returns 500 when session %s fails after registering', async (method) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(emailService, 'sendWelcomeEmail').mockResolvedValue(undefined as any);
    failSessionOnce(method);
    const b = body();
    const res = await request(app).post('/api/v1/auth/register').send(b);
    expect(res.status).toBe(500);
    const created = await storage.getUserByUsername(b.username);
    if (created) createdUserIds.push(created.id);
  });

  it('returns 500 on unexpected registration errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(authService, 'localRegister').mockRejectedValueOnce(new Error('db down'));
    expect((await request(app).post('/api/v1/auth/register').send(body())).status).toBe(500);
  });
});

describe('Email verification and logout', () => {
  it('returns 500 when verifying an email fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(storage, 'getEmailVerificationToken').mockRejectedValueOnce(new Error('db down'));
    expect((await request(app).get('/api/v1/auth/verify-email/abc')).status).toBe(500);
  });

  it('handles missing users and failures when resending verification', async () => {
    const user = await newUser();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(storage, 'getUser').mockResolvedValue(undefined);
    expect((await user.agent.post('/api/v1/auth/resend-verification')).status).toBe(404);
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(storage, 'getUser').mockRejectedValue(new Error('db down'));
    expect((await user.agent.post('/api/v1/auth/resend-verification')).status).toBe(500);
  });

  it('builds a Keycloak single-logout URL for SSO sessions', async () => {
    const user = await newUser();
    process.env.SSO_SINGLE_LOGOUT = 'true';
    vi.spyOn(authService, 'isKeycloakEnabled').mockReturnValue(true);
    vi.spyOn(authService, 'getDisplayConfig').mockReturnValue({
      configured: true, enabled: true, issuerUrl: 'https://sso.example.com/realms/kita/', clientId: 'polly app', hasClientSecret: true, callbackUrl: '',
    });
    const real = await storage.getUser(user.id);
    vi.spyOn(storage, 'getUser').mockResolvedValue({ ...real!, provider: 'keycloak' } as any);

    const res = await user.agent.post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.keycloakLogoutUrl).toMatch(/^https:\/\/sso\.example\.com\/realms\/kita\/protocol\/openid-connect\/logout\?post_logout_redirect_uri=.+&client_id=polly%20app$/);
  });

  it.each([
    ['single logout disabled', { SSO_SINGLE_LOGOUT: 'false' }, true, 'https://sso.example.com', 'polly'],
    ['keycloak disabled', { SSO_SINGLE_LOGOUT: 'true' }, false, 'https://sso.example.com', 'polly'],
    ['incomplete client config', { SSO_SINGLE_LOGOUT: 'true' }, true, '', 'polly'],
  ] as const)('skips single logout when %s', async (_name, env, enabled, issuerUrl, clientId) => {
    const user = await newUser();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    Object.assign(process.env, env);
    vi.spyOn(authService, 'isKeycloakEnabled').mockReturnValue(enabled);
    vi.spyOn(authService, 'getDisplayConfig').mockReturnValue({ configured: true, enabled, issuerUrl, clientId, hasClientSecret: true, callbackUrl: '' });
    const real = await storage.getUser(user.id);
    vi.spyOn(storage, 'getUser').mockResolvedValue({ ...real!, provider: 'keycloak' } as any);
    const res = await user.agent.post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.keycloakLogoutUrl).toBeUndefined();
  });

  it('still logs out when the user lookup fails, and reports destroy errors', async () => {
    const user = await newUser();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(storage, 'getUser').mockRejectedValueOnce(new Error('db down'));
    expect((await user.agent.post('/api/v1/auth/logout')).status).toBe(200);

    const other = await newUser();
    failSessionOnce('destroy');
    expect((await other.agent.post('/api/v1/auth/logout')).status).toBe(500);
  });
});

describe('Password reset and change – error branches', () => {
  it('returns 500 when the password policy cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(storage, 'getCustomizationSettings').mockRejectedValueOnce(new Error('db down'));
    expect((await request(app).get('/api/v1/auth/password-policy')).status).toBe(500);
  });

  it('never reveals failures when requesting a reset', async () => {
    const user = await newUser();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(emailService, 'sendPasswordResetEmail').mockRejectedValueOnce(new Error('smtp down'));
    const ok = await request(app).post('/api/v1/auth/request-password-reset').send({ email: user.email });
    expect(ok.body.success).toBe(true);
    await vi.waitFor(() => expect(err).toHaveBeenCalledWith(expect.stringContaining('[Password Reset] Failed'), expect.any(Error)));

    vi.spyOn(storage, 'getUserByEmail').mockRejectedValueOnce(new Error('db down'));
    const failed = await request(app).post('/api/v1/auth/request-password-reset').send({ email: user.email });
    expect(failed.status).toBe(200);
    expect(failed.body.success).toBe(true);
  });

  it('resets the password, logs out an active session and tolerates mail errors', async () => {
    const user = await newUser();
    const token = await storage.createPasswordResetToken(user.id);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(emailService, 'sendPasswordChangedEmail').mockRejectedValueOnce(new Error('smtp down'));
    failSessionOnce('destroy');

    const res = await user.agent.post('/api/v1/auth/reset-password').send({ token: token.token, newPassword: 'NewSecure123!' });
    expect(res.status).toBe(200);
    expect(err).toHaveBeenCalledWith('Password reset logout error:', expect.any(Error));
  });

  it('rejects reset tokens of deleted users and reports storage failures', async () => {
    const user = await newUser();
    const token = await storage.createPasswordResetToken(user.id);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(storage, 'getUser').mockResolvedValueOnce(undefined);
    const missing = await request(app).post('/api/v1/auth/reset-password').send({ token: token.token, newPassword: 'NewSecure123!' });
    expect(missing.status).toBe(400);
    expect(missing.body.error).toBe('Benutzer nicht gefunden');

    vi.spyOn(storage, 'getPasswordResetToken').mockRejectedValueOnce(new Error('db down'));
    expect((await request(app).post('/api/v1/auth/reset-password').send({ token: 'x', newPassword: 'NewSecure123!' })).status).toBe(500);
  });

  it('covers change-password for SSO accounts, missing hashes, initial admins and failures', async () => {
    const user = await newUser();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const real = (await storage.getUser(user.id))!;
    const body = { currentPassword: user.password, newPassword: 'Changed123!x' };

    vi.spyOn(storage, 'getUser').mockResolvedValueOnce({ ...real, provider: 'keycloak' } as any);
    expect((await user.agent.post('/api/v1/auth/change-password').send(body)).status).toBe(400);

    vi.spyOn(storage, 'getUser').mockResolvedValueOnce({ ...real, passwordHash: null } as any);
    const noHash = await user.agent.post('/api/v1/auth/change-password').send(body);
    expect(noHash.body.error).toBe('Kein Passwort gesetzt');

    vi.spyOn(storage, 'getUser').mockResolvedValueOnce({ ...real, isInitialAdmin: true } as any);
    const update = vi.spyOn(storage, 'updateUser');
    vi.spyOn(emailService, 'sendPasswordChangedEmail').mockRejectedValueOnce(new Error('smtp down'));
    const ok = await user.agent.post('/api/v1/auth/change-password').send(body);
    expect(ok.status).toBe(200);
    expect(update).toHaveBeenCalledWith(user.id, expect.objectContaining({ isInitialAdmin: false }));
    await vi.waitFor(() => expect(err).toHaveBeenCalledWith(expect.stringContaining('[Password Changed]'), expect.any(Error)));

    vi.spyOn(storage, 'getUser').mockRejectedValueOnce(new Error('db down'));
    expect((await user.agent.post('/api/v1/auth/change-password').send(body)).status).toBe(500);
  });
});

describe('Email change – error branches', () => {
  it('handles vanished users, SSO-only accounts and failures', async () => {
    const user = await newUser();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const real = (await storage.getUser(user.id))!;
    const body = { newEmail: `new-${user.id}@test.example`, password: user.password };

    const vanished = vi.spyOn(storage, 'getUser').mockResolvedValue(undefined);
    expect((await user.agent.post('/api/v1/auth/request-email-change').send(body)).status).toBe(404);
    vanished.mockResolvedValue({ ...real, passwordHash: null } as any);
    const noHash = await user.agent.post('/api/v1/auth/request-email-change').send(body);
    expect(noHash.status).toBe(400);
    expect(noHash.body.error).toMatch(/Passwort-Authentifizierung/);
    vanished.mockRestore();

    vi.spyOn(storage, 'createEmailChangeToken').mockRejectedValueOnce(new Error('db down'));
    expect((await user.agent.post('/api/v1/auth/request-email-change').send(body)).status).toBe(500);
  });

  it('rejects confirmations for deleted users and reports failures', async () => {
    const user = await newUser();
    const token = await storage.createEmailChangeToken(user.id, `confirm-${user.id}@test.example`);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(storage, 'getUser').mockResolvedValueOnce(undefined);
    const missing = await request(app).post('/api/v1/auth/confirm-email-change').send({ token: token.token });
    expect(missing.status).toBe(400);
    expect(missing.body.error).toBe('Benutzer nicht gefunden');

    vi.spyOn(storage, 'getEmailChangeToken').mockRejectedValueOnce(new Error('db down'));
    expect((await request(app).post('/api/v1/auth/confirm-email-change').send({ token: 'x' })).status).toBe(500);
  });
});

describe('Keycloak SSO flow', () => {
  function enableKeycloak(state = 'state-123') {
    vi.spyOn(authService, 'isKeycloakEnabled').mockReturnValue(true);
    vi.spyOn(authService, 'initiateKeycloakLogin').mockResolvedValue({
      authUrl: 'https://sso.example.com/auth?x=1',
      codeVerifier: 'verifier',
      state,
    });
  }

  it('redirects to the IdP and keeps only safe return paths', async () => {
    enableKeycloak();
    const agent = request.agent(app);
    const res = await agent.get('/api/v1/auth/keycloak?redirect=//evil.example&lang=en');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://sso.example.com/auth?x=1');
  });

  it('returns 500 when the session cannot be saved or the IdP is unreachable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    enableKeycloak();
    failSessionOnce('save');
    expect((await request(app).get('/api/v1/auth/keycloak')).status).toBe(500);
    vi.spyOn(authService, 'initiateKeycloakLogin').mockRejectedValueOnce(new Error('idp down'));
    expect((await request(app).get('/api/v1/auth/keycloak')).status).toBe(500);
  });

  it('rejects callbacks without code, with a wrong state or without verifier', async () => {
    vi.spyOn(authService, 'isKeycloakEnabled').mockReturnValue(true);
    const noCode = await request(app).get('/api/v1/auth/keycloak/callback');
    expect(noCode.headers.location).toBe('/?error=no_code');

    const agent = request.agent(app);
    enableKeycloak('expected');
    await agent.get('/api/v1/auth/keycloak');
    const wrongState = await agent.get('/api/v1/auth/keycloak/callback?code=c&state=other');
    expect(wrongState.headers.location).toBe('/?error=invalid_state');

    const fresh = await request(app).get('/api/v1/auth/keycloak/callback?code=c');
    expect(fresh.headers.location).toBe('/?error=no_verifier');
  });

  async function startedAgent(redirect?: string) {
    enableKeycloak('st');
    const agent = request.agent(app);
    await agent.get(`/api/v1/auth/keycloak${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`);
    return agent;
  }

  it('redirects with auth_failed when the IdP returns no user', async () => {
    const agent = await startedAgent();
    vi.spyOn(authService, 'handleKeycloakCallback').mockResolvedValueOnce(null);
    const res = await agent.get('/api/v1/auth/keycloak/callback?code=c&state=st');
    expect(res.headers.location).toBe('/?error=auth_failed');
  });

  it('logs the SSO user in and returns to the requested page', async () => {
    const user = await newUser();
    const agent = await startedAgent('/meine-umfragen');
    vi.spyOn(authService, 'handleKeycloakCallback').mockResolvedValueOnce((await storage.getUser(user.id))!);
    const res = await agent.get('/api/v1/auth/keycloak/callback?code=c&state=st');
    expect(res.headers.location).toBe('/meine-umfragen');
    expect((await agent.get('/api/v1/auth/me')).body.user.id).toBe(user.id);
  });

  it('sends SSO users with enrolled MFA to the TOTP challenge', async () => {
    const user = await newUser();
    await storage.updateUser(user.id, { totpSecret: generateTotpSecret(), totpEnabled: true } as any);
    const agent = await startedAgent('/umfrage/x');
    vi.spyOn(authService, 'handleKeycloakCallback').mockResolvedValueOnce((await storage.getUser(user.id))!);
    const res = await agent.get('/api/v1/auth/keycloak/callback?code=c&state=st');
    expect(res.headers.location).toBe(`/anmelden?mfa=verify&redirect=${encodeURIComponent('/umfrage/x')}`);
  });

  it('redirects to the plain MFA page when no return path was given', async () => {
    const user = await newUser();
    await storage.updateUser(user.id, { totpSecret: generateTotpSecret(), totpEnabled: true } as any);
    const agent = await startedAgent();
    vi.spyOn(authService, 'handleKeycloakCallback').mockResolvedValueOnce((await storage.getUser(user.id))!);
    const res = await agent.get('/api/v1/auth/keycloak/callback?code=c&state=st');
    expect(res.headers.location).toBe('/anmelden?mfa=verify');
  });

  it.each([
    ['regenerate', false],
    ['save', false],
    ['save', true],
  ] as const)('redirects with session_error when %s fails (mfa=%s)', async (method, withMfa) => {
    const user = await newUser();
    if (withMfa) await storage.updateUser(user.id, { totpSecret: generateTotpSecret(), totpEnabled: true } as any);
    const agent = await startedAgent();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(authService, 'handleKeycloakCallback').mockResolvedValueOnce((await storage.getUser(user.id))!);
    failSessionOnce(method);
    const res = await agent.get('/api/v1/auth/keycloak/callback?code=c&state=st');
    expect(res.headers.location).toBe('/?error=session_error');
  });

  it('redirects with auth_error when the token exchange throws', async () => {
    const agent = await startedAgent();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(authService, 'handleKeycloakCallback').mockRejectedValueOnce(new Error('idp down'));
    const res = await agent.get('/api/v1/auth/keycloak/callback?code=c&state=st');
    expect(res.headers.location).toBe('/?error=auth_error');
  });
});

describe('MFA endpoints – error branches', () => {
  it('status: 404 for vanished users and 500 for storage errors', async () => {
    const user = await newUser();
    const lookup = vi.spyOn(storage, 'getUser').mockResolvedValue(undefined);
    expect((await user.agent.get('/api/v1/auth/mfa/status')).status).toBe(404);
    lookup.mockRejectedValue(new Error('db down'));
    expect((await user.agent.get('/api/v1/auth/mfa/status')).status).toBe(500);
  });

  it('setup-init: requires a session, an existing user and inactive MFA', async () => {
    expect((await request(app).post('/api/v1/auth/mfa/setup-init')).status).toBe(401);
    const user = await newUser();
    const lookup = vi.spyOn(storage, 'getUser').mockResolvedValue(undefined);
    expect((await user.agent.post('/api/v1/auth/mfa/setup-init')).status).toBe(404);
    lookup.mockRejectedValue(new Error('db down'));
    expect((await user.agent.post('/api/v1/auth/mfa/setup-init')).status).toBe(500);
  });

  it('setup-confirm: validates session, token and pending secret', async () => {
    expect((await request(app).post('/api/v1/auth/mfa/setup-confirm').send({ token: '123456' })).status).toBe(401);
    const user = await newUser();
    expect((await user.agent.post('/api/v1/auth/mfa/setup-confirm').send({})).status).toBe(400);
    const noSecret = await user.agent.post('/api/v1/auth/mfa/setup-confirm').send({ token: '123456' });
    expect(noSecret.body.error).toMatch(/Kein laufendes MFA-Setup/);

    await user.agent.post('/api/v1/auth/mfa/setup-init');
    const invalid = await user.agent.post('/api/v1/auth/mfa/setup-confirm').send({ token: '000000' });
    expect(invalid.status).toBe(400);
  });

  it('setup-confirm: returns 500 when finishing a forced setup cannot regenerate the session', async () => {
    const user = await newUser();
    await storage.updateUser(user.id, { mfaRequired: true } as any);
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({ usernameOrEmail: user.username, password: user.password });
    const init = await agent.post('/api/v1/auth/mfa/setup-init');
    failSessionOnce('regenerate');
    const res = await agent.post('/api/v1/auth/mfa/setup-confirm').send({ token: generateTotpForTest(init.body.secret) });
    expect(res.status).toBe(500);
  });

  it('validate: honours the rate limiter and rejects users without MFA', async () => {
    const user = await newUser();
    await storage.updateUser(user.id, { mfaRequired: true } as any);
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({ usernameOrEmail: user.username, password: user.password });

    vi.spyOn(loginRateLimiter, 'checkRateLimit').mockResolvedValueOnce({ allowed: false, remainingAttempts: 0, retryAfter: 60 } as any);
    const limited = await agent.post('/api/v1/auth/mfa/validate').send({ token: '123456' });
    expect(limited.status).toBe(429);

    expect((await agent.post('/api/v1/auth/mfa/validate').send({})).status).toBe(400);
    const notConfigured = await agent.post('/api/v1/auth/mfa/validate').send({ token: '123456' });
    expect(notConfigured.body.error).toBe('MFA nicht konfiguriert');

    vi.spyOn(storage, 'getUser').mockRejectedValueOnce(new Error('db down'));
    expect((await agent.post('/api/v1/auth/mfa/validate').send({ token: '123456' })).status).toBe(500);
  });

  it('disable: supports password fallback and rejects bad or missing credentials', async () => {
    const user = await newUser();
    const secret = generateTotpSecret();
    await storage.updateUser(user.id, { totpSecret: secret, totpEnabled: true } as any);

    const vanished = vi.spyOn(storage, 'getUser').mockResolvedValue(undefined);
    expect((await user.agent.post('/api/v1/auth/mfa/disable').send({ password: user.password })).status).toBe(404);
    vanished.mockRestore();

    const missing = await user.agent.post('/api/v1/auth/mfa/disable').send({});
    expect(missing.body.error).toBe('TOTP-Code oder Passwort erforderlich');

    const wrong = await user.agent.post('/api/v1/auth/mfa/disable').send({ password: 'wrong-password' });
    expect(wrong.body.error).toBe('Ungültiges Passwort');

    const ok = await user.agent.post('/api/v1/auth/mfa/disable').send({ password: user.password });
    expect(ok.status).toBe(200);
    expect((await storage.getUser(user.id))?.totpEnabled).toBe(false);

    vi.spyOn(storage, 'getUser').mockRejectedValue(new Error('db down'));
    expect((await user.agent.post('/api/v1/auth/mfa/disable').send({ password: user.password })).status).toBe(500);
  });
});
