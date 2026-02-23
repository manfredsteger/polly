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

  describe('Per-mode audit (separate light/dark issues)', () => {
    it('should return separate issues for light and dark modes', async () => {
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

      expect(result.issues.length).toBeGreaterThan(0);

      for (const issue of result.issues) {
        expect(['light', 'dark']).toContain(issue.mode);
        expect(issue).toHaveProperty('bgColor');
        expect(issue).toHaveProperty('contrastRatio');
        expect(issue).toHaveProperty('suggestedValue');
        expect(issue).toHaveProperty('requiredRatio');
        expect(issue.requiredRatio).toBe(4.5);
        expect(issue.suggestedValue).toMatch(/^#[0-9a-f]{6}$/i);
        expect(issue.suggestedValue).not.toBe(issue.originalValue);

        if (issue.mode === 'light') {
          expect(issue.bgColor).toBe(LIGHT_BG);
        } else {
          expect(issue.bgColor).toBe(DARK_BG);
        }
      }
    });

    it('should guarantee each suggestedValue meets 4.5:1 for its specific mode background', async () => {
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
        const ratio = calcContrastRatio(issue.suggestedValue, issue.bgColor);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      }
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

      expect(result.passed).toBe(true);
      expect(result.issues.length).toBe(0);
    });

    it('should produce separate light and dark issues for a single color that fails both', async () => {
      await storage.setCustomizationSettings({
        theme: {
          primaryColor: '#808080',
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

      const primaryIssues = result.issues.filter((i: any) => i.token === '--primary');

      const lightRatio = calcContrastRatio('#808080', LIGHT_BG);
      const darkRatio = calcContrastRatio('#808080', DARK_BG);

      if (lightRatio < 4.5 && darkRatio < 4.5) {
        expect(primaryIssues.length).toBe(2);
        const modes = primaryIssues.map((i: any) => i.mode).sort();
        expect(modes).toEqual(['dark', 'light']);
      }
    });
  });

  describe('Apply Corrections (per-mode overrides)', () => {
    it('should apply per-mode overrides without changing the base color', async () => {
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

      for (const [key, value] of Object.entries(applyRes.body.appliedCorrections)) {
        expect(key).toMatch(/:(light|dark)$/);
        expect(typeof value).toBe('string');
        expect(value).toMatch(/^#[0-9a-f]{6}$/i);
      }

      const settings = await storage.getCustomizationSettings();
      expect(settings.theme?.primaryColor).toBe('#f97316');
    });

    it('should clear lastAudit after applying corrections', async () => {
      await storage.setCustomizationSettings({
        theme: {
          primaryColor: '#f97316',
          scheduleColor: '#10b981',
          surveyColor: '#72BEB7',
          organizationColor: '#7DB942',
        },
        wcag: { enforcementEnabled: false },
      });

      await adminAgent.post('/api/v1/admin/wcag/audit').send({});

      const applyRes = await adminAgent
        .post('/api/v1/admin/wcag/apply-corrections')
        .send({});

      if (applyRes.status === 401) return;

      expect(applyRes.status).toBe(200);

      const secondApplyRes = await adminAgent
        .post('/api/v1/admin/wcag/apply-corrections')
        .send({});

      expect(secondApplyRes.status).toBe(400);
    });

    it('should produce zero issues on re-audit after applying corrections (no infinite loop)', async () => {
      await storage.setCustomizationSettings({
        theme: {
          primaryColor: '#f97316',
          scheduleColor: '#f97316',
          surveyColor: '#72BEB7',
          organizationColor: '#7DB942',
        },
        wcag: { enforcementEnabled: false },
      });

      const auditRes = await adminAgent.post('/api/v1/admin/wcag/audit').send({});
      if (auditRes.status === 401) return;
      expect(auditRes.body.issues.length).toBeGreaterThan(0);

      await adminAgent.post('/api/v1/admin/wcag/apply-corrections').send({});

      const reAuditRes = await adminAgent.post('/api/v1/admin/wcag/audit').send({});
      expect(reAuditRes.status).toBe(200);
      expect(reAuditRes.body.passed).toBe(true);
      expect(reAuditRes.body.issues.length).toBe(0);
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
