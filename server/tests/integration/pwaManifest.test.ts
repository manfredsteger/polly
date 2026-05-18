import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import { storage } from '../../storage';
import type { Express } from 'express';
import type { CustomizationSettings } from '@shared/schema';
import { customizationSettingsSchema } from '@shared/schema';

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose: 'any' | 'maskable' | 'monochrome';
}

export const testMeta = {
  category: 'integration' as const,
  name: 'PWA Manifest endpoint',
  description:
    'The /site.webmanifest endpoint must return a valid PWA manifest and reflect the current admin-configured branding (siteName + theme color).',
  severity: 'medium' as const,
};

const BACKUP_KEY = '_test_pwa_backup';

/**
 * Crash-safe save/restore pattern:
 *
 * beforeAll:
 *   1. If BACKUP_KEY exists a previous afterAll never ran (process was killed).
 *      Restore from that backup so the live DB is clean again.
 *   2. Capture the (now-clean) live settings as `originalSettings`.
 *   3. Write BACKUP_KEY so afterAll can be skipped safely if this run also crashes.
 *
 * afterAll:
 *   1. Restore `originalSettings` to the live DB.
 *   2. Delete BACKUP_KEY (signals that cleanup completed successfully).
 */
describe('PWA - /site.webmanifest', () => {
  let app: Express;
  let originalSettings: CustomizationSettings;

  beforeAll(async () => {
    app = await createTestApp();

    // Crash-safe: if a previous test run was killed before afterAll, a stale
    // backup key exists.  Restore from it first so we don't keep perpetuating
    // the corrupted state as the "original".
    const staleBackup = await storage.getSetting(BACKUP_KEY);
    if (staleBackup) {
      const recovered = customizationSettingsSchema.parse(staleBackup.value);
      await storage.setCustomizationSettings(recovered);
      await storage.deleteSetting(BACKUP_KEY);
    }

    // Now read the (possibly just-restored) live settings as the true original.
    originalSettings = await storage.getCustomizationSettings();

    // Persist the backup so afterAll can recover it if this run crashes.
    await storage.setSetting({ key: BACKUP_KEY, value: originalSettings });
  });

  afterAll(async () => {
    // Restore live DB and signal successful cleanup by removing the backup key.
    await storage.setCustomizationSettings(originalSettings);
    await storage.deleteSetting(BACKUP_KEY);
  });

  it('returns valid JSON with all PWA-required fields', async () => {
    const res = await request(app).get('/site.webmanifest');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/manifest\+json/);

    const manifest = res.body;
    expect(manifest).toBeTypeOf('object');

    // Required fields per https://web.dev/articles/install-criteria
    expect(typeof manifest.name).toBe('string');
    expect(manifest.name.length).toBeGreaterThan(0);
    expect(typeof manifest.short_name).toBe('string');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(typeof manifest.theme_color).toBe('string');
    expect(typeof manifest.background_color).toBe('string');

    // Recommended PWA fields
    expect(manifest.id).toBeDefined();
    expect(Array.isArray(manifest.display_override)).toBe(true);
    expect(typeof manifest.lang).toBe('string');
    expect(['de', 'en']).toContain(manifest.lang);
    expect(Array.isArray(manifest.categories)).toBe(true);

    // Icons: at least one 192x192 and one 512x512, plus a maskable variant
    expect(Array.isArray(manifest.icons)).toBe(true);
    const icons = manifest.icons as ManifestIcon[];
    const has192 = icons.some((i) => i.sizes === '192x192' && i.purpose === 'any');
    const has512 = icons.some((i) => i.sizes === '512x512' && i.purpose === 'any');
    const hasMaskable = icons.some((i) => i.purpose === 'maskable');
    expect(has192).toBe(true);
    expect(has512).toBe(true);
    expect(hasMaskable).toBe(true);
  });

  it('reflects custom branding from admin settings', async () => {
    // Use fixed test values — NOT spread from originalSettings — so assertions
    // are fully deterministic and don't depend on whatever was in the DB.
    await storage.setCustomizationSettings({
      ...originalSettings,
      branding: {
        ...originalSettings.branding,
        siteName: 'Acme',
        siteNameAccent: 'Polls',
      },
      theme: {
        ...originalSettings.theme,
        primaryColor: '#123456',
        defaultThemeMode: 'dark',
      },
    });

    // Re-read storage right before hitting the endpoint so a parallel test
    // file mutating customization can't make this assertion flaky — the
    // manifest must reflect *whatever* is currently in storage.
    const current = await storage.getCustomizationSettings();
    const res = await request(app).get('/site.webmanifest');
    expect(res.status).toBe(200);
    const manifest = res.body;

    const expectedName = `${current.branding.siteName}${current.branding.siteNameAccent}`;
    expect(manifest.name).toBe(expectedName);
    expect(manifest.theme_color.toLowerCase()).toBe(current.theme.primaryColor.toLowerCase());
    if (current.theme.defaultThemeMode === 'dark') {
      expect(manifest.background_color.toLowerCase()).toMatch(/#0f172a|#000/);
    }
  });

  it('manifest lang reflects configured defaultLanguage', async () => {
    const baseline = await storage.getCustomizationSettings();

    await storage.setCustomizationSettings({
      ...baseline,
      language: { ...(baseline.language ?? { defaultLanguage: 'de' }), defaultLanguage: 'en' },
    });
    const enRes = await request(app).get('/site.webmanifest');
    expect(enRes.status).toBe(200);
    const enCurrent = await storage.getCustomizationSettings();
    expect(enRes.body.lang).toBe(enCurrent.language?.defaultLanguage || 'en');

    await storage.setCustomizationSettings({
      ...baseline,
      language: { ...(baseline.language ?? { defaultLanguage: 'de' }), defaultLanguage: 'de' },
    });
    const deRes = await request(app).get('/site.webmanifest');
    expect(deRes.status).toBe(200);
    const deCurrent = await storage.getCustomizationSettings();
    expect(deRes.body.lang).toBe(deCurrent.language?.defaultLanguage || 'de');
  });
});
