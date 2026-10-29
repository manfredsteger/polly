/**
 * Scenario tests for admin branding, WCAG contrast audit/correction, ClamAV
 * configuration, email template/theme input validation, uploads and test-run
 * history views. Customization settings are snapshotted and restored, and all
 * email template writes are intercepted so no shared template data changes.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import type { Express } from 'express';
import { eq, inArray } from 'drizzle-orm';
import { createTestApp } from '../testApp';
import { storage } from '../../storage';
import { db } from '../../db';
import { testRuns, testResults } from '@shared/schema';
import { clamavService } from '../../services/clamavService';
import { emailTemplateService } from '../../services/emailTemplateService';
import { imageService } from '../../services/imageService';
import { loginAdminAgent, type TestAgent } from '../fixtures/users';

export const testMeta = {
  category: 'api' as const,
  name: 'Admin – Branding & Barrierefreiheit',
  description: 'Prüft Branding-, WCAG-Kontrast-, Upload- und Vorlagen-Eingaben im Admin-Bereich',
  severity: 'high' as const,
};

const API = '/api/v1/admin';
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300010000050001', 'hex');

let app: Express;
let admin: TestAgent;
let originalCustomization: Awaited<ReturnType<typeof storage.getCustomizationSettings>>;
let originalClamav: unknown;
const savedCopyright = process.env.POLLY_COPYRIGHT_TEXT;

beforeAll(async () => {
  app = await createTestApp();
  admin = await loginAdminAgent(app);
  originalCustomization = structuredClone(await storage.getCustomizationSettings());
  originalClamav = (await storage.getSetting('clamav_config'))?.value;
});

afterEach(() => {
  vi.restoreAllMocks();
  if (savedCopyright === undefined) delete process.env.POLLY_COPYRIGHT_TEXT;
  else process.env.POLLY_COPYRIGHT_TEXT = savedCopyright;
});

afterAll(async () => {
  await storage.setCustomizationSettings(originalCustomization);
  if (originalClamav === undefined) await storage.deleteSetting('clamav_config').catch(() => {});
  else await storage.setSetting({ key: 'clamav_config', value: originalClamav as any });
  clamavService.clearConfigCache();
});

describe('Customization with an environment-locked copyright', () => {
  it('reports the env copyright as locked and refuses to overwrite it', async () => {
    process.env.POLLY_COPYRIGHT_TEXT = '© Stadt Musterhausen';
    const get = await admin.get(`${API}/customization`);
    expect(get.status).toBe(200);
    expect(get.body.footer.copyrightText).toBe('© Stadt Musterhausen');
    expect(get.body.footer.copyrightEnvLocked).toBe(true);

    const blocked = await admin.put(`${API}/customization`).send({ footer: { copyrightText: 'Hijack' } });
    expect(blocked.status).toBe(400);
    expect(blocked.body.error).toMatch(/POLLY_COPYRIGHT_TEXT/);
  });

  it('keeps the stored copyright when other footer fields change', async () => {
    const before = await storage.getCustomizationSettings();
    process.env.POLLY_COPYRIGHT_TEXT = '© Env';
    const set = vi.spyOn(storage, 'setCustomizationSettings');
    const res = await admin.put(`${API}/customization`).send({ footer: { description: 'Neu', copyrightEnvLocked: true } });
    expect(res.status).toBe(200);
    const sent = set.mock.calls[0][0] as any;
    expect(sent.footer.copyrightText).toBe(before.footer?.copyrightText || '');
    expect(sent.footer).not.toHaveProperty('copyrightEnvLocked');
  });

  it('turns off the enforced default theme once brand colors are customized', async () => {
    const set = vi.spyOn(storage, 'setCustomizationSettings');
    const res = await admin.put(`${API}/customization`).send({ theme: { surveyColor: '#123456' }, wcag: { enforcementEnabled: true } });
    expect(res.status).toBe(200);
    expect((set.mock.calls[0][0] as any).wcag).toEqual({ enforcementEnabled: true, enforceDefaultTheme: false });
  });
});

describe('WCAG contrast audit and corrections', () => {
  it('flags low-contrast colors per mode and applies the suggested overrides', async () => {
    await storage.setCustomizationSettings({
      theme: {
        ...originalCustomization.theme,
        primaryColor: '#ffff00', // too light on white
        primaryColorDark: '#111111', // too dark on the dark background
        scheduleColor: '#777777', // grey, saturation 0
        surveyColor: '#00aa00',
        organizationColor: '#000000',
        organizationColorLight: '#000000',
      },
    } as any);

    const audit = await admin.post(`${API}/wcag/audit`);
    expect(audit.status).toBe(200);
    expect(audit.body.passed).toBe(false);
    const byKey = Object.fromEntries(audit.body.issues.map((i: any) => [`${i.token}:${i.mode}`, i]));
    expect(byKey['--primary:light'].originalValue).toBe('#ffff00');
    expect(byKey['--primary:dark'].originalValue).toBe('#111111');
    expect(byKey['--color-organization:dark']).toBeDefined();
    expect(byKey['--color-organization:light']).toBeUndefined();
    for (const issue of audit.body.issues) {
      expect(issue.contrastRatio).toBeLessThan(4.5);
      expect(issue.suggestedValue).toMatch(/^#[0-9a-f]{6}$/i);
    }

    const applied = await admin.post(`${API}/wcag/apply-corrections`);
    expect(applied.status).toBe(200);
    expect(applied.body.appliedCorrections['--primary:light']).toBe(byKey['--primary:light'].suggestedValue);
    expect(applied.body.settings.theme.primaryColorDark).toBe(byKey['--primary:dark'].suggestedValue);
    expect(applied.body.settings.wcag.lastAudit).toBeUndefined();

    const reaudit = await admin.post(`${API}/wcag/audit`);
    expect(reaudit.body.issues.map((i: any) => i.token)).not.toContain('--primary');
  });

  it('refuses to apply corrections without a failing audit', async () => {
    await storage.setCustomizationSettings({ wcag: { enforcementEnabled: false, lastAudit: { runAt: new Date().toISOString(), passed: true, issues: [] } } } as any);
    const res = await admin.post(`${API}/wcag/apply-corrections`);
    expect(res.status).toBe(400);
  });

  it('skips unknown tokens in a stored audit', async () => {
    await storage.setCustomizationSettings({
      wcag: { enforcementEnabled: false, lastAudit: { runAt: '', passed: false, issues: [{ token: '--unknown', originalValue: '#eeeeee', mode: 'light', bgColor: '#ffffff', contrastRatio: 1.1, requiredRatio: 4.5, suggestedValue: '#000000' }] } },
    } as any);
    const res = await admin.post(`${API}/wcag/apply-corrections`);
    expect(res.status).toBe(200);
    expect(res.body.appliedCorrections).toEqual({});
  });

  it('stores the enforcement switch as a boolean', async () => {
    const on = await admin.put(`${API}/wcag/settings`).send({ enforcementEnabled: 'yes' });
    expect(on.body.enforcementEnabled).toBe(true);
    const off = await admin.put(`${API}/wcag/settings`).send({});
    expect(off.body.enforcementEnabled).toBe(false);
  });
});

describe('ClamAV configuration', () => {
  it('only takes over correctly typed fields', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await admin.put(`${API}/clamav`).send({ enabled: false, host: 'scanner.local', port: 3311, timeout: 5000, maxFileSize: 1024, extra: 'ignored' });
    expect(res.status).toBe(200);
    expect(res.body.config).toMatchObject({ enabled: false, host: 'scanner.local', port: 3311, timeout: 5000, maxFileSize: 1024 });
    expect(res.body.config).not.toHaveProperty('extra');

    const ignored = await admin.put(`${API}/clamav`).send({ enabled: 'no', port: '3312' });
    expect(ignored.body.config).toMatchObject({ enabled: false, port: 3311 });
  });

  it('requires host and port for a connection test and falls back to default numbers', async () => {
    expect((await admin.post(`${API}/clamav/test-config`).send({ host: 'scanner' })).status).toBe(400);
    const probe = vi.spyOn(clamavService, 'testConnectionWithConfig').mockResolvedValue({ success: true, message: 'ok' } as any);
    const res = await admin.post(`${API}/clamav/test-config`).send({ host: 'scanner', port: 'abc', timeout: 'x' });
    expect(res.status).toBe(200);
    expect(probe).toHaveBeenCalledWith('scanner', 3310, 30000);
  });
});

describe('Email template, footer and theme input validation', () => {
  it.each([
    ['get', '/email-templates/invitation'],
    ['put', '/email-templates/invitation'],
    ['post', '/email-templates/invitation/reset'],
    ['post', '/email-templates/invitation/preview'],
    ['post', '/email-templates/invitation/test'],
    ['get', '/email-footer'],
    ['put', '/email-footer'],
  ] as const)('%s %s rejects an unsupported language', async (method, path) => {
    const res = await admin[method](`${API}${path}?language=fr`).send({ text: 'x', email: 'admin@test.example' });
    expect(res.status).toBe(400);
  });

  it('rejects unknown template types', async () => {
    expect((await admin.put(`${API}/email-templates/nope`).send({})).status).toBe(400);
    expect((await admin.post(`${API}/email-templates/nope/reset`)).status).toBe(400);
  });

  it('requires template content when none is stored yet', async () => {
    vi.spyOn(emailTemplateService, 'getTemplate').mockResolvedValueOnce({ jsonContent: null } as any);
    const save = vi.spyOn(emailTemplateService, 'saveTemplate');
    const res = await admin.put(`${API}/email-templates/invitation`).send({ subject: 'Hallo' });
    expect(res.status).toBe(400);
    expect(save).not.toHaveBeenCalled();
  });

  it('reuses the stored content when only the subject changes', async () => {
    vi.spyOn(emailTemplateService, 'getTemplate').mockResolvedValueOnce({ jsonContent: { blocks: [] } } as any);
    const save = vi.spyOn(emailTemplateService, 'saveTemplate').mockResolvedValueOnce({ type: 'invitation' } as any);
    const res = await admin.put(`${API}/email-templates/invitation?language=en`).send({ subject: 'Hello' });
    expect(res.status).toBe(200);
    expect(save).toHaveBeenCalledWith('invitation', { blocks: [] }, 'Hello', undefined, undefined, 'en');
  });

  it('mirrors html and text when only one footer variant is given', async () => {
    const set = vi.spyOn(emailTemplateService, 'setEmailFooter').mockImplementation(async (f: any) => f);
    expect((await admin.put(`${API}/email-footer`).send({})).status).toBe(400);
    await admin.put(`${API}/email-footer`).send({ html: '<b>Fuß</b>' });
    expect(set).toHaveBeenLastCalledWith({ html: '<b>Fuß</b>', text: '<b>Fuß</b>' }, 'de');
    await admin.put(`${API}/email-footer?language=en`).send({ text: 'Foot' });
    expect(set).toHaveBeenLastCalledWith({ html: 'Foot', text: 'Foot' }, 'en');
  });

  it('keeps only valid email theme values', async () => {
    const set = vi.spyOn(emailTemplateService, 'setEmailTheme').mockImplementation(async (t: any) => t);
    const res = await admin.put(`${API}/email-theme`).send({
      backdropColor: ' #fafafa ',
      canvasColor: 'url(javascript:alert(1))',
      linkColor: 42,
      buttonTextColor: 'rgba(0, 0, 0, 0.5)',
      fontFamily: "Inter, 'Segoe UI', sans-serif",
      buttonBorderRadius: '12.6',
    });
    expect(res.status).toBe(200);
    expect(set).toHaveBeenLastCalledWith({
      backdropColor: '#fafafa',
      buttonTextColor: 'rgba(0, 0, 0, 0.5)',
      fontFamily: "Inter, 'Segoe UI', sans-serif",
      buttonBorderRadius: 13,
    });

    await admin.put(`${API}/email-theme`).send({ fontFamily: 'x; } body { color: red', buttonBorderRadius: 500 });
    expect(set).toHaveBeenLastCalledWith({});
    await admin.put(`${API}/email-theme`).send({ fontFamily: 'A'.repeat(201), buttonBorderRadius: 'abc' });
    expect(set).toHaveBeenLastCalledWith({});
  });

  it('requires JSON content to confirm a theme import', async () => {
    expect((await admin.post(`${API}/email-theme/import/confirm`).send({})).status).toBe(400);
  });
});

describe('Logo and favicon uploads', () => {
  it.each([
    [{ invalidFileType: true }, 400],
    [{ virusName: 'Eicar' }, 422],
    [{ scannerUnavailable: true }, 503],
    [{ storagePermission: true }, 507],
    [{}, 500],
  ] as const)('maps upload failure %o to HTTP %i', async (flags, status) => {
    for (const field of ['logo', 'favicon']) {
      vi.spyOn(imageService, 'processUpload').mockResolvedValueOnce({ success: false, error: 'nope', ...flags } as any);
      const res = await admin.post(`${API}/customization/${field}`).attach(field, PNG, { filename: 'x.png', contentType: 'image/png' });
      expect(res.status).toBe(status);
      expect(res.body.error).toBe('nope');
    }
  });

  it('stores the uploaded favicon and logo URLs', async () => {
    vi.spyOn(imageService, 'processUpload')
      .mockResolvedValueOnce({ success: true, imageUrl: '/uploads/fav.png' } as any)
      .mockResolvedValueOnce({ success: true, imageUrl: '/uploads/logo.png' } as any);
    const fav = await admin.post(`${API}/customization/favicon`).attach('favicon', PNG, { filename: 'f.png', contentType: 'image/png' });
    expect(fav.body).toEqual({ faviconUrl: '/uploads/fav.png' });
    const logo = await admin.post(`${API}/customization/logo`).attach('logo', PNG, { filename: 'l.png', contentType: 'image/png' });
    expect(logo.body).toEqual({ logoUrl: '/uploads/logo.png' });
    const branding = (await storage.getCustomizationSettings()).branding as any;
    expect(branding.faviconUrl).toBe('/uploads/fav.png');
    expect(branding.logoUrl).toBe('/uploads/logo.png');
  });

  it('rejects missing files, non-images and upload errors', async () => {
    expect((await admin.post(`${API}/customization/favicon`)).status).toBe(400);
    const wrongType = await admin.post(`${API}/customization/favicon`).attach('favicon', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(wrongType.status).toBe(400);
    expect(wrongType.body.error).toBe('Upload fehlgeschlagen');

    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(imageService, 'processUpload').mockRejectedValueOnce(new Error('disk'));
    const crashed = await admin.post(`${API}/customization/favicon`).attach('favicon', PNG, { filename: 'f.png', contentType: 'image/png' });
    expect(crashed.status).toBe(500);
  });

  it('rejects files above the size limit', async () => {
    const big = Buffer.alloc(5 * 1024 * 1024 + 10, 0);
    const res = await admin.post(`${API}/customization/favicon`).attach('favicon', big, { filename: 'big.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/zu groß/);
  });
});

describe('Test run history views', () => {
  it('lists runs with defaults for missing counters and optional errors', async () => {
    const [run] = await db.insert(testRuns).values({ status: 'failed', totalTests: null, passed: null, failed: null, skipped: null }).returning();
    try {
      await db.insert(testResults).values([
        { runId: run.id, testFile: 'a.test.ts', testName: 'ok', category: 'api', status: 'passed', duration: 5 },
        { runId: run.id, testFile: 'a.test.ts', testName: 'broken', category: 'api', status: 'failed', error: 'boom' },
      ]);
      const res = await admin.get(`${API}/test-runs?limit=200`);
      expect(res.status).toBe(200);
      const entry = res.body.find((r: any) => r.id === String(run.id));
      expect(entry.summary).toEqual({ total: 0, passed: 0, failed: 0, skipped: 0 });
      expect(entry.completedAt).toBeUndefined();
      expect(entry.results.map((r: any) => r.error)).toEqual([undefined, 'boom']);
    } finally {
      await db.delete(testResults).where(eq(testResults.runId, run.id));
      await db.delete(testRuns).where(inArray(testRuns.id, [run.id]));
    }
  });

  it('reports no current run when nothing is running', async () => {
    const res = await admin.get(`${API}/test-runs/current`);
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});
