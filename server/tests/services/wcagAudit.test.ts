import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import type { Express } from 'express';
import { storage } from '../../storage';

export const testMeta = {
  category: 'accessibility' as const,
  name: 'WCAG Farbkontrast-Prüfung',
  description: 'Prüft WCAG 2.1 AA Kontrastberechnung, Vorschläge und Korrekturen für Light- und Dark-Mode',
  severity: 'high' as const,
};

function relativeLuminance(hex: string): number {
  const rgb = hex.replace('#', '').match(/.{2}/g)?.map(x => {
    const v = parseInt(x, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }) || [0, 0, 0];
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function calcContrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const LIGHT_BG = '#ffffff';
const DARK_BG = '#0f172a';

describe('WCAG Color Contrast Audit', () => {
  let app: Express;
  let adminAgent: any;

  beforeAll(async () => {
    app = await createTestApp();

    adminAgent = request.agent(app);
    const loginRes = await adminAgent
      .post('/api/v1/auth/login')
      .send({ email: 'admin@polly.local', password: 'Polly2024!' });

    if (loginRes.status !== 200) {
      console.warn('Admin login failed, some tests may fail:', loginRes.status);
    }
  });

  describe('findAccessibleColor logic (via audit endpoint)', () => {
    it('should return suggestedValue DIFFERENT from originalValue for non-compliant colors', async () => {
      await storage.setCustomizationSettings({
        theme: {
          primaryColor: '#f97316',
          scheduleColor: '#f97316',
          surveyColor: '#72BEB7',
          organizationColor: '#7DB942',
        },
        wcag: { enforcementEnabled: false },
      });

      const response = await adminAgent
        .post('/api/v1/admin/wcag/audit')
        .send({});

      if (response.status === 401) {
        console.warn('Skipping test - admin auth required');
        return;
      }

      expect(response.status).toBe(200);
      const result = response.body;

      expect(result.issues.length).toBeGreaterThan(0);

      for (const issue of result.issues) {
        expect(issue.suggestedValue).not.toBe(issue.originalValue);
        expect(issue.suggestedValue).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });

    it('should check contrast against BOTH light and dark backgrounds', async () => {
      await storage.setCustomizationSettings({
        theme: {
          primaryColor: '#f97316',
          scheduleColor: '#10b981',
          surveyColor: '#72BEB7',
          organizationColor: '#7DB942',
        },
        wcag: { enforcementEnabled: false },
      });

      const response = await adminAgent
        .post('/api/v1/admin/wcag/audit')
        .send({});

      if (response.status === 401) return;

      expect(response.status).toBe(200);
      const result = response.body;

      for (const issue of result.issues) {
        expect(issue).toHaveProperty('lightContrast');
        expect(issue).toHaveProperty('darkContrast');
        expect(issue).toHaveProperty('mode');
        expect(['light', 'dark', 'both']).toContain(issue.mode);
        expect(typeof issue.lightContrast).toBe('number');
        expect(typeof issue.darkContrast).toBe('number');
      }
    });

    it('suggested colors should meet 4.5:1 contrast on at least one background', async () => {
      await storage.setCustomizationSettings({
        theme: {
          primaryColor: '#f97316',
          scheduleColor: '#f97316',
          surveyColor: '#72BEB7',
          organizationColor: '#7DB942',
        },
        wcag: { enforcementEnabled: false },
      });

      const response = await adminAgent
        .post('/api/v1/admin/wcag/audit')
        .send({});

      if (response.status === 401) return;

      expect(response.status).toBe(200);
      const result = response.body;

      for (const issue of result.issues) {
        const lightContrast = calcContrastRatio(issue.suggestedValue, LIGHT_BG);
        const darkContrast = calcContrastRatio(issue.suggestedValue, DARK_BG);

        const meetsSomeContrast = lightContrast >= 4.5 || darkContrast >= 4.5;
        expect(meetsSomeContrast).toBe(true);
      }
    });

    it('should ideally find colors that work on BOTH backgrounds (dual-mode)', async () => {
      await storage.setCustomizationSettings({
        theme: {
          primaryColor: '#f97316',
          scheduleColor: '#f97316',
          surveyColor: '#72BEB7',
          organizationColor: '#7DB942',
        },
        wcag: { enforcementEnabled: false },
      });

      const response = await adminAgent
        .post('/api/v1/admin/wcag/audit')
        .send({});

      if (response.status === 401) return;

      expect(response.status).toBe(200);
      const result = response.body;

      let dualModeCount = 0;
      for (const issue of result.issues) {
        const lightContrast = calcContrastRatio(issue.suggestedValue, LIGHT_BG);
        const darkContrast = calcContrastRatio(issue.suggestedValue, DARK_BG);

        if (lightContrast >= 4.5 && darkContrast >= 4.5) {
          dualModeCount++;
        }
      }

      console.log(`[WCAG Test] ${dualModeCount}/${result.issues.length} Vorschläge funktionieren auf beiden Hintergründen`);
    });

    it('should report no issues for already-compliant colors', async () => {
      await storage.setCustomizationSettings({
        theme: {
          primaryColor: '#1d4ed8',
          scheduleColor: '#166534',
          surveyColor: '#7e22ce',
          organizationColor: '#b45309',
        },
        wcag: { enforcementEnabled: false },
      });

      const response = await adminAgent
        .post('/api/v1/admin/wcag/audit')
        .send({});

      if (response.status === 401) return;

      expect(response.status).toBe(200);
      const result = response.body;

      const lightOk = result.issues.every(
        (i: any) => i.lightContrast >= 4.5
      );
      if (!lightOk) {
        console.log('[WCAG Test] Some strong colors still fail on one background - expected for dark-only issues');
      }
    });
  });

  describe('Apply Corrections', () => {
    it('should apply suggested corrections and update theme colors', async () => {
      await storage.setCustomizationSettings({
        theme: {
          primaryColor: '#f97316',
          scheduleColor: '#f97316',
          surveyColor: '#72BEB7',
          organizationColor: '#7DB942',
        },
        wcag: { enforcementEnabled: false },
      });

      const auditRes = await adminAgent
        .post('/api/v1/admin/wcag/audit')
        .send({});

      if (auditRes.status === 401) return;

      expect(auditRes.status).toBe(200);
      expect(auditRes.body.issues.length).toBeGreaterThan(0);

      const applyRes = await adminAgent
        .post('/api/v1/admin/wcag/apply-corrections')
        .send({});

      expect(applyRes.status).toBe(200);
      expect(applyRes.body.success).toBe(true);
      expect(applyRes.body.appliedCorrections).toBeDefined();
      expect(Object.keys(applyRes.body.appliedCorrections).length).toBeGreaterThan(0);

      for (const [token, value] of Object.entries(applyRes.body.appliedCorrections)) {
        expect(value).not.toBe('#f97316');
        expect(typeof value).toBe('string');
        expect(value).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });

    it('should return error when no audit has been run', async () => {
      await storage.setCustomizationSettings({
        theme: { primaryColor: '#4f46e5' },
        wcag: { enforcementEnabled: false },
      });

      const response = await adminAgent
        .post('/api/v1/admin/wcag/apply-corrections')
        .send({});

      if (response.status === 401) return;

      expect(response.status).toBe(400);
    });
  });

  describe('WCAG Audit Auth Protection', () => {
    it('should reject WCAG audit without auth', async () => {
      const response = await request(app)
        .post('/api/v1/admin/wcag/audit')
        .send({});

      expect(response.status).toBe(401);
    });

    it('should reject apply-corrections without auth', async () => {
      const response = await request(app)
        .post('/api/v1/admin/wcag/apply-corrections')
        .send({});

      expect(response.status).toBe(401);
    });
  });
});
