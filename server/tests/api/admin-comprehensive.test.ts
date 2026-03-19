import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../testApp';
import type { Express } from 'express';
import { ADMIN_USERNAME, ADMIN_PASSWORD } from '../testCredentials';
import { storage } from '../../storage';

export const testMeta = {
  category: 'functional' as const,
  name: 'Admin-Funktionalität',
  description: 'Umfassende Tests aller Admin-Endpunkte mit Authentifizierung',
  severity: 'critical' as const,
};

describe('Admin API - Comprehensive Functional Tests', () => {
  let app: Express;
  let adminAgent: any;

  beforeAll(async () => {
    app = await createTestApp();
    adminAgent = request.agent(app);
    const loginRes = await adminAgent
      .post('/api/v1/auth/login')
      .send({ usernameOrEmail: ADMIN_USERNAME, password: ADMIN_PASSWORD });
    expect([200, 201]).toContain(loginRes.status);
  });

  describe('System Stats & Status', () => {
    it('should return stats', async () => {
      const res = await adminAgent.get('/api/v1/admin/stats');
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });

    it('should return extended stats', async () => {
      const res = await adminAgent.get('/api/v1/admin/extended-stats');
      expect(res.status).toBe(200);
      expect(res.body.totalUsers).toBeDefined();
    });

    it('should return system status', async () => {
      const res = await adminAgent.get('/api/v1/admin/system-status');
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });

    it('should return vulnerabilities report', async () => {
      const res = await adminAgent.get('/api/v1/admin/vulnerabilities');
      expect(res.status).toBe(200);
      expect(typeof res.body).toBe('object');
    });

    it('should return system packages', async () => {
      const res = await adminAgent.get('/api/v1/admin/system-packages');
      expect(res.status).toBe(200);
    });
  });

  describe('User Management CRUD', () => {
    let testUserId: number;
    const testUsername = `admintest_${Date.now()}`;

    it('should list users', async () => {
      const res = await adminAgent.get('/api/v1/admin/users');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should create a user', async () => {
      const res = await adminAgent.post('/api/v1/admin/users').send({
        name: 'Test Admin User',
        email: `${testUsername}@test.local`,
        username: testUsername,
        password: 'TestPass123!',
        role: 'user',
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.username).toBe(testUsername);
      testUserId = res.body.id;
    });

    it('should reject creating a user with duplicate username', async () => {
      const res = await adminAgent.post('/api/v1/admin/users').send({
        name: 'Duplicate',
        email: `dup_${Date.now()}@test.local`,
        username: testUsername,
        password: 'TestPass123!',
        role: 'user',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject creating a user with invalid role', async () => {
      const res = await adminAgent.post('/api/v1/admin/users').send({
        name: 'Bad Role',
        email: `badrole_${Date.now()}@test.local`,
        username: `badrole_${Date.now()}`,
        password: 'TestPass123!',
        role: 'superadmin',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Ungültige Rolle');
    });

    it('should reject creating a user with weak password', async () => {
      const res = await adminAgent.post('/api/v1/admin/users').send({
        name: 'Weak Pass',
        email: `weak_${Date.now()}@test.local`,
        username: `weak_${Date.now()}`,
        password: '123',
        role: 'user',
      });
      expect(res.status).toBe(400);
    });

    it('should update a user', async () => {
      const res = await adminAgent.patch(`/api/v1/admin/users/${testUserId}`).send({
        name: 'Updated Test User',
        role: 'manager',
      });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Test User');
      expect(res.body.role).toBe('manager');
    });

    it('should delete a user', async () => {
      const res = await adminAgent.delete(`/api/v1/admin/users/${testUserId}`);
      if (res.status === 403 && res.body?.code === 'MANUAL_DELETE_DISABLED') {
        expect(res.body.code).toBe('MANUAL_DELETE_DISABLED');
      } else {
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      }
    });

    it('should reject self-deletion', async () => {
      const meRes = await adminAgent.get('/api/v1/auth/me');
      const myId = meRes.body.user?.id;
      if (myId) {
        const res = await adminAgent.delete(`/api/v1/admin/users/${myId}`);
        if (res.status === 403 && res.body?.code === 'MANUAL_DELETE_DISABLED') {
          expect(res.body.code).toBe('MANUAL_DELETE_DISABLED');
        } else {
          expect(res.status).toBe(400);
        }
      }
    });
  });

  describe('Poll Management', () => {
    it('should list polls', async () => {
      const res = await adminAgent.get('/api/v1/admin/polls');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return 404 for patching non-existent poll', async () => {
      const res = await adminAgent.patch('/api/v1/admin/polls/00000000-0000-0000-0000-000000000000').send({ isActive: false });
      expect(res.status).toBe(404);
    });

    it('should return 404 for deleting non-existent poll', async () => {
      const res = await adminAgent.delete('/api/v1/admin/polls/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });

    it('should reject patch with no updates', async () => {
      const pollsRes = await adminAgent.get('/api/v1/admin/polls');
      if (pollsRes.body.length > 0) {
        const res = await adminAgent.patch(`/api/v1/admin/polls/${pollsRes.body[0].id}`).send({});
        expect(res.status).toBe(400);
      }
    });
  });

  describe('Settings CRUD', () => {
    const testKey = `test_setting_${Date.now()}`;

    it('should list settings', async () => {
      const res = await adminAgent.get('/api/v1/admin/settings');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should create a setting', async () => {
      const res = await adminAgent.post('/api/v1/admin/settings').send({
        key: testKey,
        value: { test: true },
      });
      expect(res.status).toBe(200);
    });

    it('should delete a setting', async () => {
      const res = await adminAgent.delete(`/api/v1/admin/settings/${testKey}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should verify setting was deleted', async () => {
      const res = await adminAgent.get('/api/v1/admin/settings');
      const found = res.body.find((s: any) => s.key === testKey);
      expect(found).toBeUndefined();
    });
  });

  describe('Security Settings', () => {
    it('should get security settings', async () => {
      const res = await adminAgent.get('/api/v1/admin/security');
      expect(res.status).toBe(200);
      expect(res.body.settings).toBeDefined();
    });

    it('should save security settings (round-trip)', async () => {
      const getRes = await adminAgent.get('/api/v1/admin/security');
      const settings = getRes.body.settings;
      const putRes = await adminAgent.put('/api/v1/admin/security').send(settings);
      expect(putRes.status).toBe(200);
      expect(putRes.body.success).toBe(true);
    });

    it('should clear rate limits', async () => {
      const res = await adminAgent.post('/api/v1/admin/security/clear-rate-limits').send({});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('API Rate Limits', () => {
    it('should get rate limit config', async () => {
      const res = await adminAgent.get('/api/v1/admin/api-rate-limits');
      expect(res.status).toBe(200);
    });

    it('should update rate limit config (round-trip)', async () => {
      const getRes = await adminAgent.get('/api/v1/admin/api-rate-limits');
      const putRes = await adminAgent.put('/api/v1/admin/api-rate-limits').send(getRes.body);
      expect(putRes.status).toBe(200);
    });

    it('should clear API rate limits', async () => {
      const res = await adminAgent.post('/api/v1/admin/api-rate-limits/clear').send({});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Notification Settings', () => {
    it('should get notification settings', async () => {
      const res = await adminAgent.get('/api/v1/admin/notifications');
      expect(res.status).toBe(200);
    });

    it('should save notification settings (round-trip)', async () => {
      const getRes = await adminAgent.get('/api/v1/admin/notifications');
      const putRes = await adminAgent.put('/api/v1/admin/notifications').send(getRes.body);
      expect(putRes.status).toBe(200);
    });
  });

  describe('Session Timeout Settings', () => {
    it('should get session timeout', async () => {
      const res = await adminAgent.get('/api/v1/admin/session-timeout');
      expect(res.status).toBe(200);
    });

    it('should save session timeout (round-trip)', async () => {
      const getRes = await adminAgent.get('/api/v1/admin/session-timeout');
      const putRes = await adminAgent.put('/api/v1/admin/session-timeout').send(getRes.body);
      expect(putRes.status).toBe(200);
    });
  });

  describe('Calendar Settings', () => {
    it('should get calendar settings', async () => {
      const res = await adminAgent.get('/api/v1/admin/calendar');
      expect(res.status).toBe(200);
    });

    it('should save calendar settings (round-trip)', async () => {
      const getRes = await adminAgent.get('/api/v1/admin/calendar');
      const putRes = await adminAgent.put('/api/v1/admin/calendar').send(getRes.body);
      expect(putRes.status).toBe(200);
    });
  });

  describe('Customization & Branding', () => {
    let savedCustomization: any;

    beforeAll(async () => {
      savedCustomization = await storage.getCustomizationSettings();
    });

    afterAll(async () => {
      await storage.setCustomizationSettings(savedCustomization);
    });

    it('should get customization settings', async () => {
      const res = await adminAgent.get('/api/v1/admin/customization');
      expect(res.status).toBe(200);
      expect(res.body.branding).toBeDefined();
      expect(res.body.theme).toBeDefined();
    });

    it('should save customization settings (round-trip)', async () => {
      const getRes = await adminAgent.get('/api/v1/admin/customization');
      const putRes = await adminAgent.put('/api/v1/admin/customization').send(getRes.body);
      expect(putRes.status).toBe(200);
    });

    it('should reset branding', async () => {
      const res = await adminAgent.post('/api/v1/admin/branding/reset').send({});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('WCAG Accessibility', () => {
    it('should run a WCAG audit', async () => {
      const res = await adminAgent.post('/api/v1/admin/wcag/audit').send({});
      expect(res.status).toBe(200);
      expect(res.body.runAt).toBeDefined();
    });

    it('should update WCAG settings', async () => {
      const res = await adminAgent.put('/api/v1/admin/wcag/settings').send({ autoCorrection: false });
      expect(res.status).toBe(200);
    });
  });

  describe('Email Templates', () => {
    it('should list all templates', async () => {
      const res = await adminAgent.get('/api/v1/admin/email-templates');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    const templateTypes = ['poll_created', 'invitation', 'vote_confirmation', 'reminder', 'password_reset', 'email_change', 'password_changed', 'test_report'];

    for (const type of templateTypes) {
      it(`should get template ${type}`, async () => {
        const res = await adminAgent.get(`/api/v1/admin/email-templates/${type}`);
        expect(res.status).toBe(200);
        expect(res.body.type).toBe(type);
      });

      it(`should preview template ${type}`, async () => {
        const res = await adminAgent.post(`/api/v1/admin/email-templates/${type}/preview`).send({});
        expect(res.status).toBe(200);
        expect(res.body.html).toBeDefined();
        expect(res.body.subject).toBeDefined();
      });

      it(`should get variables for ${type}`, async () => {
        const res = await adminAgent.get(`/api/v1/admin/email-templates/${type}/variables`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      });
    }

    it('should reject invalid template type', async () => {
      const res = await adminAgent.get('/api/v1/admin/email-templates/invalid_type');
      expect(res.status).toBe(400);
    });

    it('should reject preview for invalid template type', async () => {
      const res = await adminAgent.post('/api/v1/admin/email-templates/invalid_type/preview').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('Email Theme', () => {
    it('should get email theme', async () => {
      const res = await adminAgent.get('/api/v1/admin/email-theme');
      expect(res.status).toBe(200);
      expect(res.body.backdropColor).toBeDefined();
      expect(res.body.canvasColor).toBeDefined();
      expect(res.body.textColor).toBeDefined();
      expect(res.body.buttonBackgroundColor).toBeDefined();
    });

    it('should update email theme', async () => {
      const res = await adminAgent.put('/api/v1/admin/email-theme').send({
        backdropColor: '#EEEEEE',
        textColor: '#111111',
      });
      expect(res.status).toBe(200);
      expect(res.body.backdropColor).toBe('#EEEEEE');
      expect(res.body.textColor).toBe('#111111');
    });

    it('should apply theme colors in email preview', async () => {
      const previewRes = await adminAgent.post('/api/v1/admin/email-templates/poll_created/preview').send({});
      expect(previewRes.status).toBe(200);
      expect(previewRes.body.html).toBeDefined();
      expect(previewRes.body.html.length).toBeGreaterThan(100);
    });

    it('should reset email theme', async () => {
      const res = await adminAgent.post('/api/v1/admin/email-theme/reset').send({});
      expect(res.status).toBe(200);
      expect(res.body.backdropColor).toBe('#F5F5F5');
    });

    it('should import theme from JSON', async () => {
      const res = await adminAgent.post('/api/v1/admin/email-theme/import').send({
        jsonContent: {
          root: {
            type: 'EmailLayout',
            data: {
              backdropColor: '#DDDDDD',
              canvasColor: '#FAFAFA',
              textColor: '#222222',
              fontFamily: 'Arial, sans-serif',
              childrenIds: [],
            },
          },
        },
      });
      expect(res.status).toBe(200);
      expect(res.body.preview).toBeDefined();
      expect(res.body.preview.backdropColor).toBe('#DDDDDD');
    });
  });

  describe('Email Footer', () => {
    it('should get email footer', async () => {
      const res = await adminAgent.get('/api/v1/admin/email-footer');
      expect(res.status).toBe(200);
      expect(res.body.html).toBeDefined();
    });

    it('should update email footer (round-trip)', async () => {
      const getRes = await adminAgent.get('/api/v1/admin/email-footer');
      const putRes = await adminAgent.put('/api/v1/admin/email-footer').send(getRes.body);
      expect(putRes.status).toBe(200);
    });
  });

  describe('Deletion Requests', () => {
    it('should list deletion requests', async () => {
      const res = await adminAgent.get('/api/v1/admin/deletion-requests');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Deprovisioning Settings', () => {
    it('should get deprovision settings', async () => {
      const res = await adminAgent.get('/api/v1/admin/deprovision-settings');
      expect(res.status).toBe(200);
    });

    it('should save deprovision settings (round-trip)', async () => {
      const getRes = await adminAgent.get('/api/v1/admin/deprovision-settings');
      const putRes = await adminAgent.put('/api/v1/admin/deprovision-settings').send(getRes.body);
      expect(putRes.status).toBe(200);
    });
  });

  describe('ClamAV', () => {
    it('should get ClamAV config', async () => {
      const res = await adminAgent.get('/api/v1/admin/clamav');
      expect(res.status).toBe(200);
    });

    it('should get scan stats', async () => {
      const res = await adminAgent.get('/api/v1/admin/clamav/scan-stats');
      expect(res.status).toBe(200);
    });

    it('should get scan logs', async () => {
      const res = await adminAgent.get('/api/v1/admin/clamav/scan-logs');
      expect(res.status).toBe(200);
    });
  });

  describe('Pentest Tools', () => {
    it('should get pentest tools status', async () => {
      const res = await adminAgent.get('/api/v1/admin/pentest-tools/status');
      expect(res.status).toBe(200);
    });

    it('should get pentest tools config', async () => {
      const res = await adminAgent.get('/api/v1/admin/pentest-tools/config');
      expect(res.status).toBe(200);
      expect(typeof res.body.configured).toBe('boolean');
    });

    it('should get target info', async () => {
      const res = await adminAgent.get('/api/v1/admin/pentest-tools/target');
      expect(res.status).toBe(200);
    });
  });

  describe('Tests & Monitoring', () => {
    it('should get test environment', async () => {
      const res = await adminAgent.get('/api/v1/admin/tests/environment');
      expect(res.status).toBe(200);
      expect(res.body.environment).toBeDefined();
    });

    it('should list test categories', async () => {
      const res = await adminAgent.get('/api/v1/admin/tests');
      expect(res.status).toBe(200);
    });

    it('should get test runs', async () => {
      const res = await adminAgent.get('/api/v1/admin/tests/runs');
      expect(res.status).toBe(200);
    });

    it('should get test schedule', async () => {
      const res = await adminAgent.get('/api/v1/admin/tests/schedule');
      expect(res.status).toBe(200);
    });

    it('should get test configurations', async () => {
      const res = await adminAgent.get('/api/v1/admin/tests/configurations');
      expect(res.status).toBe(200);
    });

    it('should get test data stats', async () => {
      const res = await adminAgent.get('/api/v1/admin/tests/data-stats');
      expect(res.status).toBe(200);
    });

    it('should get test-runs (formatted)', async () => {
      const res = await adminAgent.get('/api/v1/admin/test-runs');
      expect(res.status).toBe(200);
    });

    it('should get current test run status', async () => {
      const res = await adminAgent.get('/api/v1/admin/test-runs/current');
      expect(res.status).toBe(200);
    });

    it('should set test mode', async () => {
      const res = await adminAgent.put('/api/v1/admin/tests/mode').send({ mode: 'manual' });
      expect(res.status).toBe(200);
    });
  });
});
