import { describe, it, expect, beforeEach } from 'vitest';
import { EmailTemplateService, renderTemplate } from '../../services/emailTemplateService';
import { emailStrings, DEFAULT_EMAIL_FOOTERS } from '../../services/emailI18n';
import {
  EMAIL_LANGUAGES,
  EMAIL_TEMPLATE_TYPES,
  EMAIL_TEMPLATE_VARIABLES,
  type EmailLanguage,
  type EmailTemplateType,
} from '@shared/schema';
import { storeTemplate, useInMemoryEmailStorage } from '../fixtures/inMemoryEmailStorage';

export const testMeta = {
  category: 'functional' as const,
  name: 'E-Mail-Vorlagen: Render-Matrix DE/EN',
  description: 'Rendert jede E-Mail-Vorlage in Deutsch und Englisch mit Beispieldaten, prüft Betreff, HTML und Text auf erwartete Werte ohne Platzhalter-Reste sowie Fallbacks für fehlende Variablen und Sprachen',
  severity: 'high' as const,
};

const SITE = 'PollyLab';

/** Distinctive values so every assertion can find exactly what it substituted. */
const VALUES: Record<string, string> = {
  pollTitle: 'R&D Roadmap Q7',
  pollType: 'KappaType',
  publicLink: 'https://polly.example.com/poll/pub-777',
  adminLink: 'https://polly.example.com/admin/adm-777',
  qrCodeUrl: 'https://polly.example.com/qr/777.png',
  inviterName: 'Kim Novak',
  message: 'Bring snacks 777',
  voterName: 'Ola Berg',
  resultsLink: 'https://polly.example.com/poll/pub-777/results-777',
  editLink: 'https://polly.example.com/edit/tok-777',
  senderName: 'Kim Novak',
  pollLink: 'https://polly.example.com/poll/link-777',
  expiresAt: 'Deadline 2030-12-31 23:59',
  userName: 'Ola Berg',
  resetLink: 'https://polly.example.com/auth/reset-password?token=rst777',
  oldEmail: 'old-777@example.com',
  newEmail: 'new-777@example.com',
  confirmLink: 'https://polly.example.com/auth/confirm-email?token=cfm777',
  testRunId: '777',
  status: 'StatusXYZ',
  totalTests: '31',
  passed: '28',
  failed: '2',
  skipped: '1',
  duration: '61 s',
  startedAt: '2030-01-02 03:04',
  failedSummaryHtml: '<ul><li>broken-spec-777</li></ul>',
  failedSummaryText: 'broken-spec-777',
  userEmail: 'ola-777@example.com',
  verificationLink: 'https://polly.example.com/verify/vfy777',
  confirmedDate: '2030-05-01',
  confirmedTime: '10:00 - 11:00',
  videoConferenceUrl: 'https://meet.example.com/room-777',
  videoConferenceHtml: '<a href="https://meet.example.com/room-777">room-777</a>',
  closingMessageHtml: '<p>See you 777</p>',
};

const OPTIONS_HTML = '<ul><li>Option-Alpha</li><li>Option-Beta</li></ul>';

/** Variables the services pass in addition to the documented template variables. */
const EXTRA_VARIABLES: Partial<Record<EmailTemplateType, Record<string, string>>> = {
  vote_confirmation: { selectedOptionsHtml: OPTIONS_HTML, resultsPublic: 'true' },
  vote_updated: { selectedOptionsHtml: OPTIONS_HTML, resultsPublic: 'true' },
  reminder: { selectedOptionsHtml: OPTIONS_HTML },
  poll_finalized: {
    pollType: 'schedule',
    statusLabel: 'Label777',
    buttonLabel: 'Open777',
    buttonLink: 'https://polly.example.com/poll/btn-777',
  },
};

