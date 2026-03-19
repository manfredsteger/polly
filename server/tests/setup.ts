import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { storage } from '../storage';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  const snapshot = await storage.getCustomizationSettings();
  (globalThis as any).__brandingSnapshot = JSON.parse(JSON.stringify(snapshot));
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
