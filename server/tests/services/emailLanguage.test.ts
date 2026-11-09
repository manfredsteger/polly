import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import nodemailer from 'nodemailer';
import { nanoid } from 'nanoid';
import { EmailService } from '../../services/emailService';
import { emailTemplateService, EmailTemplateService } from '../../services/emailTemplateService';
import {
  resolveEmailLanguage,
  getRequestLanguage,
  getSiteDefaultLanguage,
  groupRecipientsByLanguage,
} from '../../services/emailLanguage';
import { emailStrings, formatConfirmedSlot, normalizeEmailLanguage, pollTypeLabel } from '../../services/emailI18n';
import { storage } from '../../storage';
import { EMAIL_TEMPLATE_TYPES, type User } from '@shared/schema';

export const testMeta = {
  category: 'functional' as const,
  name: 'E-Mail-Sprache (DE/EN)',
  description: 'Prüft englische E-Mail-Vorlagen, die Sprachwahl pro Empfänger und dass deutsche E-Mails unverändert bleiben',
  severity: 'high' as const,
};

// Words and characters that must never appear in an English email body.
const GERMAN_MARKERS = /\b(Sie|Ihre?|Umfrage|Abstimmung|Hallo|Stimme|Termin|Datenschutz|Uhr|und|wurde|zur|Ergebnisse|Einladung|Erinnerung|Passwort|Anmeldung)\b|[äöüßÄÖÜ]/;

function visibleText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ');
}

interface CapturedMail {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{ filename: string }>;
}

const captured: CapturedMail[] = [];
const transporter = {
  sendMail: async (options: CapturedMail) => {
    captured.push(options);
    return { messageId: 'test' };
  },
  verify: async () => true,
} as unknown as nodemailer.Transporter;

function mailTo(email: string): CapturedMail {
  const mail = captured.find((m) => m.to === email);
  expect(mail, `no mail captured for ${email}`).toBeDefined();
  return mail!;
}

const createdUsers: User[] = [];

// The site default language (Admin → Customize → Language) is the fallback for unknown recipients.
const SITE_LANGUAGE_KEY = 'customization_language';
async function setSiteDefaultLanguage(language: unknown) {
  await storage.setSetting({ key: SITE_LANGUAGE_KEY, value: { defaultLanguage: language } });
}
const uniqueGuest = (prefix: string) => `${prefix}-${nanoid(8).toLowerCase()}@test.example`;

async function createUserWithLanguage(language: 'de' | 'en'): Promise<User> {
  const id = nanoid(8).toLowerCase().replace(/[^a-z0-9]/g, 'x');
  const user = await storage.createUser({
    username: `emaillang_${language}_${id}`,
    email: `emaillang-${language}-${id}@test.example`,
    name: `Lang ${language.toUpperCase()}`,
    role: 'user',
    languagePreference: language,
    isTestData: true,
  } as any);
  createdUsers.push(user);
  return user;
}