/** Values each V3 body must show (in addition to the subject/text checks). */
const HTML_EXPECTATIONS: Record<EmailTemplateType, string[]> = {
  poll_created: ['pollTitle', 'pollType', 'adminLink', 'publicLink'],
  invitation: ['inviterName', 'pollTitle', 'message', 'publicLink'],
  vote_confirmation: ['voterName', 'pollTitle', 'pollType', 'resultsLink', 'editLink', 'selectedOptionsHtml'],
  vote_updated: ['voterName', 'pollTitle', 'pollType', 'resultsLink', 'editLink', 'selectedOptionsHtml'],
  new_vote_notification: ['voterName', 'pollTitle', 'pollType', 'adminLink', 'resultsLink'],
  reminder: ['senderName', 'pollTitle', 'expiresAt', 'pollLink', 'selectedOptionsHtml'],
  password_reset: ['userName', 'resetLink'],
  email_change: ['oldEmail', 'newEmail', 'confirmLink'],
  password_changed: ['userName'],
  test_report: ['testRunId', 'status', 'duration', 'startedAt', 'failedSummaryHtml'],
  welcome: ['userName', 'verificationLink'],
  poll_finalized: ['pollTitle', 'confirmedDate', 'confirmedTime', 'videoConferenceUrl', 'buttonLabel', 'buttonLink', 'closingMessageHtml'],
};

/** A language-specific text each body contains, so a wrong-language render is caught. */
function languageMarker(type: EmailTemplateType, lang: EmailLanguage): string {
  const L = emailStrings(lang);
  const markers: Record<EmailTemplateType, string> = {
    poll_created: L.pollCreated.adminLabel,
    invitation: L.invitation.headline,
    reminder: L.reminder.headlineBefore,
    vote_confirmation: L.vote.confirmationHeadline,
    vote_updated: L.vote.updatedHeadline,
    new_vote_notification: L.newVote.headline,
    password_reset: L.security.resetHeadline,
    email_change: L.security.changeHeadline,
    password_changed: L.security.changedHeadline,
    test_report: L.testReport.subline,
    welcome: L.welcome.buttonText,
    poll_finalized: L.finalized.scheduleHeadline,
  };
  return markers[type];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function placeholders(text: string): string[] {
  return [...new Set((text.match(/\{\{\s*(\w+)\s*\}\}/g) ?? []).map((p) => p.replace(/[{}\s]/g, '')))];
}

function fullVariables(type: EmailTemplateType): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const { key } of EMAIL_TEMPLATE_VARIABLES[type]) {
    if (VALUES[key] !== undefined) vars[key] = VALUES[key];
  }
  return { ...vars, ...(EXTRA_VARIABLES[type] ?? {}) };
}

function expectedHtmlFragment(key: string, vars: Record<string, string>): string[] {
  if (key === 'selectedOptionsHtml') return ['Option-Alpha', 'Option-Beta'];
  if (key === 'failedSummaryHtml') return ['broken-spec-777'];
  if (key === 'closingMessageHtml') return ['See you 777'];
  return [escapeHtml(vars[key])];
}

function otherLanguages(lang: EmailLanguage): EmailLanguage[] {
  return EMAIL_LANGUAGES.filter((l) => l !== lang);
}

