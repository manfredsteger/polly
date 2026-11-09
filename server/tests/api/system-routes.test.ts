/**
 * Scenario tests for the public system endpoints (branding, accessibility,
 * mobile theme, theme preference, language), the admin SMTP/OIDC/Matrix
 * diagnostics and Matrix poll invitations, plus the guest image upload.
 * External services (SMTP, OIDC, Matrix, image processing) are stubbed.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../testApp';
import { storage } from '../../storage';
import { emailService } from '../../services/emailService';
import { authService } from '../../services/authService';
import { matrixService } from '../../services/matrixService';
import { imageService } from '../../services/imageService';
import { createLoggedInUser, loginAdminAgent, type CreatedTestUser, type TestAgent } from '../fixtures/users';

export const testMeta = {
  category: 'api' as const,
  name: 'System-Endpunkte',
  description: 'Prüft Branding-, Theme-, Matrix- und Diagnose-Endpunkte',
  severity: 'medium' as const,
};

const API = '/api/v1';
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

let app: Express;
let admin: TestAgent;
let owner: CreatedTestUser;
let stranger: CreatedTestUser;
const createdPollIds: string[] = [];
const savedEnv = { copyright: process.env.POLLY_COPYRIGHT_TEXT, wcag: process.env.POLLY_WCAG_OVERRIDE };

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

beforeAll(async () => {
  app = await createTestApp();
  admin = await loginAdminAgent(app);
  owner = await createLoggedInUser(app);
  stranger = await createLoggedInUser(app);
});

afterEach(() => {
  vi.restoreAllMocks();
  restoreEnv('POLLY_COPYRIGHT_TEXT', savedEnv.copyright);
  restoreEnv('POLLY_WCAG_OVERRIDE', savedEnv.wcag);
});

afterAll(async () => {
  for (const id of createdPollIds) await storage.deletePoll(id).catch(() => {});
  for (const u of [owner, stranger]) await storage.deleteUser(u.id).catch(() => {});
});

const silence = () => vi.spyOn(console, 'error').mockImplementation(() => {});

describe('Public branding endpoints', () => {
  it('locks the copyright from the environment and reports failures', async () => {
    process.env.POLLY_COPYRIGHT_TEXT = '© Env GmbH';
    const res = await request(app).get(`${API}/customization`);
    expect(res.body.footer).toMatchObject({ copyrightText: '© Env GmbH', copyrightEnvLocked: true });

    silence();
    vi.spyOn(storage, 'getCustomizationSettings').mockRejectedValueOnce(new Error('db down'));
    expect((await request(app).get(`${API}/customization`)).status).toBe(500);
  });

  it('reads the default language and falls back to English', async () => {
    vi.spyOn(storage, 'getSetting').mockResolvedValueOnce({ key: 'customization_language', value: { defaultLanguage: 'de' } } as any);
    expect((await request(app).get(`${API}/system/language`)).body).toEqual({ defaultLanguage: 'de' });
    vi.spyOn(storage, 'getSetting').mockResolvedValueOnce(undefined);
    expect((await request(app).get(`${API}/system/language`)).body).toEqual({ defaultLanguage: 'en' });
    silence();
    vi.spyOn(storage, 'getSetting').mockRejectedValueOnce(new Error('db down'));
    expect((await request(app).get(`${API}/system/language`)).body).toEqual({ defaultLanguage: 'en' });
  });

  it('reports which accessibility theme is enforced', async () => {
    const base = await storage.getCustomizationSettings();
    vi.spyOn(storage, 'getCustomizationSettings').mockResolvedValue({ ...base, wcag: { enforcementEnabled: false } } as any);
    const defaultOn = await request(app).get(`${API}/settings/accessibility`);
    expect(defaultOn.body).toMatchObject({ enforceDefaultTheme: true, wcagOverrideEnv: false });

    vi.spyOn(storage, 'getCustomizationSettings').mockResolvedValue({ ...base, wcag: { enforcementEnabled: false, enforceDefaultTheme: false } } as any);
    const custom = await request(app).get(`${API}/settings/accessibility`);
    expect(custom.body.enforceDefaultTheme).toBe(false);
    expect(custom.body.message).toMatch(/Custom theme/);

    process.env.POLLY_WCAG_OVERRIDE = 'true';
    vi.spyOn(storage, 'getCustomizationSettings').mockResolvedValue({ ...base, wcag: { enforcementEnabled: true, enforceDefaultTheme: true } } as any);
    const overridden = await request(app).get(`${API}/settings/accessibility`);
    expect(overridden.body).toMatchObject({ enforceDefaultTheme: false, wcagOverrideEnv: true });

    silence();
    vi.spyOn(storage, 'getCustomizationSettings').mockRejectedValue(new Error('db down'));
    expect((await request(app).get(`${API}/settings/accessibility`)).status).toBe(500);
  });

  it('builds the mobile theme with absolute asset URLs and color fallbacks', async () => {
    const base = await storage.getCustomizationSettings();
    vi.spyOn(matrixService, 'isMatrixEnabled').mockReturnValue(true);
    vi.spyOn(matrixService, 'getMatrixConfig').mockReturnValue({ searchEnabled: true } as any);
    vi.spyOn(storage, 'getCustomizationSettings').mockResolvedValueOnce({
      ...base,
      branding: { ...base.branding, siteName: 'Polly Kita', siteNameAccent: 'Kita', logoUrl: '/uploads/logo.png', faviconUrl: 'https://cdn.example/fav.ico' },
      theme: { ...base.theme, primaryColor: '#ff8000', borderRadius: 12 },
    } as any);
    const res = await request(app).get(`${API}/customization/mobile`);
    expect(res.status).toBe(200);
    expect(res.body.branding).toMatchObject({ siteNameFirst: 'Polly', siteNameAccent: 'Kita', faviconUrl: 'https://cdn.example/fav.ico' });
    expect(res.body.branding.logoUrl).toMatch(/^https?:\/\/.+\/uploads\/logo\.png$/);
    expect(res.body.theme).toMatchObject({ primaryColorRGB: { r: 255, g: 128, b: 0 }, borderRadius: 12 });
    expect(res.body.matrix).toEqual({ enabled: true, searchEnabled: true });

    vi.spyOn(storage, 'getCustomizationSettings').mockResolvedValueOnce({
      ...base,
      branding: { siteName: 'Solo', siteNameAccent: '', logoUrl: 'https://cdn.example/logo.png', faviconUrl: '/fav.ico' },
      theme: { primaryColor: 'blue' },
    } as any);
    const plain = await request(app).get(`${API}/customization/mobile`);
    expect(plain.body.branding).toMatchObject({ siteNameFirst: 'Solo', logoUrl: 'https://cdn.example/logo.png' });
    expect(plain.body.branding.faviconUrl).toMatch(/\/fav\.ico$/);
    expect(plain.body.theme).toMatchObject({ primaryColorRGB: null, scheduleColor: '#10b981', borderRadius: 8 });

    vi.spyOn(storage, 'getCustomizationSettings').mockResolvedValueOnce({ ...base, branding: undefined, theme: undefined } as any);
    const empty = await request(app).get(`${API}/customization/mobile`);
    expect(empty.body.branding).toMatchObject({ siteName: '', logoUrl: null, faviconUrl: null });
    expect(empty.body.theme.primaryColor).toBe('#4f46e5');

    silence();
    vi.spyOn(storage, 'getCustomizationSettings').mockRejectedValueOnce(new Error('db down'));
    expect((await request(app).get(`${API}/customization/mobile`)).status).toBe(500);
  });
});

describe('Theme preference', () => {
  it('prefers the account setting, then the cookie, then the site default', async () => {
    await storage.updateUser(owner.id, { themePreference: 'dark' } as any);
    expect((await owner.agent.get(`${API}/theme`)).body).toEqual({ themePreference: 'dark', source: 'user' });

    const cookie = await request(app).get(`${API}/theme`).set('Cookie', 'theme_preference=light');
    expect(cookie.body).toEqual({ themePreference: 'light', source: 'cookie' });

    const base = await storage.getCustomizationSettings();
    vi.spyOn(storage, 'getCustomizationSettings').mockResolvedValueOnce({ ...base, theme: { ...base.theme, defaultThemeMode: 'dark' } } as any);
    const fallback = await request(app).get(`${API}/theme`).set('Cookie', 'theme_preference=neon');
    expect(fallback.body).toEqual({ themePreference: 'dark', source: 'default' });

    vi.spyOn(storage, 'getCustomizationSettings').mockResolvedValueOnce({ ...base, theme: {} } as any);
    expect((await request(app).get(`${API}/theme`)).body.themePreference).toBe('system');
  });

  it('falls through to the default when the session user vanished, and reports failures', async () => {
    vi.spyOn(storage, 'getUser').mockResolvedValue(undefined);
    expect((await owner.agent.get(`${API}/theme`)).body.source).toBe('default');
    vi.restoreAllMocks();
    silence();
    vi.spyOn(storage, 'getCustomizationSettings').mockRejectedValueOnce(new Error('db down'));
    expect((await request(app).get(`${API}/theme`)).status).toBe(500);
  });

  it('stores a valid guest theme cookie and rejects invalid values', async () => {
    const ok = await request(app).post(`${API}/theme`).send({ themePreference: 'dark' });
    expect(ok.body).toEqual({ success: true, themePreference: 'dark' });
    expect(String(ok.headers['set-cookie'])).toMatch(/theme_preference=dark/);
    expect((await request(app).post(`${API}/theme`).send({ themePreference: 'neon' })).status).toBe(400);
    expect((await request(app).post(`${API}/theme`).send({})).status).toBe(400);
  });
});

describe('Admin diagnostics', () => {
  it('returns SMTP and OIDC status and connection test results', async () => {
    expect((await request(app).get(`${API}/email-status`)).body).toHaveProperty('smtpConfigured');
    vi.spyOn(emailService, 'testConnection').mockResolvedValueOnce({ success: false, error: 'refused' });
    vi.spyOn(authService, 'testOidcConnection').mockResolvedValueOnce({ success: true });
    expect((await admin.get(`${API}/smtp-config`)).status).toBe(200);
    expect((await admin.post(`${API}/smtp-test`)).body).toEqual({ success: false, error: 'refused' });
    expect((await admin.get(`${API}/oidc-config`)).body).toHaveProperty('configured');
    expect((await admin.post(`${API}/oidc-test`)).body).toEqual({ success: true });
    expect((await owner.agent.get(`${API}/smtp-config`)).status).toBe(403);
  });

  it('reports Matrix status and connection tests, also when Matrix throws', async () => {
    vi.spyOn(matrixService, 'isMatrixEnabled').mockReturnValueOnce(false);
    vi.spyOn(matrixService, 'getMatrixConfig').mockReturnValueOnce({ searchEnabled: false } as any);
    expect((await request(app).get(`${API}/matrix/status`)).body).toEqual({ enabled: false, searchEnabled: false });
    vi.spyOn(matrixService, 'isMatrixEnabled').mockImplementationOnce(() => { throw new Error('bad config'); });
    expect((await request(app).get(`${API}/matrix/status`)).body).toEqual({ enabled: false, searchEnabled: false });

    vi.spyOn(matrixService, 'testMatrixConnection').mockResolvedValueOnce({ success: true } as any);
    expect((await admin.post(`${API}/matrix/test`)).body).toEqual({ success: true });
    silence();
    vi.spyOn(matrixService, 'testMatrixConnection').mockRejectedValueOnce(new Error('timeout'));
    expect((await admin.post(`${API}/matrix/test`)).body).toEqual({ success: false, error: 'Matrix-Verbindungstest fehlgeschlagen' });
  });
});

describe('Matrix user search and poll invitations', () => {
  it('searches only when Matrix is enabled and the term is long enough', async () => {
    vi.spyOn(matrixService, 'isMatrixEnabled').mockReturnValue(false);
    expect((await owner.agent.get(`${API}/matrix/users/search?q=ann`)).status).toBe(400);

    vi.spyOn(matrixService, 'isMatrixEnabled').mockReturnValue(true);
    const search = vi.spyOn(matrixService, 'searchMatrixUsers').mockResolvedValue({ results: [{ userId: '@ann:kita' }], limited: false } as any);
    expect((await owner.agent.get(`${API}/matrix/users/search?q=a`)).body).toEqual({ results: [], limited: false });
    expect((await owner.agent.get(`${API}/matrix/users/search`)).body).toEqual({ results: [], limited: false });
    const res = await owner.agent.get(`${API}/matrix/users/search?q=ann&limit=x`);
    expect(res.body.results).toHaveLength(1);
    expect(search).toHaveBeenCalledWith('ann', 10);
    await owner.agent.get(`${API}/matrix/users/search?q=ann&limit=3`);
    expect(search).toHaveBeenLastCalledWith('ann', 3);

    silence();
    search.mockRejectedValueOnce(new Error('homeserver down'));
    expect((await owner.agent.get(`${API}/matrix/users/search?q=ann`)).status).toBe(500);
    expect((await request(app).get(`${API}/matrix/users/search?q=ann`)).status).toBe(401);
  });

  it('invites Matrix users to the owner\'s poll only', async () => {
    const { poll } = await storage.createPoll(
      { title: 'Matrix Einladung', type: 'survey', userId: owner.id, isTestData: true } as any,
      [{ text: 'A', order: 0, pollId: '' }] as any,
    );
    createdPollIds.push(poll.id);
    const url = `${API}/polls/${poll.adminToken}/invite/matrix`;

    vi.spyOn(matrixService, 'isMatrixEnabled').mockReturnValue(false);
    expect((await owner.agent.post(url).send({ userIds: ['@a:kita'] })).status).toBe(400);

    vi.spyOn(matrixService, 'isMatrixEnabled').mockReturnValue(true);
    const send = vi.spyOn(matrixService, 'sendPollInvitation').mockResolvedValue({ sent: ['@a:kita'], failed: ['@b:kita'] } as any);
    expect((await owner.agent.post(url).send({ userIds: [] })).status).toBe(400);
    expect((await owner.agent.post(url).send({ userIds: 'x' })).status).toBe(400);
    expect((await owner.agent.post(`${API}/polls/unknown-token/invite/matrix`).send({ userIds: ['@a:kita'] })).status).toBe(404);
    expect((await stranger.agent.post(url).send({ userIds: ['@a:kita'] })).status).toBe(403);

    const ok = await owner.agent.post(url).send({ userIds: ['@a:kita', '@b:kita'], customMessage: 'Bitte abstimmen' });
    expect(ok.body).toMatchObject({ success: true, sent: 1, failed: 1 });
    expect(send).toHaveBeenCalledWith(['@a:kita', '@b:kita'], 'Matrix Einladung', expect.stringContaining(`/poll/${poll.publicToken}`), 'Bitte abstimmen');

    silence();
    send.mockRejectedValueOnce(new Error('homeserver down'));
    expect((await owner.agent.post(url).send({ userIds: ['@a:kita'] })).status).toBe(500);
  });
});

describe('Guest image upload', () => {
  it.each([
    [{ invalidFileType: true }, 400],
    [{ virusName: 'Eicar' }, 422],
    [{ scannerUnavailable: true }, 503],
    [{ storagePermission: true }, 507],
    [{}, 500],
  ] as const)('maps upload failure %o to HTTP %i', async (flags, status) => {
    vi.spyOn(imageService, 'processUpload').mockResolvedValueOnce({ success: false, error: 'nope', ...flags } as any);
    const res = await request(app).post(`${API}/upload/image`).attach('image', PNG, { filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(status);
    expect(res.body.error).toBe('nope');
  });

  it('passes the uploader context and returns the stored URL', async () => {
    const process = vi.spyOn(imageService, 'processUpload').mockResolvedValueOnce({ success: true, imageUrl: '/uploads/a.png' } as any);
    const res = await owner.agent.post(`${API}/upload/image`).attach('image', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect(res.body).toEqual({ imageUrl: '/uploads/a.png' });
    expect(process).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: owner.id }), { allowSvg: false });
    expect((await request(app).post(`${API}/upload/image`)).status).toBe(400);
  });
});