describe('Email language (German/English)', () => {
  let service: EmailService;
  let previousLanguageSetting: unknown;
  let englishUser: User;
  let germanUser: User;

  beforeAll(async () => {
    previousLanguageSetting = (await storage.getSetting(SITE_LANGUAGE_KEY))?.value;
    await setSiteDefaultLanguage('de');
    englishUser = await createUserWithLanguage('en');
    germanUser = await createUserWithLanguage('de');
    service = new EmailService();
    service.configureForTesting(transporter);
  });

  afterAll(async () => {
    for (const user of createdUsers) {
      try { await storage.deleteUser(user.id); } catch { /* already gone */ }
    }
    if (previousLanguageSetting === undefined) {
      await storage.deleteSetting(SITE_LANGUAGE_KEY);
    } else {
      await storage.setSetting({ key: SITE_LANGUAGE_KEY, value: previousLanguageSetting });
    }
    for (const type of EMAIL_TEMPLATE_TYPES) {
      await emailTemplateService.resetTemplate(type, 'de');
      await emailTemplateService.resetTemplate(type, 'en');
    }
  });

  beforeEach(() => {
    captured.length = 0;
  });

  describe('language helpers', () => {
    it('normalizes language codes and ignores unsupported ones', () => {
      expect(normalizeEmailLanguage('en')).toBe('en');
      expect(normalizeEmailLanguage('EN-gb')).toBe('en');
      expect(normalizeEmailLanguage('de-DE')).toBe('de');
      expect(normalizeEmailLanguage('fr')).toBeUndefined();
      expect(normalizeEmailLanguage(undefined)).toBeUndefined();
    });

    it('reads the UI language only from the Polly header', () => {
      const req = (headers: Record<string, string>) => ({ get: (name: string) => headers[name.toLowerCase()] });
      expect(getRequestLanguage(req({ 'x-polly-language': 'en' }) as any)).toBe('en');
      expect(getRequestLanguage(req({ 'accept-language': 'en-US' }) as any)).toBeUndefined();
      expect(getRequestLanguage(req({ 'x-polly-language': 'xx' }) as any)).toBeUndefined();
      expect(getRequestLanguage(undefined)).toBeUndefined();
      // Minimal request objects without Express helpers still work.
      expect(getRequestLanguage({ headers: { 'x-polly-language': 'en' } } as any)).toBe('en');
      expect(getRequestLanguage({ headers: {} } as any)).toBeUndefined();
    });

    it('labels poll types per language', () => {
      expect(pollTypeLabel('schedule', 'de')).toBe('Terminumfrage');
      expect(pollTypeLabel('organization', 'de')).toBe('Orga-Liste');
      expect(pollTypeLabel('schedule', 'en')).toBe('Schedule Poll');
      expect(pollTypeLabel('survey', 'en')).toBe('Survey');
    });

    it('formats a confirmed slot with "Uhr" only in German', () => {
      const slot = { startTime: new Date(2026, 4, 12, 14, 30), endTime: new Date(2026, 4, 12, 16, 0), text: 'Slot' };
      const de = formatConfirmedSlot(slot, 'de');
      const en = formatConfirmedSlot(slot, 'en');
      expect(de.confirmedTime).toBe('14:30 \u2013 16:00 Uhr');
      expect(de.confirmedDate).toContain('Mai');
      expect(en.confirmedTime).toBe('14:30 \u2013 16:00');
      expect(en.confirmedDate).toContain('May');
      expect(formatConfirmedSlot({ startTime: null, endTime: null, text: 'Freitext' }, 'en').confirmedDate).toBe('Freitext');
    });
  });

  describe('recipient language resolution', () => {
    it('uses the language stored in a registered recipient\'s account, even if the UI hint differs', async () => {
      expect(await resolveEmailLanguage(englishUser.email, 'de')).toBe('en');
      expect(await resolveEmailLanguage(germanUser.email, 'en')).toBe('de');
    });

    it('uses the requester\'s UI language for guests without an account', async () => {
      expect(await resolveEmailLanguage('guest-unknown@test.example', 'en')).toBe('en');
    });

    it('falls back to the site default language for unknown recipients', async () => {
      const unknown = uniqueGuest('guest-unknown');
      expect(await resolveEmailLanguage(unknown)).toBe('de');
      await setSiteDefaultLanguage('en');
      try {
        expect(await resolveEmailLanguage(unknown)).toBe('en');
        // A registered German user is not affected by the site default.
        expect(await resolveEmailLanguage(germanUser.email)).toBe('de');
        // The requester's own UI language still wins for mails to the requester.
        expect(await resolveEmailLanguage(unknown, 'de')).toBe('de');
      } finally {
        await setSiteDefaultLanguage('de');
      }
    });

    it('treats a missing or broken site language as English (the schema default)', async () => {
      try {
        await setSiteDefaultLanguage('fr');
        expect(await getSiteDefaultLanguage()).toBe('en');
        await storage.deleteSetting(SITE_LANGUAGE_KEY);
        expect(await getSiteDefaultLanguage()).toBe('en');
      } finally {
        await setSiteDefaultLanguage('de');
      }
    });

    it('uses whichever of several addresses belongs to an account', async () => {
      expect(await resolveEmailLanguage(['new-address@test.example', englishUser.email])).toBe('en');
    });

    it('groups mixed recipients by language', async () => {
      const groups = await groupRecipientsByLanguage(
        [englishUser.email, 'guest-a@test.example', germanUser.email],
        (email) => email,
      );
      expect(groups.get('en')).toEqual([englishUser.email]);
      expect(groups.get('de')).toEqual(['guest-a@test.example', germanUser.email]);
    });
  });

  describe('English templates', () => {
    it.each(EMAIL_TEMPLATE_TYPES)('renders %s in English without German text', async (type) => {
      const vars = await EmailTemplateService.getSampleDataForType(type, 'en');
      for (const extra of [{}, { isRegisteredUser: 'true', resultsPublic: 'false', voteManagementAction: 'withdraw', selectedOptionsHtml: '<ul><li>Option A</li></ul>' }]) {
        const rendered = await emailTemplateService.renderEmail(type, { ...vars, ...extra }, 'en');
        expect(rendered.html).toContain('lang="en"');
        expect(rendered.subject).not.toMatch(GERMAN_MARKERS);
        expect(visibleText(rendered.html)).not.toMatch(GERMAN_MARKERS);
        expect(rendered.text).not.toMatch(GERMAN_MARKERS);
      }
    });

    it('has an English default template for every type', () => {
      for (const type of EMAIL_TEMPLATE_TYPES) {
        const en = EmailTemplateService.getDefaultTemplate(type, 'en');
        const de = EmailTemplateService.getDefaultTemplate(type, 'de');
        expect(en.textContent).not.toBe(de.textContent);
        expect(en.subject).not.toMatch(GERMAN_MARKERS);
        expect(en.textContent).not.toMatch(GERMAN_MARKERS);
      }
    });

    it('still escapes HTML in user content in English mails', async () => {
      const rendered = await emailTemplateService.renderEmail('invitation', {
        pollTitle: '<script>alert(1)</script>',
        inviterName: '<img src=x onerror=alert(1)>',
        publicLink: 'https://polly.example.com/poll/abc',
        message: '',
      }, 'en');
      expect(rendered.html).not.toContain('<script>alert(1)</script>');
      expect(rendered.html).not.toContain('<img src=x onerror');
    });

    it('uses an English default footer', async () => {
      const footer = await emailTemplateService.getEmailFooter('en');
      expect(footer.text).toContain('This email was sent automatically');
      const rendered = await emailTemplateService.renderEmail('password_changed', { userName: 'Ann' }, 'en');
      expect(rendered.text).toContain('This email was sent automatically');
      expect(rendered.text).not.toContain('Diese E-Mail wurde automatisch');
    });
  });

  describe('German output stays unchanged (regression)', () => {
    it('renders German when no language is passed', async () => {
      const vars = await EmailTemplateService.getSampleDataForType('vote_confirmation', 'de');
      const implicit = await emailTemplateService.renderEmail('vote_confirmation', vars);
      const explicit = await emailTemplateService.renderEmail('vote_confirmation', vars, 'de');
      expect(implicit).toEqual(explicit);
      expect(explicit.html).toContain('lang="de"');
      expect(explicit.html).toContain('Vielen Dank f\u00FCr Ihre Teilnahme!');
    });

    it('keeps the German default subjects and footer', async () => {
      expect(EmailTemplateService.getDefaultTemplate('poll_created').subject).toBe(EmailTemplateService.getDefaultTemplate('poll_created', 'de').subject);
      const footer = await emailTemplateService.getEmailFooter('de');
      expect(footer.text).toContain('Diese E-Mail wurde automatisch');
    });

    it('sends German mails with German date formats and attachment names', async () => {
      await service.sendFinalizationEmails(
        [germanUser.email],
        'Teamtreffen',
        { startTime: new Date(2026, 4, 12, 14, 30), endTime: null, text: 'Slot' },
        'https://polly.example.com/poll/abc',
        Buffer.from('ics'),
      );
      const mail = mailTo(germanUser.email);
      expect(mail.text).toContain('14:30 Uhr');
      expect(mail.text).toContain('Mai');
      expect(mail.attachments?.[0].filename).toBe('termin.ics');
    });
  });

  describe('custom templates are kept per language', () => {
    it('does not apply a German customization to English mails', async () => {
      await emailTemplateService.saveTemplate(
        'password_changed',
        {},
        'EIGENER BETREFF',
        undefined,
        'Eigener deutscher Text {{userName}}',
        'de',
      );
      const de = await emailTemplateService.renderEmail('password_changed', { userName: 'Ann' }, 'de');
      const en = await emailTemplateService.renderEmail('password_changed', { userName: 'Ann' }, 'en');
      expect(de.subject).toBe('EIGENER BETREFF');
      expect(en.subject).not.toBe('EIGENER BETREFF');
      expect(en.subject).toContain('Your password has been changed');
      expect(en.text).not.toContain('Eigener deutscher Text');
    });

    it('resetting the English template leaves the German customization in place', async () => {
      await emailTemplateService.saveTemplate('password_changed', {}, 'CUSTOM SUBJECT', undefined, 'Custom English text', 'en');
      expect((await emailTemplateService.getTemplate('password_changed', 'en')).subject).toBe('CUSTOM SUBJECT');

      await emailTemplateService.resetTemplate('password_changed', 'en');
      expect((await emailTemplateService.getTemplate('password_changed', 'en')).isDefault).toBe(true);
      expect((await emailTemplateService.getTemplate('password_changed', 'de')).subject).toBe('EIGENER BETREFF');

      await emailTemplateService.resetTemplate('password_changed', 'de');
    });

    it('lists templates for one language only', async () => {
      const en = await emailTemplateService.getAllTemplates('en');
      expect(en).toHaveLength(EMAIL_TEMPLATE_TYPES.length);
      expect(en.every((t) => t.language === 'en')).toBe(true);
    });
  });

  describe('sending per recipient language', () => {
    it('sends the vote confirmation in the guest\'s UI language', async () => {
      await service.sendVotingConfirmationEmail(
        'guest-voter@test.example', 'Guest', 'Summer party', 'survey',
        'https://polly.example.com/poll/abc', undefined, ['Option A'], undefined, false, 'en',
      );
      const mail = mailTo('guest-voter@test.example');
      expect(mail.subject).not.toMatch(GERMAN_MARKERS);
      expect(mail.text).toContain('Thank you for taking part');
    });

    it('ignores the UI hint for a registered user with a German account', async () => {
      await service.sendVotingConfirmationEmail(
        germanUser.email, 'Ger', 'Sommerfest', 'survey',
        'https://polly.example.com/poll/abc', undefined, ['Option A'], undefined, false, 'en',
      );
      expect(mailTo(germanUser.email).text).toContain('Vielen Dank f\u00FCr Ihre Teilnahme');
    });

    it('renders each recipient of a bulk mail in their own language', async () => {
      const result = await service.sendPollEndedEmails(
        [englishUser.email, germanUser.email, 'guest-bulk@test.example'],
        'Results', 'https://polly.example.com/poll/abc', true, 'organization', undefined,
        [{ text: 'Slot 1', filled: 2, total: 5 }],
      );
      expect(result).toEqual({ sent: 3, failed: 0 });
      const en = mailTo(englishUser.email);
      const de = mailTo(germanUser.email);
      const guest = mailTo('guest-bulk@test.example');
      expect(visibleText(en.html)).toContain('taken');
      expect(visibleText(en.html)).not.toMatch(GERMAN_MARKERS);
      expect(visibleText(de.html)).toContain('belegt');
      expect(visibleText(guest.html)).toContain('belegt');
    });

    it('sends finalization mails with English dates and attachment name', async () => {
      await service.sendFinalizationEmails(
        [englishUser.email],
        'Team meeting',
        { startTime: new Date(2026, 4, 12, 14, 30), endTime: new Date(2026, 4, 12, 16, 0), text: 'Slot' },
        'https://polly.example.com/poll/abc',
        Buffer.from('ics'),
        'https://meet.example.com/room',
      );
      const mail = mailTo(englishUser.email);
      expect(mail.text).toContain('May');
      expect(mail.text).not.toContain('Uhr');
      expect(visibleText(mail.html)).toContain('Video conference:');
      expect(mail.attachments?.[0].filename).toBe('appointment.ics');
    });

    it('sends the organization sign-up confirmation in each person\'s language', async () => {
      await service.sendOrgConfirmationEmails(
        'Helpers', 'https://polly.example.com/poll/abc',
        [{ id: 1, text: 'Morning' }],
        [{ optionId: 1, voterEmail: englishUser.email, voterName: 'Eng', response: 'yes' }],
        germanUser.email,
      );
      expect(visibleText(mailTo(englishUser.email).html)).toContain('Sign-up confirmed');
      expect(visibleText(mailTo(germanUser.email).html)).toContain('Anmelde\u00FCbersicht');
    });

    it('localizes the hand-built security alerts', async () => {
      await service.sendVirusDetectionAlert([englishUser.email, germanUser.email], {
        filename: 'evil<x>.png', fileSize: 2048, virusName: 'Eicar-Test', uploaderEmail: null, requestIp: null, scannedAt: new Date(),
      });
      const en = mailTo(englishUser.email);
      const de = mailTo(germanUser.email);
      expect(en.subject).toBe('[Polly Security Alert] Virus detected: Eicar-Test');
      expect(visibleText(en.html)).toContain('Anonymous / unknown');
      expect(en.html).not.toContain('evil<x>');
      expect(de.subject).toBe('[Polly Security Alert] Virus erkannt: Eicar-Test');
    });

    it('localizes the deletion request notification', async () => {
      await service.sendDeletionRequestNotification([englishUser.email], 'Some <b>User</b>', 'user@test.example', 'https://polly.example.com/admin');
      const mail = mailTo(englishUser.email);
      expect(mail.subject).toBe('New account deletion request');
      expect(mail.html).not.toContain('<b>User</b>');
      expect(visibleText(mail.html)).not.toMatch(GERMAN_MARKERS);
    });

    it('localizes the test report including the failed-test summary', async () => {
      await service.sendTestReportEmail(englishUser.email, {
        id: 9, status: 'completed', triggeredBy: 'manual', totalTests: 2, passed: 1, failed: 1, skipped: 0,
        duration: 3000, startedAt: new Date(), completedAt: new Date(),
      }, Buffer.from('pdf'), [{
        testFile: 'a.test.ts', testName: 'fails', category: 'unit', status: 'failed', duration: 1, error: 'boom', errorStack: null,
      }]);
      const mail = mailTo(englishUser.email);
      expect(mail.text).toContain('Failed tests (1)');
      expect(mail.text).toContain('3 seconds');
      expect(mail.attachments?.[0].filename).toBe('test-report-9.pdf');
      expect(mail.text).not.toMatch(GERMAN_MARKERS);
    });

    it('fills in a localized "someone" when the poll has no named owner', async () => {
      await service.sendReminderEmail(englishUser.email, '', 'Picnic', 'https://polly.example.com/poll/abc');
      await service.sendReminderEmail(germanUser.email, '', 'Picknick', 'https://polly.example.com/poll/abc');
      await service.sendInvitationEmail('invitee-unknown@test.example', '', 'Picknick', 'https://polly.example.com/poll/abc');
      expect(mailTo(englishUser.email).text).toContain('Someone');
      expect(mailTo(englishUser.email).text).not.toContain('Jemand');
      expect(mailTo(germanUser.email).text).toContain('Jemand');
      expect(mailTo('invitee-unknown@test.example').text).toContain('Jemand');
    });

    it('uses English strings from the dictionary for withdrawal mails', async () => {
      await service.sendVoteWithdrawalEmail('guest-withdraw@test.example', 'Ann', 'Picnic', 'https://polly.example.com/poll/abc', false, 'en');
      const mail = mailTo('guest-withdraw@test.example');
      expect(mail.subject).toBe(emailStrings('en').withdrawal.subjectVoter('Picnic'));
    });

    it('does not use the voter\'s UI hint for the organizer\'s withdrawal notice', async () => {
      await service.sendVoteWithdrawalEmail('organizer-unknown@test.example', 'Ann', 'Picknick', 'https://polly.example.com/admin/abc', true, 'en');
      const mail = mailTo('organizer-unknown@test.example');
      expect(mail.subject).toBe(emailStrings('de').withdrawal.subjectOrganizer('Picknick'));
    });
  });
});
