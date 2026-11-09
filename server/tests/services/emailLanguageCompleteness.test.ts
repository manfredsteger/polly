import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import nodemailer from 'nodemailer';
import { nanoid } from 'nanoid';
import { EmailService } from '../../services/emailService';
import { EmailTemplateService, emailTemplateService } from '../../services/emailTemplateService';
import { emailStrings, DEFAULT_EMAIL_FOOTERS, pollTypeLabel } from '../../services/emailI18n';
import { getVoteEmailSummary } from '../../routes/votes';
import { storage } from '../../storage';
import { EMAIL_LANGUAGES, EMAIL_TEMPLATE_TYPES, type EmailLanguage, type User } from '@shared/schema';

export const testMeta = {
  category: 'functional' as const,
  name: 'E-Mail-Sprachen: Vollständigkeit',
  description: 'Prüft für jede unterstützte Sprache, dass alle E-Mail-Texte, Vorlagen und handgebauten E-Mails vollständig sind und keine Reste einer anderen Sprache enthalten',
  severity: 'high' as const,
};

/**
 * Typical words of each language. A mail in one language must not contain the
 * markers of any other language. When a new language is added to
 * EMAIL_LANGUAGES, it needs an entry here — the first test fails until then.
 */
const LANGUAGE_MARKERS: Record<string, RegExp> = {
  de: /\b(Sie|Ihre?|Umfrage|Abstimmung|Hallo|Stimme|Termin|Datenschutz|Uhr|und|wurde|zur|Ergebnisse|Einladung|Erinnerung|Passwort|Anmeldung|Jemand|Ja|Nein|Vielleicht|Sekunden|Minuten|Fehlgeschlagen|Bestanden)\b|[äöüßÄÖÜ]/,
  en: /\b(the|your|you|please|Please|has been|have been|with|from|this|This|click|Hello|Hi|Someone|Anonymous|unknown|seconds?|minutes?|Yes|No|Maybe|vote|poll|Privacy)\b/,
};

function foreignMarkers(lang: EmailLanguage): Array<[string, RegExp]> {
  return EMAIL_LANGUAGES.filter((other) => other !== lang).map((other) => [other, LANGUAGE_MARKERS[other]]);
}

function expectOnlyLanguage(content: string, lang: EmailLanguage, where: string) {
  for (const [other, markers] of foreignMarkers(lang)) {
    const match = content.match(markers);
    expect(match?.[0], `${where} (${lang}) contains "${match?.[0]}" from ${other}: …${content.slice(Math.max(0, (match?.index ?? 0) - 40), (match?.index ?? 0) + 40)}…`).toBeUndefined();
  }
}

function visibleText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    // URLs are technical, not language.
    .replace(/https?:\/\/\S+/g, ' ');
}

/** All leaf paths of a dictionary with their values (functions and strings). */
function leaves(value: unknown, path = ''): Array<[string, unknown]> {
  if (value && typeof value === 'object' && !(value instanceof RegExp)) {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key));
  }
  return [[path, value]];
}

function describeLeaf(value: unknown): string {
  return value instanceof RegExp ? 'regexp' : typeof value;
}

// Neutral sample arguments: names/titles that belong to no language.
const NEUTRAL = 'Q4';

interface CapturedMail { to: string; subject: string; html: string; text: string }
const captured: CapturedMail[] = [];
const transporter = {
  sendMail: async (options: CapturedMail) => { captured.push(options); return { messageId: 'test' }; },
  verify: async () => true,
} as unknown as nodemailer.Transporter;

