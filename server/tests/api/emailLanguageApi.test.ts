import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../testApp';
import { ADMIN_USERNAME, ADMIN_PASSWORD } from '../testCredentials';
import { storage } from '../../storage';
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { EmailTemplateService } from '../../services/emailTemplateService';
import { resolveEmailLanguage } from '../../services/emailLanguage';
import { EMAIL_TEMPLATE_TYPES } from '@shared/schema';
import { getSubmittedVoteToken } from '../fixtures/voteToken';

export const testMeta = {
  category: 'functional' as const,
  name: 'E-Mail-Sprache Admin-API',
  description: 'Prüft Vorlagen und Fußzeile pro Sprache in der Admin-API, die Sprache neuer Konten und dass sich Polly die Sprache von Gästen merkt',
  severity: 'high' as const,
};

const SITE_LANGUAGE_KEY = 'customization_language';

async function setSiteDefaultLanguage(language: 'de' | 'en') {
  await storage.setSetting({ key: SITE_LANGUAGE_KEY, value: { defaultLanguage: language } });
}

describe('Email language — admin API and registration', () => {
  let app: Express;
  let adminAgent: ReturnType<typeof request.agent>;
  let previousLanguageSetting: unknown;
  let previousEnglishFooter: unknown;
  const createdUserIds: number[] = [];
  const createdPollIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    adminAgent = request.agent(app);
    const loginRes = await adminAgent
      .post('/api/v1/auth/login')
      .send({ usernameOrEmail: ADMIN_USERNAME, password: ADMIN_PASSWORD });
    expect([200, 201]).toContain(loginRes.status);
    previousLanguageSetting = (await storage.getSetting(SITE_LANGUAGE_KEY))?.value;
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
    await restore(SITE_LANGUAGE_KEY, previousLanguageSetting);
    for (const id of createdPollIds) {
      try { await storage.deletePoll(id); } catch { /* already gone */ }
    }
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

    it('saves a layout without blocks instead of returning a server error', async () => {
      const save = await adminAgent
        .put('/api/v1/admin/email-templates/welcome?language=en')
        .send({ subject: 'Empty layout', jsonContent: { root: { type: 'EmailLayout', data: {} } } });
      expect(save.status).toBe(200);
      expect(save.body.subject).toBe('Empty layout');
      expect(save.body.textContent).toBe(EmailTemplateService.getDefaultTemplate('welcome', 'en').textContent);

      const reset = await adminAgent.post('/api/v1/admin/email-templates/welcome/reset?language=en');
      expect(reset.status).toBe(200);
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

  describe('one site default language, no separate email default', () => {
    it('no longer offers an email-specific default language endpoint', async () => {
      const get = await adminAgent.get('/api/v1/admin/email-language');
      expect(get.status).toBe(404);
      const put = await adminAgent.put('/api/v1/admin/email-language').send({ defaultLanguage: 'en' });
      expect(put.status).toBe(404);
    });

    it('sends mail to unknown recipients in the site default language (Customize → Language)', async () => {
      const unknown = `nobody_${Date.now()}@test.example`;
      await setSiteDefaultLanguage('en');
      expect(await resolveEmailLanguage(unknown)).toBe('en');
      await setSiteDefaultLanguage('de');
      expect(await resolveEmailLanguage(unknown)).toBe('de');
    });

    it('starts accounts created by an admin in the site default language', async () => {
      await setSiteDefaultLanguage('en');
      const username = `admin_created_${Date.now()}`;
      const res = await adminAgent.post('/api/v1/admin/users').send({
        name: 'Admin Created',
        email: `${username}@test.example`,
        username,
        password: 'TestPass123!',
      });
      expect(res.status).toBe(201);
      createdUserIds.push(res.body.id);
      expect((await storage.getUser(res.body.id))?.languagePreference).toBe('en');
    });

    it('keeps an explicitly given account language', async () => {
      await setSiteDefaultLanguage('en');
      const username = `explicit_lang_${Date.now()}`;
      const user = await storage.createUser({
        username,
        email: `${username}@test.example`,
        name: 'Explicit',
        role: 'user',
        languagePreference: 'de',
        isTestData: true,
      } as any);
      createdUserIds.push(user.id);
      expect(user.languagePreference).toBe('de');
    });
  });

  describe('remembers the language of guests for later mails', () => {
    it('uses the UI language a guest created a poll in for later organizer mails', async () => {
      await setSiteDefaultLanguage('de');
      const creatorEmail = `guest_creator_${Date.now()}@test.example`;
      const res = await request(app)
        .post('/api/v1/polls')
        .set('X-Polly-Language', 'en')
        .send({
          title: 'Guest language poll',
          type: 'schedule',
          creatorEmail,
          options: [{ text: 'Monday 10am' }, { text: 'Tuesday 2pm' }],
        });
      expect(res.status).toBe(200);
      createdPollIds.push(res.body.poll.id);
      expect((await storage.getPoll(res.body.poll.id))?.creatorLanguage).toBe('en');
      // Later mail to the organizer (e.g. a new vote) has no requester hint for them.
      expect(await resolveEmailLanguage(creatorEmail)).toBe('en');
    });

    it('uses the UI language a guest voted in, and follows when they edit their vote in another language', async () => {
      await setSiteDefaultLanguage('de');
      const poll = await adminAgent.post('/api/v1/polls').send({
        title: 'Guest voter language poll',
        type: 'schedule',
        allowVoteEdit: true,
        options: [{ text: 'Slot A' }, { text: 'Slot B' }],
      });
      expect(poll.status).toBe(200);
      createdPollIds.push(poll.body.poll.id);
      const optionId = poll.body.poll.options[0].id;
      const voterEmail = `guest_voter_${Date.now()}@test.example`;

      const first = await request(app)
        .post(`/api/v1/polls/${poll.body.publicToken}/vote`)
        .set('X-Polly-Language', 'en')
        .send({ voterName: 'Guest', voterEmail, votes: [{ optionId, response: 'yes' }] });
      expect(first.status).toBe(200);
      expect(await resolveEmailLanguage(voterEmail)).toBe('en');

      // The guest edits their vote later while using the German UI.
      const editToken = await getSubmittedVoteToken(first);
      expect(editToken).toBeTruthy();
      const second = await request(app)
        .put(`/api/v1/votes/edit/${editToken}`)
        .set('X-Polly-Language', 'de')
        .send({ votes: [{ optionId, response: 'no' }] });
      expect(second.status).toBe(200);
      expect(await resolveEmailLanguage(voterEmail)).toBe('de');
    });

    it('lets a registered account language win over a remembered guest language', async () => {
      const username = `guest_then_user_${Date.now()}`;
      const email = `${username}@test.example`;
      const res = await request(app)
        .post('/api/v1/polls')
        .set('X-Polly-Language', 'en')
        .send({ title: 'Before registering', type: 'survey', creatorEmail: email, options: [{ text: 'A' }, { text: 'B' }] });
      expect(res.status).toBe(200);
      createdPollIds.push(res.body.poll.id);
      const user = await storage.createUser({
        username, email, name: 'Now registered', role: 'user', languagePreference: 'de', isTestData: true,
      } as any);
      createdUserIds.push(user.id);
      expect(await resolveEmailLanguage(email)).toBe('de');
    });

    it('does not remember anything when the client sent no language', async () => {
      await setSiteDefaultLanguage('en');
      const creatorEmail = `guest_nolang_${Date.now()}@test.example`;
      const res = await request(app)
        .post('/api/v1/polls')
        .send({ title: 'No language', type: 'survey', creatorEmail, options: [{ text: 'A' }, { text: 'B' }] });
      expect(res.status).toBe(200);
      createdPollIds.push(res.body.poll.id);
      expect((await storage.getPoll(res.body.poll.id))?.creatorLanguage).toBeNull();
      expect(await resolveEmailLanguage(creatorEmail)).toBe('en');
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

    it('uses the site default language when no UI language is sent', async () => {
      await setSiteDefaultLanguage('en');
      expect((await register('reg_none_en'))?.languagePreference).toBe('en');
      await setSiteDefaultLanguage('de');
      expect((await register('reg_none_de'))?.languagePreference).toBe('de');
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
