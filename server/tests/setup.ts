import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { storage } from '../storage';
import { customizationSettingsSchema } from '@shared/schema';

// Sentinel values that the pwaManifest test writes into the shared DB.
// If these appear in the live DB at test-suite startup, it means a previous
// run was interrupted before afterAll could restore the originals.
// NOTE: if someone genuinely configures siteName='Acme' or primaryColor='#123456'
// in the dev DB they must change the sentinel values here AND in pwaManifest.test.ts
// to avoid this guard replacing their real settings with schema defaults.
const TEST_SENTINEL_SITE_NAME = 'Acme';
const TEST_SENTINEL_COLOR = '#123456';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  const snapshot = await storage.getCustomizationSettings();

  // If the DB contains well-known sentinel values left by an interrupted test
  // run, reset to schema defaults before snapshotting.  Without this guard
  // the corrupted values would be saved as the "original" and restored in
  // afterAll, perpetuating the pollution across every subsequent test run.
  const isPolluted =
    snapshot.branding.siteName === TEST_SENTINEL_SITE_NAME ||
    snapshot.theme.primaryColor.toLowerCase() === TEST_SENTINEL_COLOR;

  if (isPolluted) {
    const clean = customizationSettingsSchema.parse({});
    await storage.setCustomizationSettings(clean);
    (globalThis as any).__brandingSnapshot = JSON.parse(JSON.stringify(clean));
  } else {
    (globalThis as any).__brandingSnapshot = JSON.parse(JSON.stringify(snapshot));
  }
});

afterAll(async () => {
  const snapshot = (globalThis as any).__brandingSnapshot;
  if (snapshot) {
    try {
      await storage.setCustomizationSettings(snapshot);
    } catch {
    }
  }
});

beforeEach(async () => {
});

afterEach(async () => {
});
