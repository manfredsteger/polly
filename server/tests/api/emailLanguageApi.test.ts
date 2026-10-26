import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../testApp';
import { ADMIN_USERNAME, ADMIN_PASSWORD } from '../testCredentials';
import { storage } from '../../storage';
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { EmailTemplateService } from '../../services/emailTemplateService';
import { EMAIL_LANGUAGE_SETTING_KEY, resolveEmailLanguage } from '../../services/emailLanguage';
import { EMAIL_TEMPLATE_TYPES } from '@shared/schema';

export const testMeta = {
  category: 'functional' as const,
  name: 'E-Mail-Sprache Admin-API',
  description: 'Prüft Vorlagen, Fußzeile und Standardsprache pro Sprache in der Admin-API sowie die Sprachübernahme bei der Registrierung',
  severity: 'high' as const,
};

describe('Email language — admin API and registration', () => {
  let app: Express;
  let adminAgent: ReturnType<typeof request.agent>;
  let previousLanguageSetting: unknown;
  let previousEnglishFooter: unknown;
  const createdUserIds: number[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    adminAgent = request.agent(app);
    const loginRes = await adminAgent
      .post('/api/v1/auth/login')
      .send({ usernameOrEmail: ADMIN_USERNAME, password: ADMIN_PASSWORD });
    expect([200, 201]).toContain(loginRes.status);
    previousLanguageSetting = (await storage.getSetting(EMAIL_LANGUAGE_SETTING_KEY))?.value;
    previousEnglishFooter = (await storage.getSetting(EmailTemplateService.footerSettingKey('en')))?.value;
  });

  afterAll(async () => {
    for (const id of createdUserIds) {
      try { await storage.deleteUser(id); } catch { /* already gone */ }
    }
    const restore = async (key: string, value: unknown) => {
      if (value === undefined) await storage.deleteSetting(key);
      else await storage.setSetting({ key, value });
    };
    await restore(EMAIL_LANGUAGE_SETTING_KEY, previousLanguageSetting);
    await restore(EmailTemplateService.footerSettingKey('en'), previousEnglishFooter);
    await storage.resetEmailTemplate('welcome', 'en');
    await storage.resetEmailTemplate('welcome', 'de');
  });

  describe('templates per language', () => {
    it('lists the English templates with ?language=en', async () => {
      const res = await adminAgent.get('/api/v1/admin/email-templates?language=en');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(EMAIL_TEMPLATE_TYPES.length);
      const reset = res.body.find((t: { type: string }) => t.type === 'password_reset');
      expect(reset.language).toBe('en');
      expect(reset.subject).toBe(EmailTemplateService.getDefaultTemplate('password_reset', 'en').subject);
    });

    it('keeps German as the default when no language is given (existing clients)', async () => {
      const res = await adminAgent.get('/api/v1/admin/email-templates/password_reset');
      expect(res.status).toBe(200);
      expect(res.body.language).toBe('de');
      expect(res.body.subject).toBe(EmailTemplateService.getDefaultTemplate('password_reset', 'de').subject);
    });

    it('rejects unsupported languages', async () => {
      const list = await adminAgent.get('/api/v1/admin/email-templates?language=fr');
      expect(list.status).toBe(400);
      const preview = await adminAgent.post('/api/v1/admin/email-templates/welcome/preview?language=xx').send({});
      expect(preview.status).toBe(400);
    });

    it('saves and resets the English template without touching the German one', async () => {
      const save = await adminAgent
        .put('/api/v1/admin/email-templates/welcome?language=en')
        .send({ subject: 'Custom welcome', textContent: 'Welcome {{userName}}!' });
      expect(save.status).toBe(200);
      expect(save.body.language).toBe('en');

      const en = await adminAgent.get('/api/v1/admin/email-templates/welcome?language=en');
      const de = await adminAgent.get('/api/v1/admin/email-templates/welcome?language=de');
      expect(en.body.subject).toBe('Custom welcome');
      expect(en.body.isDefault).toBe(false);
      expect(de.body.isDefault).toBe(true);

      const reset = await adminAgent.post('/api/v1/admin/email-templates/welcome/reset?language=en');
      expect(reset.status).toBe(200);
      expect(reset.body.isDefault).toBe(true);
    });

    it('previews the English version of a template', async () => {
      const res = await adminAgent.post('/api/v1/admin/email-templates/vote_confirmation/preview?language=en').send({});
      expect(res.status).toBe(200);
      expect(res.body.html).toContain('lang="en"');
      expect(res.body.html).toContain('Thank you for taking part');
    });

    it('stores templates saved without a language as German (pre-existing customizations)', async () => {
      await storage.upsertEmailTemplate({
        type: 'welcome',
        name: 'Legacy',
        subject: 'Legacy subject',
        jsonContent: {},
        textContent: 'Legacy',
      } as any);
      const row = await storage.getEmailTemplate('welcome');
      expect(row?.language).toBe('de');
      expect(await storage.getEmailTemplate('welcome', 'en')).toBeUndefined();
      await storage.resetEmailTemplate('welcome', 'de');
    });

    it('enforces one customization per type and language in the database', async () => {
      const result = await db.execute(sql`
        SELECT indexdef FROM pg_indexes
        WHERE tablename = 'email_templates' AND indexname = 'email_templates_type_language_unique'
      `);
      expect(result.rows).toHaveLength(1);
    });
  });

  describe('footer per language', () => {
    it('saves an English footer separately from the German one', async () => {
      const before = await adminAgent.get('/api/v1/admin/email-footer');
      const put = await adminAgent
        .put('/api/v1/admin/email-footer?language=en')
        .send({ html: 'Sent by {{siteName}} (EN)', text: 'Sent by {{siteName}} (EN)' });
      expect(put.status).toBe(200);

      const en = await adminAgent.get('/api/v1/admin/email-footer?language=en');
      const de = await adminAgent.get('/api/v1/admin/email-footer');
      expect(en.body.text).toBe('Sent by {{siteName}} (EN)');
      expect(de.body).toEqual(before.body);
    });
  });

  describe('default email language setting', () => {
    it('requires admin rights', async () => {
      const res = await request(app).get('/api/v1/admin/email-language');
      expect(res.status).toBe(401);
      const put = await request(app).put('/api/v1/admin/email-language').send({ defaultLanguage: 'en' });
      expect(put.status).toBe(401);
    });

    it('reads and updates the default language', async () => {
      const put = await adminAgent.put('/api/v1/admin/email-language').send({ defaultLanguage: 'en' });
      expect(put.status).toBe(200);
      expect(put.body).toEqual({ defaultLanguage: 'en' });

      const get = await adminAgent.get('/api/v1/admin/email-language');
      expect(get.body).toEqual({ defaultLanguage: 'en' });

      await adminAgent.put('/api/v1/admin/email-language').send({ defaultLanguage: 'de' });
    });

    it('rejects invalid values', async () => {
      for (const body of [{ defaultLanguage: 'fr' }, {}, { defaultLanguage: 42 }]) {
        const res = await adminAgent.put('/api/v1/admin/email-language').send(body);
        expect(res.status).toBe(400);
      }
    });
  });

  describe('registration remembers the UI language', () => {
    async function register(prefix: string, language?: string) {
      const username = `${prefix}_${Date.now()}`;
      let req = request(app)
        .post('/api/v1/auth/register')
        .set('x-test-meta', JSON.stringify({ isTestData: true }));
      if (language) req = req.set('X-Polly-Language', language);
      const res = await req.send({
        username,
        email: `${username}@test.example`,
        name: 'Language Tester',
        password: 'TestPass123!',
      });
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      createdUserIds.push(res.body.user.id);
      return storage.getUser(res.body.user.id);
    }

    it('stores English when the account was created in the English UI', async () => {
      const user = await register('reg_en', 'en');
      expect(user?.languagePreference).toBe('en');
    });

    it('keeps German when no UI language is sent', async () => {
      const user = await register('reg_none');
      expect(user?.languagePreference).toBe('de');
    });

    it('follows the language the user switches to in the header menu', async () => {
      const agent = request.agent(app);
      const username = `reg_switch_${Date.now()}`;
      const email = `${username}@test.example`;
      const reg = await agent
        .post('/api/v1/auth/register')
        .set('x-test-meta', JSON.stringify({ isTestData: true }))
        .set('X-Polly-Language', 'de')
        .send({ username, email, name: 'Switcher', password: 'TestPass123!' });
      expect(reg.status).toBeLessThan(300);
      createdUserIds.push(reg.body.user.id);
      expect(await resolveEmailLanguage(email)).toBe('de');

      const toEn = await agent.patch('/api/v1/users/me/language').send({ language: 'en' });
      expect(toEn.status).toBe(200);
      // The header hint of a request must not override the saved choice.
      expect(await resolveEmailLanguage(email, 'de')).toBe('en');

      const toDe = await agent.patch('/api/v1/users/me/language').send({ language: 'de' });
      expect(toDe.status).toBe(200);
      expect(await resolveEmailLanguage(email, 'en')).toBe('de');
    });

    it('ignores unsupported UI languages', async () => {
      const user = await register('reg_fr', 'fr');
      expect(user?.languagePreference).toBe('de');
    });
  });
});
