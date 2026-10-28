import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Express } from 'express';
import { createTestApp } from '../testApp';
import { storage } from '../../storage';
import { loginRateLimiter } from '../../routes/common';
import { adminCacheService } from '../../services/adminCacheService';
import { apiRateLimiter } from '../../services/apiRateLimiterService';
import { clamavService } from '../../services/clamavService';
import { emailTemplateService } from '../../services/emailTemplateService';
import { matrixService } from '../../services/matrixService';
import { pentestToolsService } from '../../services/pentestToolsService';
import { loginAdminAgent, type TestAgent } from '../fixtures/users';

export const testMeta = {
  category: 'api' as const,
  name: 'Admin-Fehlerpfade',
  description: 'Admin-Endpunkte melden Backend-Ausfälle als generischen Fehler, ohne interne Details preiszugeben',
  severity: 'high' as const,
};

// A marker that would only reach the client if internal error details leaked.
const SECRET = 'internal-detail-db-password-should-not-leak';
// Routes acting on another account target an id that never matches the admin.
const OTHER = 2147483000;

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
type Case = [Method, string, Record<string, unknown> | undefined, object, string];

const strongPassword = 'Valid-Passw0rd!';
const cases: Case[] = [
  ['get', '/stats', undefined, storage, 'getSystemStats'],
  ['get', '/extended-stats', undefined, adminCacheService, 'getExtendedStats'],
  ['get', '/users', undefined, storage, 'getAllUsers'],
  ['post', '/users', { name: 'N', email: 'n@test.example', username: 'valid_name', password: strongPassword }, storage, 'getUserByEmail'],
  ['patch', `/users/${OTHER}`, { username: 'valid_name' }, storage, 'getUserByUsername'],
  ['patch', `/users/${OTHER}`, { name: 'Renamed' }, storage, 'updateUser'],
  ['post', `/users/${OTHER}/send-password-reset`, undefined, storage, 'getUser'],
  ['post', `/users/${OTHER}/set-password`, { password: strongPassword }, storage, 'getCustomizationSettings'],
  ['post', `/users/${OTHER}/reset-mfa`, undefined, storage, 'getUser'],
  ['post', `/users/${OTHER}/require-mfa`, { required: true }, storage, 'getUser'],
  ['delete', `/users/${OTHER}`, undefined, storage, 'getUser'],
  ['get', '/mfa-coverage', undefined, storage, 'getAdminUsers'],
  ['get', '/deletion-requests', undefined, storage, 'getUsersWithDeletionRequests'],
  ['post', `/deletion-requests/${OTHER}/confirm`, undefined, storage, 'getUser'],
  ['post', `/deletion-requests/${OTHER}/reject`, undefined, storage, 'getUser'],
  ['get', '/polls', undefined, storage, 'getAllPolls'],
  ['patch', '/polls/some-token', { isActive: false }, storage, 'getPollByPublicToken'],
  ['delete', '/polls/some-token', undefined, storage, 'getPollByPublicToken'],
  ['get', '/settings', undefined, storage, 'getSettings'],
  ['post', '/settings', { key: 'k', value: 1 }, storage, 'setSetting'],
  ['delete', '/settings/k', undefined, storage, 'deleteSetting'],
  ['get', '/security', undefined, storage, 'getSecuritySettings'],
  ['put', '/security', {}, storage, 'setSecuritySettings'],
  ['post', '/security/clear-rate-limits', undefined, loginRateLimiter, 'clearAll'],
  ['get', '/api-rate-limits', undefined, storage, 'getSecuritySettings'],
  ['put', '/api-rate-limits', {}, storage, 'getSecuritySettings'],
  ['post', '/api-rate-limits/clear', {}, apiRateLimiter, 'clearAll'],
  ['get', '/clamav', undefined, clamavService, 'getConfig'],
  ['put', '/clamav', { enabled: false }, clamavService, 'getConfig'],
  ['post', '/clamav/test', undefined, clamavService, 'testConnection'],
  ['post', '/clamav/test-config', { host: 'scanner', port: '3310' }, clamavService, 'testConnectionWithConfig'],
  ['get', '/clamav/scan-logs', undefined, clamavService, 'getScanLogs'],
  ['get', '/clamav/scan-logs/1', undefined, clamavService, 'getScanLog'],
  ['get', '/clamav/scan-stats', undefined, clamavService, 'getScanStats'],
  ['get', '/pentest-tools/status', undefined, pentestToolsService, 'getConfig'],
  ['get', '/pentest-tools/config', undefined, pentestToolsService, 'getConfig'],
  ['get', '/pentest-tools/tools', undefined, pentestToolsService, 'getAvailableTools'],
  ['get', '/pentest-tools/target', undefined, pentestToolsService, 'getPollyTargetInfo'],
  ['post', '/pentest-tools/target/sync', undefined, pentestToolsService, 'syncPollyTarget'],
  ['get', '/pentest-tools/scans', undefined, pentestToolsService, 'getScans'],
  ['get', '/pentest-tools/recent-scans', undefined, pentestToolsService, 'getRecentScans'],
  ['post', '/pentest-tools/scans', {}, pentestToolsService, 'startPollyScan'],
  ['get', '/pentest-tools/scans/1', undefined, pentestToolsService, 'getScanStatus'],
  ['get', '/pentest-tools/scans/1/findings', undefined, pentestToolsService, 'getFindings'],
  ['post', '/pentest-tools/scans/1/stop', undefined, pentestToolsService, 'stopScan'],
  ['get', '/tests/data-stats', undefined, storage, 'getTestDataStats'],
  ['delete', '/tests/purge-data', undefined, storage, 'purgeTestData'],
  ['get', '/notifications', undefined, storage, 'getNotificationSettings'],
  ['put', '/notifications', {}, storage, 'setNotificationSettings'],
  ['get', '/session-timeout', undefined, storage, 'getSessionTimeoutSettings'],
  ['put', '/session-timeout', {}, storage, 'setSessionTimeoutSettings'],
  ['get', '/calendar', undefined, storage, 'getCalendarSettings'],
  ['put', '/calendar', {}, storage, 'setCalendarSettings'],
  ['get', '/deprovision-settings', undefined, storage, 'getSetting'],
  ['put', '/deprovision-settings', { enabled: false }, storage, 'getSetting'],
  ['get', '/customization', undefined, storage, 'getCustomizationSettings'],
  ['put', '/customization', {}, storage, 'setCustomizationSettings'],
  ['post', '/wcag/audit', undefined, storage, 'getCustomizationSettings'],
  ['post', '/wcag/apply-corrections', undefined, storage, 'getCustomizationSettings'],
  ['put', '/wcag/settings', { enforcementEnabled: true }, storage, 'getCustomizationSettings'],
  ['get', '/email-templates', undefined, emailTemplateService, 'getAllTemplates'],
  ['get', '/email-templates/invitation', undefined, emailTemplateService, 'getTemplate'],
  ['put', '/email-templates/invitation', {}, emailTemplateService, 'getTemplate'],
  ['post', '/email-templates/invitation/reset', undefined, emailTemplateService, 'resetTemplate'],
  ['get', '/email-templates/invitation/variables', undefined, emailTemplateService, 'getVariables'],
  ['get', '/email-footer', undefined, emailTemplateService, 'getEmailFooter'],
  ['put', '/email-footer', { text: 'Footer' }, emailTemplateService, 'setEmailFooter'],
  ['get', '/email-theme', undefined, emailTemplateService, 'getEmailTheme'],
  ['put', '/email-theme', {}, emailTemplateService, 'setEmailTheme'],
  ['post', '/email-theme/reset', undefined, emailTemplateService, 'resetEmailTheme'],
  ['post', '/email-theme/import', { jsonContent: {} }, emailTemplateService, 'extractThemeFromEmailBuilder'],
  ['post', '/email-theme/import/confirm', { jsonContent: {} }, emailTemplateService, 'importThemeFromEmailBuilder'],
  ['delete', '/customization/logo', undefined, storage, 'getCustomizationSettings'],
  ['delete', '/customization/favicon', undefined, storage, 'getCustomizationSettings'],
  ['post', '/branding/reset', undefined, storage, 'setCustomizationSettings'],
];

