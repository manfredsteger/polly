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
 * Sentinel values written by the test cases — if these appear in the live DB
 * it means a previous test run was interrupted before afterAll could clean up.
 */
const TEST_SENTINEL_SITE_NAME = 'Acme';
const TEST_SENTINEL_COLOR = '#123456';

/**
 * Crash-safe save/restore strategy (two complementary layers):
 *
 * Layer 1 — backup key (covers runs that wrote the backup before crashing):
 *   beforeAll checks for a stale BACKUP_KEY written by a previous interrupted
 *   run, restores from it, and deletes the key before capturing originalSettings.
 *   afterAll writes the restored value back and deletes BACKUP_KEY to signal
 *   successful completion.
 *
 * Layer 2 — sentinel detection (covers runs that left known test values without
 *   a backup key, e.g. an older run predating this mechanism):
 *   If the live DB contains the well-known test-only values (siteName='Acme',
 *   primaryColor='#123456'), we know the DB is polluted and override
 *   originalSettings with clean schema defaults before persisting the backup.
 *   This breaks the self-reinforcing corruption loop even without a backup key.
 */
describe('PWA - /site.webmanifest', () => {
  let app: Express;
  let originalSettings: CustomizationSettings;

  beforeAll(async () => {
    app = await createTestApp();

    // Layer 1: if a previous run was killed after writing the backup key,
    // restore from it so the live DB is correct before we take a new snapshot.
    const staleBackup = await storage.getSetting(BACKUP_KEY);
    if (staleBackup) {
      const recovered = customizationSettingsSchema.parse(staleBackup.value);
      await storage.setCustomizationSettings(recovered);
      await storage.deleteSetting(BACKUP_KEY);
    }

    // Read the (possibly just-restored) live settings.
    const liveSettings = await storage.getCustomizationSettings();

    // Layer 2: detect known sentinel values left by an interrupted run that
    // predates the backup-key mechanism, or one that crashed before writing it.
    const isPolluted =
      liveSettings.branding.siteName === TEST_SENTINEL_SITE_NAME ||
      liveSettings.theme.primaryColor.toLowerCase() === TEST_SENTINEL_COLOR;

    if (isPolluted) {
      // Reset to schema defaults and use those clean defaults as the baseline
      // to restore in afterAll.
      const clean = customizationSettingsSchema.parse({});
      await storage.setCustomizationSettings(clean);
      originalSettings = await storage.getCustomizationSettings();
    } else {
      originalSettings = liveSettings;
    }

    // Persist backup so afterAll recovery works even if this run crashes.
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
    // Set sentinel branding/color values for this test and verify the manifest
    // reflects them.  afterAll will restore originalSettings.
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