describe('Email templates — render matrix for every type and language', () => {
  const memory = useInMemoryEmailStorage();
  const service = new EmailTemplateService();

  beforeEach(() => memory.reset());

  describe.each(EMAIL_LANGUAGES.map((lang) => [lang]))('%s', (lang) => {
    it.each(EMAIL_TEMPLATE_TYPES.map((type) => [type]))('renders %s with complete sample data', async (type) => {
      const vars = fullVariables(type);
      const defaults = EmailTemplateService.getDefaultTemplate(type, lang);
      const rendered = await service.renderEmail(type, vars, lang);

      // No placeholder survives in any part of the mail.
      expect(rendered.subject, 'subject placeholders').not.toMatch(/\{\{/);
      expect(rendered.html, 'html placeholders').not.toMatch(/\{\{/);
      expect(rendered.text, 'text placeholders').not.toMatch(/\{\{/);

      // Subject: language-specific default, site prefix removed, every variable filled in.
      expect(rendered.subject.startsWith('['), 'site prefix stripped').toBe(false);
      const expectedSubject = renderTemplate(defaults.subject, { siteName: SITE, ...vars })
        .replace(new RegExp(`^\\[${SITE}\\]\\s*`), '').trim();
      expect(rendered.subject).toBe(expectedSubject);
      for (const key of placeholders(defaults.subject).filter((k) => k !== 'siteName')) {
        expect(rendered.subject, `subject shows ${key}`).toContain(vars[key]);
      }

      // Text: built from this language's default text, every placeholder replaced,
      // ending with this language's footer.
      const firstLine = defaults.textContent.split('\n')[0];
      expect(rendered.text.startsWith(renderTemplate(firstLine, { siteName: SITE, ...vars }))).toBe(true);
      for (const key of placeholders(defaults.textContent)) {
        const value = key === 'siteName' ? SITE : vars[key];
        expect(rendered.text, `text shows ${key}`).toContain(value);
      }
      const footerFirstLine = DEFAULT_EMAIL_FOOTERS[lang].split('\n')[0];
      expect(rendered.text).toContain(`---\n${renderTemplate(footerFirstLine, { siteName: SITE })}`);

      // HTML: right document language, the type's body text in this language
      // (not in another one), and every sample value visible.
      expect(rendered.html).toContain(`<html lang="${lang}">`);
      expect(rendered.html).toContain(escapeHtml(languageMarker(type, lang)));
      for (const other of otherLanguages(lang)) {
        expect(rendered.html, `no ${other} body text`).not.toContain(escapeHtml(languageMarker(type, other)));
      }
      for (const key of HTML_EXPECTATIONS[type]) {
        for (const fragment of expectedHtmlFragment(key, { ...vars, ...(EXTRA_VARIABLES[type] ?? {}) })) {
          expect(rendered.html, `html shows ${key}`).toContain(fragment);
        }
      }
      // The header shows the configured branding.
      expect(rendered.html).toContain('>Polly</span>');
      expect(rendered.html).toContain('>Lab</span>');
    });

    it('renders the admin preview sample data of every type without leftover placeholders', async () => {
      for (const type of EMAIL_TEMPLATE_TYPES) {
        const sample = await EmailTemplateService.getSampleDataForType(type, lang);
        expect(Object.keys(sample).length, `${type} has sample data`).toBeGreaterThan(0);
        expect(sample.siteName).toBe(SITE);
        const rendered = await service.renderEmail(type, sample, lang);
        expect(rendered.subject, `${type} subject`).not.toMatch(/\{\{/);
        expect(rendered.html, `${type} html`).not.toMatch(/\{\{/);
        // The plain text may only keep placeholders for variables the sample
        // deliberately leaves out (optional content such as a video link).
        const leftovers = placeholders(rendered.text);
        for (const key of leftovers) {
          expect(Object.keys(sample), `${type} text keeps {{${key}}}`).not.toContain(key);
        }
      }
    });

    it.each(EMAIL_TEMPLATE_TYPES.map((type) => [type]))('falls back to safe defaults when every variable of %s is missing', async (type) => {
      const L = emailStrings(lang);
      const rendered = await service.renderEmail(type, {}, lang);

      // The HTML body never shows raw placeholders, links fall back to "#".
      // (Only the <title> mirrors the subject, which keeps unfilled placeholders.)
      const body = rendered.html.replace(/<title>[\s\S]*?<\/title>/, '');
      expect(body).not.toMatch(/\{\{/);
      expect(rendered.html.match(/<title>([\s\S]*?)<\/title>/)?.[1]).toBe(escapeHtml(rendered.subject));
      expect(rendered.html).toContain(`<html lang="${lang}">`);
      expect(rendered.html).toContain(escapeHtml(languageMarker(type, lang)));
      // siteName is always filled from the branding, even when not passed.
      expect(rendered.subject).not.toContain('{{siteName}}');
      expect(rendered.text).not.toContain('{{siteName}}');
      // Missing variables stay visible in the plain text instead of silently
      // disappearing (renderTemplate leaves unknown placeholders untouched).
      const textKeys = placeholders(EmailTemplateService.getDefaultTemplate(type, lang).textContent).filter((k) => k !== 'siteName');
      for (const key of textKeys) expect(rendered.text).toContain(`{{${key}}}`);

      const linkTypes: EmailTemplateType[] = ['poll_created', 'invitation', 'reminder', 'vote_confirmation', 'vote_updated', 'new_vote_notification', 'password_reset', 'email_change', 'welcome', 'poll_finalized'];
      if (linkTypes.includes(type)) expect(rendered.html).toContain('href="#"');

      if (['poll_created', 'vote_confirmation', 'vote_updated', 'new_vote_notification'].includes(type)) {
        expect(rendered.html, 'default poll type label').toContain(escapeHtml(L.defaultPollType));
      }
      if (type === 'new_vote_notification') expect(rendered.html).toContain(escapeHtml(L.newVote.participantFallback));
      if (['vote_confirmation', 'vote_updated', 'password_reset', 'password_changed', 'welcome'].includes(type)) {
        // Greeting without a name: "Hallo —" / "Hello —".
        expect(rendered.html).toContain(`${L.greeting('')} \u2014`);
      }
      if (type === 'test_report') {
        expect(rendered.html).toContain(`${L.testReport.total}: <strong>0</strong>`);
        expect(rendered.html).toContain(`${L.testReport.failed}: <strong>0</strong>`);
      }
      if (type === 'poll_finalized') {
        // Missing poll type defaults to the schedule layout with the default button label.
        expect(rendered.html).toContain(escapeHtml(L.finalized.scheduleTag));
        expect(rendered.html).toContain(L.finalized.goToPoll);
        expect(rendered.html).not.toContain(L.finalized.time);
        expect(rendered.html).not.toContain(L.finalized.videoConference);
      }
    });

    it('ignores explicitly undefined variables instead of printing "undefined"', async () => {
      const rendered = await service.renderEmail('invitation', { ...fullVariables('invitation'), inviterName: undefined, message: undefined }, lang);
      expect(rendered.html).not.toContain('undefined');
      expect(rendered.text).not.toContain('undefined');
      expect(rendered.text).toContain('{{inviterName}}');
      expect(rendered.html).toContain(escapeHtml(VALUES.pollTitle));
    });

    it('falls back to the built-in template of the same language, never to a customization in another language', async () => {
      for (const other of otherLanguages(lang)) {
        storeTemplate(memory, {
          type: 'invitation',
          language: other,
          subject: `CUSTOM-${other} {{pollTitle}}`,
          textContent: `Custom ${other} body for {{pollTitle}}`,
        });
      }
      const template = await service.getTemplate('invitation', lang);
      expect(template.isDefault).toBe(true);
      expect(template.language).toBe(lang);
      expect(template.subject).toBe(EmailTemplateService.getDefaultTemplate('invitation', lang).subject);

      const rendered = await service.renderEmail('invitation', fullVariables('invitation'), lang);
      expect(rendered.subject).not.toContain('CUSTOM-');
      expect(rendered.text).not.toContain('Custom ');
      expect(rendered.html).toContain(escapeHtml(languageMarker('invitation', lang)));
    });

    it('uses this language\'s customization when one exists, and getAllTemplates lists it', async () => {
      storeTemplate(memory, {
        type: 'password_changed',
        language: lang,
        subject: `[{{siteName}}] Custom-${lang} {{userName}}`,
        textContent: `Custom-${lang} text for {{userName}}`,
      });
      const rendered = await service.renderEmail('password_changed', { userName: 'Ola Berg' }, lang);
      expect(rendered.subject).toBe(`Custom-${lang} Ola Berg`);
      expect(rendered.text).toContain(`Custom-${lang} text for Ola Berg`);
      expect(rendered.html).toContain(`Custom-${lang} text for Ola Berg`);

      const all = await service.getAllTemplates(lang);
      expect(all.map((t) => t.type)).toEqual([...EMAIL_TEMPLATE_TYPES]);
      const custom = all.find((t) => t.type === 'password_changed')!;
      expect(custom.isDefault).toBe(false);
      expect(custom.variables).toEqual(EMAIL_TEMPLATE_VARIABLES.password_changed);
      expect(all.filter((t) => t.isDefault)).toHaveLength(EMAIL_TEMPLATE_TYPES.length - 1);
    });
  });

  it('treats a stored template without language as German', async () => {
    storeTemplate(memory, { type: 'welcome', language: null as any, subject: 'Legacy {{userName}}', textContent: 'Legacy body' });
    const de = await service.getAllTemplates('de');
    expect(de.find((t) => t.type === 'welcome')?.subject).toBe('Legacy {{userName}}');
    const en = await service.getAllTemplates('en');
    expect(en.find((t) => t.type === 'welcome')?.isDefault).toBe(true);
  });

  it('renders German and English versions of the same mail differently', async () => {
    for (const type of EMAIL_TEMPLATE_TYPES) {
      const de = await service.renderEmail(type, fullVariables(type), 'de');
      const en = await service.renderEmail(type, fullVariables(type), 'en');
      // poll_finalized's subject is only "{{statusLabel}}: {{pollTitle}}" — both caller-provided.
      if (type !== 'poll_finalized') expect(de.subject, `${type} subject`).not.toBe(en.subject);
      expect(de.html, `${type} html`).not.toBe(en.html);
      expect(de.text, `${type} text`).not.toBe(en.text);
    }
  });

  it('strips an empty "[]" site prefix when the site has no name, and drops the header', async () => {
    memory.setCustomization({ branding: { siteName: '', siteNameAccent: '', logoUrl: null } });
    const rendered = await service.renderEmail('password_reset', { userName: 'Ola', resetLink: VALUES.resetLink }, 'en');
    expect(rendered.subject).toBe('Reset your password');
    expect(rendered.html).not.toContain('class="email-header"');
  });

  it('keeps an empty subject empty', async () => {
    storeTemplate(memory, { type: 'password_changed', subject: '   ', textContent: 'Body' });
    const rendered = await service.renderEmail('password_changed', {}, 'de');
    expect(rendered.subject).toBe('');
  });

  it('throws for unknown template types instead of rendering an empty mail', async () => {
    expect(() => EmailTemplateService.getDefaultTemplate('nope' as EmailTemplateType)).toThrow('Unknown template type: nope');
    await expect(EmailTemplateService.renderTemplate('nope' as EmailTemplateType, {})).rejects.toThrow('Unknown template type: nope');
    expect(await EmailTemplateService.getSampleDataForType('nope')).toEqual({});
  });

  it('renders the legacy block HTML of every default template in both languages with the stored theme', async () => {
    await service.setEmailTheme({ fontFamily: 'Georgia, serif', headingColor: '#112233' });
    for (const lang of EMAIL_LANGUAGES) {
      for (const type of EMAIL_TEMPLATE_TYPES) {
        const html = await EmailTemplateService.renderTemplate(type, fullVariables(type), lang);
        expect(html, `${lang} ${type}`).toContain('font-family: Georgia, serif');
        expect(html, `${lang} ${type}`).toContain('color: #112233');
        for (const key of placeholders(JSON.stringify(EmailTemplateService.getDefaultTemplate(type, lang).jsonContent))) {
          if (fullVariables(type)[key] !== undefined) {
            expect(html, `${lang} ${type} ${key}`).not.toContain(`{{${key}}}`);
          }
        }
      }
    }
  });
});