describe('Email languages — completeness for every language', () => {
  const users = {} as Record<EmailLanguage, User>;
  let service: EmailService;

  beforeAll(async () => {
    for (const lang of EMAIL_LANGUAGES) {
      const id = nanoid(8).toLowerCase().replace(/[^a-z0-9]/g, 'x');
      users[lang] = await storage.createUser({
        username: `complete_${lang}_${id}`,
        email: `complete-${lang}-${id}@test.example`,
        name: 'Alex',
        role: 'user',
        languagePreference: lang,
        isTestData: true,
      } as any);
    }
    service = new EmailService();
    service.configureForTesting(transporter);
  });

  afterAll(async () => {
    for (const user of Object.values(users)) {
      try { await storage.deleteUser(user.id); } catch { /* already gone */ }
    }
  });

  beforeEach(() => { captured.length = 0; });

  function checkMail(mail: CapturedMail, lang: EmailLanguage, where: string) {
    expectOnlyLanguage(mail.subject, lang, `${where} subject`);
    expectOnlyLanguage(visibleText(mail.html), lang, `${where} html`);
    expectOnlyLanguage(mail.text.replace(/https?:\/\/\S+/g, ' '), lang, `${where} text`);
  }

  it('has language markers for every supported language', () => {
    for (const lang of EMAIL_LANGUAGES) {
      expect(LANGUAGE_MARKERS[lang], `add typical words for "${lang}" to LANGUAGE_MARKERS`).toBeInstanceOf(RegExp);
    }
  });

  describe.each(EMAIL_LANGUAGES.map((lang) => [lang]))('%s', (lang) => {
    it('has every dictionary entry the German dictionary has, with the same kind of value', () => {
      const reference = new Map(leaves(emailStrings('de')).map(([path, value]) => [path, describeLeaf(value)]));
      const actual = new Map(leaves(emailStrings(lang)).map(([path, value]) => [path, describeLeaf(value)]));
      expect([...actual.keys()].sort()).toEqual([...reference.keys()].sort());
      for (const [path, kind] of reference) {
        expect(actual.get(path), path).toBe(kind);
      }
    });

    it('has no empty texts and no foreign words in its dictionary', () => {
      for (const [path, value] of leaves(emailStrings(lang))) {
        if (typeof value === 'string') {
          expect(value.trim(), path).not.toBe('');
          expectOnlyLanguage(value, lang, `dictionary ${path}`);
        } else if (typeof value === 'function') {
          const result = (value as (...args: unknown[]) => unknown)(NEUTRAL, NEUTRAL, NEUTRAL, NEUTRAL);
          if (typeof result === 'string') expectOnlyLanguage(result, lang, `dictionary ${path}()`);
        }
      }
    });

    it('has a default template for every email type with the same placeholders as German', () => {
      const placeholders = (text: string) => [...new Set(text.match(/\{\{\s*[\w.]+\s*\}\}/g) ?? [])].sort();
      for (const type of EMAIL_TEMPLATE_TYPES) {
        const reference = EmailTemplateService.getDefaultTemplate(type, 'de');
        const template = EmailTemplateService.getDefaultTemplate(type, lang);
        expect(template.subject.trim(), `${type} subject`).not.toBe('');
        expect(placeholders(template.subject), `${type} subject placeholders`).toEqual(placeholders(reference.subject));
        expect(placeholders(template.textContent ?? ''), `${type} text placeholders`).toEqual(placeholders(reference.textContent ?? ''));
        expect(template.variables.map((v) => v.key).sort(), `${type} variables`).toEqual(reference.variables.map((v) => v.key).sort());
      }
    });

    it('renders every template type without foreign words', async () => {
      for (const type of EMAIL_TEMPLATE_TYPES) {
        const sample = await EmailTemplateService.getSampleDataForType(type, lang);
        const rendered = await emailTemplateService.renderEmail(type, sample, lang);
        checkMail({ to: '', ...rendered }, lang, `template ${type}`);
      }
    });

    it('has a default footer and poll type labels in this language', () => {
      expect(DEFAULT_EMAIL_FOOTERS[lang]?.trim()).toBeTruthy();
      expectOnlyLanguage(DEFAULT_EMAIL_FOOTERS[lang], lang, 'footer');
      for (const type of ['schedule', 'survey', 'organization']) {
        expectOnlyLanguage(pollTypeLabel(type, lang), lang, `poll type ${type}`);
      }
    });

    it('labels the vote summary (yes/maybe/no) in this language', () => {
      const summary = getVoteEmailSummary(
        { type: 'schedule', responseMode: 'classic', options: [{ id: 1, text: '10:00' }, { id: 2, text: '11:00' }, { id: 3, text: '12:00' }] },
        [{ optionId: 1, response: 'yes' }, { optionId: 2, response: 'maybe' }, { optionId: 3, response: 'no' }],
        lang,
      );
      expect(summary).toHaveLength(3);
      for (const line of summary!) expectOnlyLanguage(line, lang, 'vote summary');
    });

    it('sends every hand-built and per-recipient mail without foreign words', async () => {
      const user = users[lang];
      const link = 'https://polly.example.com/poll/abc';
      const sends: Array<[string, () => Promise<unknown>]> = [
        ['poll created (guest)', () => service.sendPollCreationEmails(user.email, NEUTRAL, link, link, 'schedule', false)],
        ['poll created (registered)', () => service.sendPollCreationEmails(user.email, NEUTRAL, link, link, 'survey', true)],
        ['invitation without inviter', () => service.sendInvitationEmail(user.email, '', NEUTRAL, link)],
        ['vote confirmation', () => service.sendVotingConfirmationEmail(user.email, 'Alex', NEUTRAL, 'schedule', link, link, getVoteEmailSummary({ type: 'schedule', options: [{ id: 1, text: '10:00' }] }, [{ optionId: 1, response: 'maybe' }], lang), link)],
        ['vote updated', () => service.sendVoteUpdatedEmail(user.email, 'Alex', NEUTRAL, 'survey', link, link, ['10:00'], link)],
        ['vote withdrawn (voter)', () => service.sendVoteWithdrawalEmail(user.email, 'Alex', NEUTRAL, link, false)],
        ['vote withdrawn (organizer)', () => service.sendVoteWithdrawalEmail(user.email, 'Alex', NEUTRAL, link, true)],
        ['new vote notice without name', () => service.sendNewVoteNotificationEmail(user.email, '', NEUTRAL, 'organization', link, link)],
        ['reminder without sender', () => service.sendReminderEmail(user.email, '', NEUTRAL, link, new Date('2030-05-01T10:00:00Z'), ['10:00'])],
        ['password reset', () => service.sendPasswordResetEmail(user.email, link, 'Alex')],
        ['password changed', () => service.sendPasswordChangedEmail(user.email, 'Alex')],
        ['welcome', () => service.sendWelcomeEmail(user.email, 'Alex', link)],
        ['finalization', () => service.sendFinalizationEmails([user.email], NEUTRAL, { startTime: new Date('2030-05-01T10:00:00Z'), endTime: new Date('2030-05-01T11:00:00Z'), text: '10:00' }, link, Buffer.from('ics'))],
        ['poll ended (survey)', () => service.sendPollEndedEmails([user.email], NEUTRAL, link, true, 'survey', '10:00')],
        ['poll ended (organization)', () => service.sendPollEndedEmails([user.email], NEUTRAL, link, false, 'organization', undefined, [{ text: '10:00', filled: 1, total: 2 }])],
        ['org confirmation (participant + organizer)', () => service.sendOrgConfirmationEmails(NEUTRAL, link, [{ id: 1, text: '10:00' }], [{ optionId: 1, voterEmail: user.email, voterName: 'Alex', response: 'yes' }], user.email)],
        ['virus alert', () => service.sendVirusDetectionAlert([user.email], { filename: 'x.png', fileSize: 10, virusName: 'Eicar', uploaderEmail: null, requestIp: null, scannedAt: new Date() })],
        ['deletion request', () => service.sendDeletionRequestNotification([user.email], 'Alex', 'alex@test.example', link)],
        ['test report', () => service.sendTestReportEmail(user.email, {
          id: 1, status: 'completed', triggeredBy: 'manual', totalTests: 3, passed: 1, failed: 1, skipped: 1,
          duration: 125000, startedAt: new Date(), completedAt: new Date(),
        }, Buffer.from('pdf'), [{ testFile: 'a.test.ts', testName: 'x', category: 'unit', status: 'failed', duration: 1, error: 'boom', errorStack: null }])],
      ];

      for (const [name, send] of sends) {
        captured.length = 0;
        await send();
        expect(captured.length, `${name}: no mail sent`).toBeGreaterThan(0);
        for (const mail of captured) checkMail(mail, lang, name);
      }
    });
  });
});
