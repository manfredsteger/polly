import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { SERVICE_PARTNERS, getServicePartner } from '../../../shared/servicePartners';

describe('shared/servicePartners.ts (single source of truth)', () => {
  const root = resolve(__dirname, '../../..');

  it('exposes the expected partners with all required fields', () => {
    expect(SERVICE_PARTNERS.length).toBeGreaterThanOrEqual(2);
    for (const p of SERVICE_PARTNERS) {
      expect(p.id).toMatch(/^[a-z0-9-]+$/);
      expect(p.name).toBeTruthy();
      expect(p.url).toMatch(/^https?:\/\//);
      expect(p.contactUrl).toMatch(/^https?:\/\//);
      expect(p.descriptionEn).toBeTruthy();
      expect(p.descriptionDe).toBeTruthy();
    }
  });

  it('includes GWDG and KISSKI entries', () => {
    expect(getServicePartner('gwdg')).toBeDefined();
    expect(getServicePartner('kisski')).toBeDefined();
  });

  it('every partner is referenced from README.md', () => {
    const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
    for (const p of SERVICE_PARTNERS) {
      expect(readme, `README.md must mention ${p.shortName}`).toContain(p.shortName);
      expect(readme, `README.md must link to ${p.url}`).toContain(p.url);
    }
  });

  it('AiSettingsPanel reads from shared/servicePartners (no hardcoded KISSKI URL)', () => {
    const panel = readFileSync(
      resolve(root, 'client/src/components/admin/settings/AiSettingsPanel.tsx'),
      'utf8',
    );
    expect(panel).toContain('@shared/servicePartners');
    // The hardcoded contact URL must no longer appear as a string literal.
    expect(panel).not.toMatch(/href="https:\/\/kisski\.gwdg\.de/);
  });
});
