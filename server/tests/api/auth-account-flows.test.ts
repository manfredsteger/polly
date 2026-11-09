import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import type { Express } from 'express';
import { createTestApp } from '../testApp';
import { storage } from '../../storage';
import { emailService } from '../../services/emailService';
import { authService } from '../../services/authService';
import { createLoggedInUser, type CreatedTestUser } from '../fixtures/users';

export const testMeta = {
  category: 'auth' as const,
  name: 'Konto-Abläufe (Löschung, Passwort, E-Mail, SSO)',
  description: 'Szenario-Tests für DSGVO-Löschantrag, E-Mail-Bestätigung, Passwort-Reset/-Änderung, E-Mail-Wechsel, Login-Methoden und Keycloak-Anmeldung/-Abmeldung',
  severity: 'critical' as const,
};

const ENV_KEYS = ['HIDE_LOGIN_FORM', 'SSO_AUTO_REDIRECT', 'SSO_SINGLE_LOGOUT', 'SSO_BUTTON_LABEL'] as const;
const originalEnv: Record<string, string | undefined> = {};

let app: Express;
const createdUsers: CreatedTestUser[] = [];

async function newUser(overrides: Parameters<typeof createLoggedInUser>[1] = {}) {
  const user = await createLoggedInUser(app, overrides);
  createdUsers.push(user);
  return user;
}

