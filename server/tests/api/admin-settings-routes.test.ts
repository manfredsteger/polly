import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import type { Express } from 'express';
import { createTestApp } from '../testApp';
import { storage } from '../../storage';
import { emailService } from '../../services/emailService';
import { apiRateLimiter } from '../../services/apiRateLimiterService';
import { loginAdminAgent, createLoggedInUser, type TestAgent, type CreatedTestUser } from '../fixtures/users';

export const testMeta = {
  category: 'api' as const,
  name: 'Admin-Einstellungen & Verwaltung',
  description: 'Szenario-Tests für Sicherheits-, Rate-Limit-, Benachrichtigungs-, Kalender-, Sitzungs- und Deprovisionierungs-Einstellungen sowie DSGVO-Löschanträge und Umfrageverwaltung',
  severity: 'high' as const,
};

// Settings rows this file touches; restored verbatim afterwards.
const SETTING_KEYS = [
  'security_login_rate_limit',
  'security_api_rate_limits',
  'notification_settings',
  'session_timeout_settings',
  'calendar_settings',
  'deprovision_config',
  'test_schedule_config',
  'test_mode_config',
  'coverage_admin_setting',
];

// Mirrors the limiter config applied by createTestApp so later files are unaffected.
const TEST_LIMITER_CONFIG = {
  registration: { windowSeconds: 3600, maxRequests: 10000, enabled: false },
  passwordReset: { windowSeconds: 900, maxRequests: 10000, enabled: false },
  pollCreation: { windowSeconds: 60, maxRequests: 10000, enabled: false },
  voting: { windowSeconds: 10, maxRequests: 10000, enabled: false },
  email: { windowSeconds: 60, maxRequests: 10000, enabled: false },
  apiGeneral: { windowSeconds: 60, maxRequests: 10000, enabled: false },
};

let app: Express;
let adminAgent: TestAgent;
let adminId: number;
const createdUsers: CreatedTestUser[] = [];
const originalSettings = new Map<string, unknown>();