let app: Express;
let admin: TestAgent;
let adminId: number;

describe('admin endpoints during backend failures', () => {
  beforeAll(async () => {
    app = await createTestApp();
    admin = await loginAdminAgent(app);
    adminId = (await admin.get('/api/v1/auth/me')).body.user.id;
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(() => vi.restoreAllMocks());

  it.each(cases)('%s %s returns a generic server error when its dependency fails', async (method, path, body, target, name) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const original = (target as any)[name].bind(target);
    const spy = vi.spyOn(target as any, name).mockImplementation(((...args: unknown[]) => {
      // Keep the admin's own session check working; fail every other lookup.
      if (name === 'getUser' && args[0] === adminId) return original(...args);
      throw new Error(SECRET);
    }) as any);

    let call = admin[method](`/api/v1/admin${path}`);
    if (body) call = call.send(body);
    const res = await call;

    expect(spy).toHaveBeenCalled();
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
  });

  it('keeps reporting database status when the connectivity check fails', async () => {
    // The status page itself must still answer and report the outage.
    const { pool } = await import('../../db');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const original = pool.query.bind(pool) as (...args: unknown[]) => unknown;
    vi.spyOn(pool, 'query').mockImplementation(((...args: unknown[]) =>
      args[0] === 'SELECT 1' ? Promise.reject(new Error(SECRET)) : original(...args)) as never);
    const res = await admin.get('/api/v1/admin/database-status');
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(false);
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
  });

  it('reports a failed Matrix connection test as an unsuccessful result', async () => {
    // The UI shows the result inline, so this route answers 200 with success=false.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(matrixService, 'testMatrixConnection').mockRejectedValue(new Error(SECRET));
    const res = await admin.post('/api/v1/admin/matrix/test');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
  });
});