describe('Auth account flows', () => {
  beforeAll(async () => {
    app = await createTestApp();
    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  afterAll(async () => {
    for (const u of createdUsers) await storage.deleteUser(u.id).catch(() => {});
  });

  describe('GDPR deletion request', () => {
    it('lets a user request and withdraw account deletion and notifies admins', async () => {
      const notify = vi.spyOn(emailService, 'sendDeletionRequestNotification').mockResolvedValue(undefined as any);
      const user = await newUser();

      expect((await user.agent.delete('/api/v1/auth/request-deletion')).status).toBe(400);

      const requested = await user.agent.post('/api/v1/auth/request-deletion');
      expect(requested.status).toBe(200);
      expect(requested.body.deletionRequestedAt).toBeTruthy();
      await vi.waitFor(() => expect(notify).toHaveBeenCalled());
      expect(notify.mock.calls[0][2]).toBe(user.email);
      expect(notify.mock.calls[0][3]).toContain('/admin?tab=deletion-requests');

      const again = await user.agent.post('/api/v1/auth/request-deletion');
      expect(again.status).toBe(400);
      expect(again.body.deletionRequestedAt).toBeTruthy();

      const withdrawn = await user.agent.delete('/api/v1/auth/request-deletion');
      expect(withdrawn.body.success).toBe(true);
      expect(withdrawn.body.user.deletionRequestedAt).toBeNull();
      expect(withdrawn.body.user).not.toHaveProperty('passwordHash');
    });

    it('requires a session', async () => {
      expect((await request(app).post('/api/v1/auth/request-deletion')).status).toBe(401);
    });
  });

  describe('email verification', () => {
    it('verifies an address once and rejects unknown tokens', async () => {
      const user = await newUser();
      await storage.updateUser(user.id, { emailVerified: false } as any);
      const { token } = await storage.createEmailVerificationToken(user.id);

      expect((await request(app).get('/api/v1/auth/verify-email/not-a-token')).body.expired).toBe(true);
      const ok = await request(app).get(`/api/v1/auth/verify-email/${token}`);
      expect(ok.body.success).toBe(true);
      expect((await storage.getUser(user.id))?.emailVerified).toBe(true);
      expect((await request(app).get(`/api/v1/auth/verify-email/${token}`)).status).toBe(400);
    });

    it('resends the verification email only for unverified users', async () => {
      const welcome = vi.spyOn(emailService, 'sendWelcomeEmail').mockResolvedValue(undefined as any);
      const user = await newUser();
      expect((await user.agent.post('/api/v1/auth/resend-verification')).status).toBe(400);

      await storage.updateUser(user.id, { emailVerified: false } as any);
      const res = await user.agent.post('/api/v1/auth/resend-verification').set('X-Polly-Language', 'en');
      expect(res.body.success).toBe(true);
      expect(welcome).toHaveBeenCalledWith(user.email, expect.any(String), expect.stringContaining('/email-bestaetigen/'), 'en');

      welcome.mockRejectedValueOnce(new Error('smtp'));
      expect((await user.agent.post('/api/v1/auth/resend-verification')).status).toBe(500);
    });
  });

  describe('password reset', () => {
    it('does not reveal whether an account exists', async () => {
      const send = vi.spyOn(emailService, 'sendPasswordResetEmail').mockResolvedValue(undefined as any);
      expect((await request(app).post('/api/v1/auth/request-password-reset').send({})).status).toBe(400);
      const unknown = await request(app).post('/api/v1/auth/request-password-reset').send({ email: 'nobody-cov@test.example' });
      const user = await newUser();
      const known = await request(app).post('/api/v1/auth/request-password-reset').send({ email: user.email.toUpperCase() });
      expect(unknown.body).toEqual(known.body);
      await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
      expect(send.mock.calls[0][1]).toContain('/passwort-zuruecksetzen/');
    });

    it('resets the password with a valid token, ends the session and burns the token', async () => {
      const changed = vi.spyOn(emailService, 'sendPasswordChangedEmail').mockResolvedValue(undefined as any);
      const user = await newUser();
      const resetToken = await storage.createPasswordResetToken(user.id);

      expect((await request(app).post('/api/v1/auth/reset-password').send({ token: resetToken.token })).status).toBe(400);
      expect((await request(app).post('/api/v1/auth/reset-password').send({ token: resetToken.token, newPassword: 'short' })).status).toBe(400);
      expect((await request(app).post('/api/v1/auth/reset-password').send({ token: 'invalid', newPassword: 'BrandNewPass123!' })).body.error)
        .toBe('Ungültiger oder abgelaufener Link');

      const ok = await user.agent.post('/api/v1/auth/reset-password').send({ token: resetToken.token, newPassword: 'BrandNewPass123!' });
      expect(ok.body.success).toBe(true);
      expect(changed).toHaveBeenCalled();
      expect((await user.agent.get('/api/v1/auth/me')).body.user).toBeNull();

      const stored = await storage.getUser(user.id);
      expect(await bcrypt.compare('BrandNewPass123!', stored!.passwordHash!)).toBe(true);
      expect((await request(app).post('/api/v1/auth/reset-password').send({ token: resetToken.token, newPassword: 'AnotherPass123!' })).status).toBe(400);

      const anon = await storage.createPasswordResetToken(user.id);
      expect((await request(app).post('/api/v1/auth/reset-password').send({ token: anon.token, newPassword: 'ThirdPass1234!' })).body.success).toBe(true);
    });

    it('serves the password policy publicly', async () => {
      const res = await request(app).get('/api/v1/auth/password-policy');
      expect(res.status).toBe(200);
      expect(typeof res.body.minLength).toBe('number');
    });
  });

  describe('password change', () => {
    it('validates the current password and policy before changing', async () => {
      const changed = vi.spyOn(emailService, 'sendPasswordChangedEmail').mockResolvedValue(undefined as any);
      const user = await newUser();
      expect((await user.agent.post('/api/v1/auth/change-password').send({ currentPassword: user.password })).status).toBe(400);
      expect((await user.agent.post('/api/v1/auth/change-password').send({ currentPassword: 'wrong', newPassword: 'BrandNewPass123!' })).body.error)
        .toBe('Aktuelles Passwort ist falsch');
      expect((await user.agent.post('/api/v1/auth/change-password').send({ currentPassword: user.password, newPassword: 'x' })).status).toBe(400);

      await storage.updateUser(user.id, { isInitialAdmin: true } as any);
      const ok = await user.agent.post('/api/v1/auth/change-password').send({ currentPassword: user.password, newPassword: 'BrandNewPass123!' });
      expect(ok.body.success).toBe(true);
      expect(changed).toHaveBeenCalled();
      expect((await storage.getUser(user.id))?.isInitialAdmin).toBe(false);
    });

    it('refuses SSO accounts and accounts without a password', async () => {
      const sso = await newUser();
      await storage.updateUser(sso.id, { provider: 'keycloak' } as any);
      expect((await sso.agent.post('/api/v1/auth/change-password').send({ currentPassword: 'a', newPassword: 'b' })).body.error)
        .toContain('lokale Konten');

      const noPw = await newUser();
      await storage.updateUser(noPw.id, { passwordHash: null } as any);
      expect((await noPw.agent.post('/api/v1/auth/change-password').send({ currentPassword: 'a', newPassword: 'b' })).body.error)
        .toBe('Kein Passwort gesetzt');
    });
  });

  describe('email change', () => {
    it('confirms a new address only after password check and token confirmation', async () => {
      const confirm = vi.spyOn(emailService, 'sendEmailChangeConfirmation').mockResolvedValue(undefined as any);
      const user = await newUser();
      const other = await newUser();
      const target = `changed-${user.id}@test.example`;
      const post = (body: object) => user.agent.post('/api/v1/auth/request-email-change').send(body);

      expect((await post({ password: user.password })).status).toBe(400);
      expect((await post({ newEmail: target })).status).toBe(400);
      expect((await post({ newEmail: 'invalid', password: user.password })).body.error).toBe('Ungültiges E-Mail-Format');
      expect((await post({ newEmail: target, password: 'wrong' })).status).toBe(401);
      expect((await post({ newEmail: other.email, password: user.password })).body.error).toContain('bereits verwendet');

      expect((await post({ newEmail: target.toUpperCase(), password: user.password })).body.success).toBe(true);
      expect(confirm).toHaveBeenCalledWith(target.toUpperCase(), user.email, expect.stringContaining('/email-bestaetigen/'), undefined);
      const token = confirm.mock.calls[0][2].split('/').pop()!;

      expect((await request(app).post('/api/v1/auth/confirm-email-change').send({})).status).toBe(400);
      expect((await request(app).post('/api/v1/auth/confirm-email-change').send({ token: 'nope' })).status).toBe(400);
      expect((await request(app).post('/api/v1/auth/confirm-email-change').send({ token })).body.success).toBe(true);
      expect((await storage.getUser(user.id))?.email).toBe(target);
      expect((await request(app).post('/api/v1/auth/confirm-email-change').send({ token })).status).toBe(400);
    });

    it('rejects accounts without password authentication', async () => {
      const user = await newUser();
      await storage.updateUser(user.id, { passwordHash: null } as any);
      const res = await user.agent.post('/api/v1/auth/request-email-change').send({ newEmail: 'x-cov@test.example', password: 'a' });
      expect(res.body.error).toBe('Passwort-Authentifizierung nicht verfügbar');
    });
  });

  describe('email check for voting', () => {
    it('reports registered addresses and recognises the own address', async () => {
      const user = await newUser();
      expect((await request(app).post('/api/v1/auth/check-email').send({})).status).toBe(400);
      expect((await request(app).post('/api/v1/auth/check-email').send({ email: 'bad' })).status).toBe(400);

      const unknown = await request(app).post('/api/v1/auth/check-email').send({ email: 'unknown-cov@test.example' });
      expect(unknown.body).toMatchObject({ registered: false, requiresLogin: false, isOwnEmail: false });
      const registered = await request(app).post('/api/v1/auth/check-email').send({ email: user.email });
      expect(registered.body).toMatchObject({ registered: true, requiresLogin: true, isOwnEmail: false });
      const own = await user.agent.post('/api/v1/auth/check-email').send({ email: user.email.toUpperCase() });
      expect(own.body).toMatchObject({ registered: true, requiresLogin: false, isOwnEmail: true });
    });
  });

  describe('SSO (Keycloak)', () => {
    it('only exposes SSO login options when Keycloak is configured', async () => {
      process.env.HIDE_LOGIN_FORM = 'true';
      process.env.SSO_AUTO_REDIRECT = 'true';
      const local = await request(app).get('/api/v1/auth/methods');
      expect(local.body).toMatchObject({ local: true, keycloak: false, showLoginForm: true, autoRedirectSso: false });
      expect((await request(app).get('/api/v1/auth/keycloak')).status).toBe(404);
      expect((await request(app).get('/api/v1/auth/keycloak/callback')).status).toBe(404);

      vi.spyOn(authService, 'isKeycloakEnabled').mockReturnValue(true);
      process.env.SSO_BUTTON_LABEL = 'Mit Kita-Hub anmelden';
      const sso = await request(app).get('/api/v1/auth/methods');
      expect(sso.body).toMatchObject({ keycloak: true, showLoginForm: false, autoRedirectSso: true });
      expect(typeof sso.body.ssoButtonLabel).toBe('string');
    });

    it('runs the login round trip and returns to a safe local path', async () => {
      const user = await newUser();
      vi.spyOn(authService, 'isKeycloakEnabled').mockReturnValue(true);
      vi.spyOn(authService, 'initiateKeycloakLogin').mockResolvedValue({ authUrl: 'https://idp.example/auth', codeVerifier: 'cv', state: 'st-1' });
      const callback = vi.spyOn(authService, 'handleKeycloakCallback').mockResolvedValue((await storage.getUser(user.id))!);

      const agent = request.agent(app);
      const start = await agent.get('/api/v1/auth/keycloak?redirect=/meine-umfragen&lang=en');
      expect(start.status).toBe(302);
      expect(start.headers.location).toBe('https://idp.example/auth');

      expect((await agent.get('/api/v1/auth/keycloak/callback')).headers.location).toBe('/?error=no_code');
      expect((await agent.get('/api/v1/auth/keycloak/callback?code=c&state=wrong')).headers.location).toBe('/?error=invalid_state');

      const done = await agent.get('/api/v1/auth/keycloak/callback?code=c&state=st-1');
      expect(done.headers.location).toBe('/meine-umfragen');
      expect(callback).toHaveBeenCalledWith('c', 'cv', expect.anything());
      expect((await agent.get('/api/v1/auth/me')).body.user.id).toBe(user.id);
    });

    it('ignores open-redirect targets and reports failed callbacks', async () => {
      vi.spyOn(authService, 'isKeycloakEnabled').mockReturnValue(true);
      vi.spyOn(authService, 'initiateKeycloakLogin').mockResolvedValue({ authUrl: 'https://idp.example/auth', codeVerifier: 'cv', state: 'st-2' });
      const callback = vi.spyOn(authService, 'handleKeycloakCallback').mockResolvedValue(null);

      const agent = request.agent(app);
      await agent.get('/api/v1/auth/keycloak?redirect=//evil.example');
      expect((await agent.get('/api/v1/auth/keycloak/callback?code=c&state=st-2')).headers.location).toBe('/?error=auth_failed');

      callback.mockRejectedValueOnce(new Error('token exchange failed'));
      expect((await agent.get('/api/v1/auth/keycloak/callback?code=c&state=st-2')).headers.location).toBe('/?error=auth_error');

      const fresh = request.agent(app);
      expect((await fresh.get('/api/v1/auth/keycloak/callback?code=c')).headers.location).toBe('/?error=no_verifier');
    });

    it('requires the app TOTP challenge for SSO users with MFA enrolled', async () => {
      const user = await newUser();
      await storage.updateUser(user.id, { totpEnabled: true, totpSecret: 'JBSWY3DPEHPK3PXP' } as any);
      vi.spyOn(authService, 'isKeycloakEnabled').mockReturnValue(true);
      vi.spyOn(authService, 'initiateKeycloakLogin').mockResolvedValue({ authUrl: 'https://idp.example/auth', codeVerifier: 'cv', state: 'st-3' });
      vi.spyOn(authService, 'handleKeycloakCallback').mockResolvedValue((await storage.getUser(user.id))!);

      const agent = request.agent(app);
      await agent.get('/api/v1/auth/keycloak?redirect=/umfrage/abc');
      const res = await agent.get('/api/v1/auth/keycloak/callback?code=c&state=st-3');
      expect(res.headers.location).toBe(`/anmelden?mfa=verify&redirect=${encodeURIComponent('/umfrage/abc')}`);
      expect((await agent.get('/api/v1/auth/me')).body.user).toBeNull();
    });

    it('returns the single-logout URL only for Keycloak sessions when enabled', async () => {
      const local = await newUser();
      expect((await local.agent.post('/api/v1/auth/logout')).body).toEqual({ success: true });

      const sso = await newUser();
      await storage.updateUser(sso.id, { provider: 'keycloak' } as any);
      process.env.SSO_SINGLE_LOGOUT = 'false';
      expect((await sso.agent.post('/api/v1/auth/logout')).body.keycloakLogoutUrl).toBeUndefined();

      const sso2 = await newUser();
      await storage.updateUser(sso2.id, { provider: 'keycloak' } as any);
      process.env.SSO_SINGLE_LOGOUT = 'true';
      vi.spyOn(authService, 'isKeycloakEnabled').mockReturnValue(true);
      vi.spyOn(authService, 'getDisplayConfig').mockReturnValue({ issuerUrl: 'https://idp.example/realms/polly/', clientId: 'polly-app' } as any);
      const url = (await sso2.agent.post('/api/v1/auth/logout')).body.keycloakLogoutUrl as string;
      expect(url).toMatch(/^https:\/\/idp\.example\/realms\/polly\/protocol\/openid-connect\/logout\?post_logout_redirect_uri=/);
      expect(url).toContain('client_id=polly-app');
    });
  });
});