describe('Admin settings and management routes', () => {
  beforeAll(async () => {
    app = await createTestApp();
    adminAgent = await loginAdminAgent(app);
    adminId = (await adminAgent.get('/api/v1/auth/me')).body.user.id;
    for (const key of SETTING_KEYS) originalSettings.set(key, (await storage.getSetting(key))?.value);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    for (const key of SETTING_KEYS) {
      const value = originalSettings.get(key);
      if (value === undefined) await storage.deleteSetting(key);
      else await storage.setSetting({ key, value });
    }
    apiRateLimiter.updateConfig(TEST_LIMITER_CONFIG);
    for (const u of createdUsers) await storage.deleteUser(u.id).catch(() => {});
  });

  it('rejects non-admin callers', async () => {
    const user = await createLoggedInUser(app);
    createdUsers.push(user);
    expect((await request(app).get('/api/v1/admin/notifications')).status).toBe(401);
    expect((await user.agent.get('/api/v1/admin/notifications')).status).toBe(403);
  });

  describe('security and rate limits', () => {
    it('persists login rate-limit settings and clears lockouts', async () => {
      const res = await adminAgent.put('/api/v1/admin/security').send({ loginRateLimit: { enabled: true, maxAttempts: 7, windowSeconds: 600, cooldownSeconds: 600 } });
      expect(res.status).toBe(200);
      expect(res.body.settings.loginRateLimit.maxAttempts).toBe(7);
      const get = await adminAgent.get('/api/v1/admin/security');
      expect(get.body.settings.loginRateLimit.maxAttempts).toBe(7);
      expect(get.body.stats).toBeDefined();
      expect(get.body.ssoNote).toContain('SSO');
      expect((await adminAgent.post('/api/v1/admin/security/clear-rate-limits')).body.success).toBe(true);
    });

    it('persists API rate limits so they survive a restart (regression)', async () => {
      const update = {
        registration: { enabled: true, maxRequests: 4, windowSeconds: 1800 },
        passwordReset: { enabled: true, maxRequests: 2, windowSeconds: 900 },
        pollCreation: { enabled: false, maxRequests: 50, windowSeconds: 60 },
        voting: { enabled: true, maxRequests: 25, windowSeconds: 10 },
        email: { enabled: true, maxRequests: 6, windowSeconds: 60 },
        apiGeneral: { enabled: true, maxRequests: 500, windowSeconds: 60 },
      };
      const put = await adminAgent.put('/api/v1/admin/api-rate-limits').send(update);
      expect(put.status).toBe(200);
      expect(put.body.settings.registration.maxRequests).toBe(4);

      const get = await adminAgent.get('/api/v1/admin/api-rate-limits');
      expect(get.body.settings).toEqual(update);
      expect(Object.keys(get.body.stats)).toContain('api-general');
      // What startup reads to configure the limiter:
      expect((await storage.getSecuritySettings()).apiRateLimits.apiGeneral.maxRequests).toBe(500);

      expect((await adminAgent.put('/api/v1/admin/api-rate-limits').send({ voting: { maxRequests: 0 } })).status).toBe(500);
      expect((await adminAgent.post('/api/v1/admin/api-rate-limits/clear').send({ limiter: 'vote' })).body.success).toBe(true);
      expect((await adminAgent.post('/api/v1/admin/api-rate-limits/clear').send({})).body.success).toBe(true);
      apiRateLimiter.updateConfig(TEST_LIMITER_CONFIG);
    });
  });

  describe('feature settings', () => {
    it('updates notification, session timeout and calendar settings', async () => {
      const notif = await adminAgent.put('/api/v1/admin/notifications').send({ reminderCooldownMinutes: 90, guestsCanSendReminders: true });
      expect(notif.body.settings).toMatchObject({ reminderCooldownMinutes: 90, guestsCanSendReminders: true });
      expect((await adminAgent.get('/api/v1/admin/notifications')).body.reminderCooldownMinutes).toBe(90);
      expect((await adminAgent.put('/api/v1/admin/notifications').send({ userReminderLimitPerPoll: 0 })).status).toBe(500);

      const timeout = await adminAgent.put('/api/v1/admin/session-timeout').send({ enabled: true, userTimeoutMinutes: 30 });
      expect(timeout.body.settings).toMatchObject({ enabled: true, userTimeoutMinutes: 30, adminTimeoutMinutes: expect.any(Number) });
      expect((await adminAgent.get('/api/v1/admin/session-timeout')).body.userTimeoutMinutes).toBe(30);
      expect((await adminAgent.put('/api/v1/admin/session-timeout').send({ userTimeoutMinutes: 1 })).status).toBe(500);

      const cal = await adminAgent.put('/api/v1/admin/calendar').send({ exportScope: 'own_yes', tentativePrefix: 'Tentative' });
      expect(cal.body.settings).toMatchObject({ exportScope: 'own_yes', tentativePrefix: 'Tentative' });
      expect((await adminAgent.get('/api/v1/admin/calendar')).body.exportScope).toBe('own_yes');
      expect((await adminAgent.put('/api/v1/admin/calendar').send({ exportScope: 'everything' })).status).toBe(500);
    });

    it('stores deprovisioning credentials hashed and keeps the password when omitted', async () => {
      await storage.deleteSetting('deprovision_config');
      const empty = await adminAgent.get('/api/v1/admin/deprovision-settings');
      expect(empty.body).toEqual({ enabled: false, username: '', hasPassword: false, lastUpdated: null });

      const saved = await adminAgent.put('/api/v1/admin/deprovision-settings').send({ enabled: false, username: 'kafka', password: 'Secret123!' });
      expect(saved.body).toMatchObject({ enabled: false, username: 'kafka', hasPassword: true });
      const stored = (await storage.getSetting('deprovision_config'))?.value as { passwordHash: string };
      expect(stored.passwordHash).not.toContain('Secret123!');
      expect(await bcrypt.compare('Secret123!', stored.passwordHash)).toBe(true);

      const renamed = await adminAgent.put('/api/v1/admin/deprovision-settings').send({ username: 'kafka2' });
      expect(renamed.body).toMatchObject({ username: 'kafka2', hasPassword: true });
      const get = await adminAgent.get('/api/v1/admin/deprovision-settings');
      expect(get.body).toMatchObject({ username: 'kafka2', hasPassword: true, lastUpdated: expect.any(String) });
    });

    it('blocks manual user deletion while external deprovisioning is enabled', async () => {
      const victim = await createLoggedInUser(app);
      createdUsers.push(victim);
      await storage.setSetting({ key: 'deprovision_config', value: { enabled: true, username: 'kafka' } });
      const blocked = await adminAgent.delete(`/api/v1/admin/users/${victim.id}`);
      expect(blocked.status).toBe(403);
      expect(blocked.body.code).toBe('MANUAL_DELETE_DISABLED');
      await storage.setSetting({ key: 'deprovision_config', value: { enabled: false, username: 'kafka' } });

      expect((await adminAgent.delete('/api/v1/admin/users/abc')).status).toBe(400);
      expect((await adminAgent.delete('/api/v1/admin/users/999999999')).status).toBe(404);
      expect((await adminAgent.delete(`/api/v1/admin/users/${adminId}`)).status).toBe(400);
      const ok = await adminAgent.delete(`/api/v1/admin/users/${victim.id}`);
      expect(ok.body.success).toBe(true);
      expect(await storage.getUser(victim.id)).toBeUndefined();
    });

    it('stores, lists and deletes generic settings', async () => {
      const set = await adminAgent.post('/api/v1/admin/settings').send({ key: 'coverage_admin_setting', value: { a: 1 } });
      expect(set.status).toBe(200);
      const all = await adminAgent.get('/api/v1/admin/settings');
      expect(all.body.some((s: any) => s.key === 'coverage_admin_setting')).toBe(true);
      expect((await adminAgent.delete('/api/v1/admin/settings/coverage_admin_setting')).status).toBe(200);
      expect(await storage.getSetting('coverage_admin_setting')).toBeUndefined();
    });
  });

  describe('MFA requirement', () => {
    it('can require and lift MFA setup for local accounts only', async () => {
      const user = await createLoggedInUser(app);
      createdUsers.push(user);
      expect((await adminAgent.post('/api/v1/admin/users/x/require-mfa')).status).toBe(400);
      expect((await adminAgent.post('/api/v1/admin/users/999999999/require-mfa')).status).toBe(404);

      const on = await adminAgent.post(`/api/v1/admin/users/${user.id}/require-mfa`).send({});
      expect(on.body).toEqual({ success: true, mfaRequired: true });
      const off = await adminAgent.post(`/api/v1/admin/users/${user.id}/require-mfa`).send({ required: false });
      expect(off.body.mfaRequired).toBe(false);

      await storage.updateUser(user.id, { provider: 'keycloak' } as any);
      expect((await adminAgent.post(`/api/v1/admin/users/${user.id}/require-mfa`)).status).toBe(400);
      expect((await adminAgent.delete(`/api/v1/admin/users/${user.id}`)).status).toBe(403);
    });
  });

  describe('GDPR deletion requests', () => {
    it('lists, rejects and confirms deletion requests', async () => {
      const keep = await createLoggedInUser(app);
      const remove = await createLoggedInUser(app);
      const none = await createLoggedInUser(app);
      createdUsers.push(keep, remove, none);
      await storage.requestDeletion(keep.id);
      await storage.requestDeletion(remove.id);

      const list = await adminAgent.get('/api/v1/admin/deletion-requests');
      const ids = list.body.map((u: any) => u.id);
      expect(ids).toEqual(expect.arrayContaining([keep.id, remove.id]));
      expect(list.body[0]).not.toHaveProperty('passwordHash');

      for (const action of ['confirm', 'reject']) {
        expect((await adminAgent.post(`/api/v1/admin/deletion-requests/999999999/${action}`)).status).toBe(404);
        expect((await adminAgent.post(`/api/v1/admin/deletion-requests/${none.id}/${action}`)).status).toBe(400);
      }

      const rejected = await adminAgent.post(`/api/v1/admin/deletion-requests/${keep.id}/reject`);
      expect(rejected.body.success).toBe(true);
      expect(rejected.body.user.deletionRequestedAt).toBeNull();

      const confirmed = await adminAgent.post(`/api/v1/admin/deletion-requests/${remove.id}/confirm`);
      expect(confirmed.body.success).toBe(true);
      const after = await storage.getUser(remove.id);
      expect(after === undefined || after.email !== remove.email).toBe(true);
    });

    it('does not let an admin confirm their own deletion', async () => {
      const admin = await createLoggedInUser(app, { role: 'admin' });
      createdUsers.push(admin);
      await storage.requestDeletion(admin.id);
      const res = await admin.agent.post(`/api/v1/admin/deletion-requests/${admin.id}/confirm`);
      expect(res.status).toBe(400);
    });
  });

  describe('poll management', () => {
    it('updates and deletes polls by public token and hides test data', async () => {
      const created = await adminAgent.post('/api/v1/polls').send({ title: 'Admin managed', type: 'survey', options: [{ text: 'A' }, { text: 'B' }] });
      const token = created.body.publicToken;

      const list = await adminAgent.get('/api/v1/admin/polls');
      expect(list.body.some((p: any) => p.publicToken === token)).toBe(false);

      expect((await adminAgent.patch('/api/v1/admin/polls/unknown').send({ title: 'x' })).status).toBe(404);
      expect((await adminAgent.patch(`/api/v1/admin/polls/${token}`).send({})).status).toBe(400);
      const patched = await adminAgent.patch(`/api/v1/admin/polls/${token}`).send({
        title: 'Renamed', description: 'D', isActive: false, resultsPublic: false, expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });
      expect(patched.body).toMatchObject({ title: 'Renamed', description: 'D', isActive: false, resultsPublic: false });
      const cleared = await adminAgent.patch(`/api/v1/admin/polls/${token}`).send({ expiresAt: null });
      expect(cleared.body.expiresAt).toBeNull();

      expect((await adminAgent.delete('/api/v1/admin/polls/unknown')).status).toBe(404);
      expect((await adminAgent.delete(`/api/v1/admin/polls/${token}`)).body.success).toBe(true);
      expect(await storage.getPollByPublicToken(token)).toBeUndefined();
    });
  });

  describe('diagnostics', () => {
    it('reports database connectivity without exposing credentials', async () => {
      const res = await adminAgent.get('/api/v1/admin/database-status');
      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(true);
      expect(typeof res.body.sslEnabled).toBe('boolean');
      expect(JSON.stringify(res.body)).not.toMatch(/password|@/i);
    });

    it('validates ClamAV config tests and reads scan logs', async () => {
      expect((await adminAgent.post('/api/v1/admin/clamav/test-config').send({ host: 'x' })).status).toBe(400);
      const logs = await adminAgent.get('/api/v1/admin/clamav/scan-logs?limit=5&offset=0&status=clean&startDate=2020-01-01&endDate=2100-01-01');
      expect(logs.status).toBe(200);
      expect((await adminAgent.get('/api/v1/admin/clamav/scan-logs/999999999')).status).toBe(404);
    });

    it('reports the test environment and manages test settings', async () => {
      const env = await adminAgent.get('/api/v1/admin/tests/environment');
      expect(['replit', 'docker', 'ci', 'local']).toContain(env.body.environment);
      expect(env.body.capabilities.unit).toBe(true);

      expect((await adminAgent.put('/api/v1/admin/tests/mode').send({ mode: 'sometimes' })).status).toBe(400);
      expect((await adminAgent.put('/api/v1/admin/tests/mode').send({ mode: 'manual' })).body.config).toEqual({ mode: 'manual' });
      expect((await adminAgent.get('/api/v1/admin/tests/configurations')).body.mode).toEqual({ mode: 'manual' });
      expect((await adminAgent.put('/api/v1/admin/tests/mode').send({ mode: 'auto' })).body.config).toEqual({ mode: 'auto' });

      expect((await adminAgent.put('/api/v1/admin/tests/configurations/x').send({ enabled: 'yes' })).status).toBe(400);
      expect((await adminAgent.put(`/api/v1/admin/tests/configurations/${encodeURIComponent('does/not/exist.test.ts')}`).send({ enabled: false })).body.success).toBe(true);

      const schedule = await adminAgent.put('/api/v1/admin/tests/schedule').send({ enabled: true, intervalDays: 7, runTime: '03:00' });
      expect(schedule.body.config).toMatchObject({ enabled: true, intervalDays: 7, runTime: '03:00' });
      expect(new Date(schedule.body.config.nextRun).getTime()).toBeGreaterThan(Date.now());
      expect((await adminAgent.get('/api/v1/admin/tests/schedule')).body.enabled).toBe(true);

      expect((await adminAgent.get('/api/v1/admin/tests/runs/999999999')).status).toBe(404);
      expect((await adminAgent.get('/api/v1/admin/tests/runs/999999999/pdf')).status).toBe(404);
      const stats = await adminAgent.get('/api/v1/admin/tests/data-stats');
      expect(stats.body.total).toBe(stats.body.polls + stats.body.users + stats.body.votes + stats.body.options);
      expect(Array.isArray((await adminAgent.get('/api/v1/admin/test-runs?limit=2')).body)).toBe(true);
    });

    it('reports Matrix as unavailable when it is not configured', async () => {
      const res = await adminAgent.post('/api/v1/admin/matrix/test');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
    });
  });

  describe('email template utilities', () => {
    it('lists template variables and validates the type', async () => {
      const vars = await adminAgent.get('/api/v1/admin/email-templates/invitation/variables');
      expect(vars.status).toBe(200);
      expect(JSON.stringify(vars.body)).toContain('pollTitle');
      expect((await adminAgent.get('/api/v1/admin/email-templates/bogus/variables')).status).toBe(400);
    });

    it('sends test emails in German and English', async () => {
      const send = vi.spyOn(emailService, 'sendPreRenderedEmail').mockResolvedValue(undefined as any);
      expect((await adminAgent.post('/api/v1/admin/email-templates/bogus/test').send({ recipientEmail: 'a@b.c' })).status).toBe(400);
      expect((await adminAgent.post('/api/v1/admin/email-templates/invitation/test').send({})).status).toBe(400);

      const de = await adminAgent.post('/api/v1/admin/email-templates/invitation/test').send({ recipientEmail: 'de@test.example' });
      expect(de.body.success).toBe(true);
      expect(send.mock.calls[0][0]).toBe('de@test.example');
      expect(send.mock.calls[0][1]).toContain('Test-Einladung');

      const en = await adminAgent.post('/api/v1/admin/email-templates/welcome/test?language=en').send({ recipientEmail: 'en@test.example' });
      expect(en.body.success).toBe(true);
      expect(send.mock.calls[1][0]).toBe('en@test.example');
      expect(send.mock.calls[1][2]).toContain('lang="en"');

      send.mockRejectedValueOnce(new Error('smtp down'));
      expect((await adminAgent.post('/api/v1/admin/email-templates/reminder/test').send({ recipientEmail: 'x@test.example' })).status).toBe(500);
    });

    it('validates footer and theme import payloads', async () => {
      expect((await adminAgent.put('/api/v1/admin/email-footer').send({})).status).toBe(400);
      expect((await adminAgent.post('/api/v1/admin/email-theme/import').send({})).status).toBe(400);
      expect((await adminAgent.post('/api/v1/admin/email-theme/import').send({ jsonContent: '{}' })).status).toBe(400);
      expect((await adminAgent.post('/api/v1/admin/email-theme/import/confirm').send({})).status).toBe(400);
    });
  });
});
