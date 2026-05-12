import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import { storage } from '../../storage';
import type { Express } from 'express';
import type { CustomizationSettings } from '@shared/schema';

export const testMeta = {
  category: 'integration' as const,
  name: 'PWA Manifest endpoint',
  description:
    'The /site.webmanifest endpoint must return a valid PWA manifest and reflect the current admin-configured branding (siteName + theme color).',
  severity: 'medium' as const,
};

describe('PWA - /site.webmanifest', () => {
  let app: Express;
  let originalSettings: CustomizationSettings;

  beforeAll(async () => {
    app = await createTestApp();
    originalSettings = await storage.getCustomizationSettings();
  });

  afterAll(async () => {
    // Restore branding so test pollution doesn't leak into the live DB.
    await storage.setCustomizationSettings(originalSettings);
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
    expect(Array.isArray(manifest.categories)).toBe(true);

    // Icons: at least one 192x192 and one 512x512, plus a maskable variant
    expect(Array.isArray(manifest.icons)).toBe(true);
    const has192 = manifest.icons.some((i: any) => i.sizes === '192x192' && i.purpose === 'any');
    const has512 = manifest.icons.some((i: any) => i.sizes === '512x512' && i.purpose === 'any');
    const hasMaskable = manifest.icons.some((i: any) => i.purpose === 'maskable');
    expect(has192).toBe(true);
    expect(has512).toBe(true);
    expect(hasMaskable).toBe(true);
  });

  it('reflects custom branding from admin settings', async () => {
    // Override branding & primary color
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
});
