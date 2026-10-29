import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EmailTemplateService,
  ensureButtonTextContrast,
  jsonToHtml,
  substituteVariables,
  type EmailTheme,
} from '../../services/emailTemplateService';
import { emailStrings, DEFAULT_EMAIL_FOOTERS } from '../../services/emailI18n';
import { EMAIL_LANGUAGES, type EmailLanguage } from '@shared/schema';
import { storeTemplate, useInMemoryEmailStorage } from '../fixtures/inMemoryEmailStorage';

export const testMeta = {
  category: 'functional' as const,
  name: 'E-Mail-Vorlagen: Blöcke, Theme und eigene Texte',
  description: 'Prüft Block-Rendering (inkl. unbekannter Blocktypen), Theme-Overrides und -Import sowie angepasste Texte je Vorlagentyp in DE/EN, ohne Vorlagen oder Themes in der Test-Datenbank zu speichern',
  severity: 'high' as const,
};

type Doc = Parameters<typeof jsonToHtml>[0];

function doc(childrenIds: unknown, blocks: Record<string, unknown> = {}, rootData: Record<string, unknown> = {}): Doc {
  return {
    root: { type: 'EmailLayout', data: { childrenIds, ...rootData } },
    ...blocks,
  } as unknown as Doc;
}

const OPTIONS_HTML = '<ul><li>Option-Alpha</li><li>Option-Beta</li></ul>';

describe('Email templates — block rendering', () => {
  it('skips unknown block types but keeps rendering the blocks around them', () => {
    const html = jsonToHtml(doc(['a', 'spacer', 'raw', 'b'], {
      a: { type: 'Text', data: { props: { text: 'Before-777' } } },
      spacer: { type: 'Spacer', data: { style: { height: 40 } } },
      raw: { type: 'Html', data: { props: { contents: '<script>alert(1)</script>' } } },
      b: { type: 'Text', data: { props: { text: 'After-777' } } },
    }));
    expect(html).toContain('Before-777');
    expect(html).toContain('After-777');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('height: 40');
  });

  it('ignores missing, non-object and data-less blocks', () => {
    const html = jsonToHtml(doc(['missing', 'str', 'nodata', 42], {
      str: 'not a block',
      nodata: { type: 'Text' },
    }));
    // The data-less Text block renders as an empty paragraph with theme defaults.
    expect(html).toContain('<p class="email-text" style="color: #333333; font-size: 16px;');
    expect(html.match(/<p /g)).toHaveLength(1);
  });

  it('reports an invalid layout instead of rendering garbage', () => {
    expect(jsonToHtml({} as Doc)).toBe('<div>Template-Fehler: Ungültiges Format</div>');
    expect(jsonToHtml({ root: { type: 'Other', data: {} } } as unknown as Doc)).toContain('Template-Fehler');
    expect(jsonToHtml({ root: { type: 'EmailLayout' } } as unknown as Doc)).toMatch(/^<div style="font-family: [^"]+">\s*<\/div>$/);
  });

  it('renders headings with level-based sizes, fallbacks and style overrides', () => {
    const html = jsonToHtml(doc(['h1', 'h3', 'hx', 'hd'], {
      h1: { type: 'Heading', data: { props: { level: 'h1', text: 'Big' } } },
      h3: { type: 'Heading', data: { props: { level: 'h3', text: 'Small' }, style: { color: '#010203', fontWeight: '300', padding: { top: 4 } } } },
      hx: { type: 'Heading', data: { props: { level: 'h6', text: 'Odd' } } },
      hd: { type: 'Heading', data: {} },
    }));
    expect(html).toContain('<h1 class="email-heading" style="color: #FF6B35; font-size: 26px; line-height: 1.3;');
    expect(html).toContain('<h3 class="email-heading" style="color: #010203; font-size: 18px; line-height: 1.4; padding: 4px 0px 0px 0px;');
    expect(html).toContain('font-weight: 300;">Small</h3>');
    expect(html).toContain('<h6 class="email-heading" style="color: #FF6B35; font-size: 22px;');
    expect(html).toContain('<h2 class="email-heading"');
    expect(html).toContain('font-weight: bold;"></h2>');
  });

  it('renders text with custom color, size and weight', () => {
    const html = jsonToHtml(doc(['t'], {
      t: { type: 'Text', data: { props: { text: 'Styled' }, style: { color: '#445566', fontSize: 12, fontWeight: 'bold', padding: { left: 8, right: 8 } } } },
    }));
    expect(html).toContain('color: #445566; font-size: 12px; padding: 0px 8px 0px 8px;');
    expect(html).toContain('font-weight: bold;">Styled</p>');
  });

  it('renders buttons with defaults, secondary colors, explicit overrides and margins', () => {
    const theme: EmailTheme = {
      backdropColor: '#F5F5F5', canvasColor: '#FFFFFF', textColor: '#333333', headingColor: '#222222',
      linkColor: '#000080', buttonBackgroundColor: '#000080', buttonTextColor: '#FFFFFF', buttonBorderRadius: 12,
      fontFamily: 'Arial, sans-serif', secondaryButtonBackgroundColor: '#FFFF00', secondaryButtonTextColor: '#FFFFFF',
    };
    const html = jsonToHtml(doc(['empty', 'sec', 'own'], {
      empty: { type: 'Button', data: {} },
      sec: { type: 'Button', data: { props: { text: 'Second', url: 'https://x.example/s', buttonType: 'secondary' } } },
      own: { type: 'Button', data: { props: { text: 'Own', url: 'https://x.example/o' }, style: { backgroundColor: '#123123', color: '#eeeeee', padding: { top: 2, bottom: 2, left: 6, right: 6 }, margin: { top: 10 } } } },
    }), theme);
    // Missing text/url fall back to a visible label and an inert link.
    expect(html).toContain('<a href="#" class="email-btn-primary"');
    expect(html).toContain('>Click</a>');
    expect(html).toContain('background-color: #000080; color: #FFFFFF; padding: 14px 28px; border-radius: 12px;');
    // White text on yellow is unreadable, so the secondary button switches to dark text.
    expect(html).toContain('class="email-btn-secondary" style="display: inline-block; text-decoration: none; background-color: #FFFF00; color: #1a1a1a;');
    expect(html).toContain('<div style="text-align: center; margin: 10px 0px 0px 0px;">');
    expect(html).toContain('background-color: #123123; color: #eeeeee; padding: 2px 6px 2px 6px;');
  });

  it('renders containers by variant, with borders, and with their nested children', () => {
    const html = jsonToHtml(doc(['p', 's', 'plain', 'nokids'], {
      p: { type: 'Container', data: { props: { containerVariant: 'primary' }, childrenIds: ['inner'] } },
      inner: { type: 'Text', data: { props: { text: 'Inside-777' } } },
      s: { type: 'Container', data: { props: { containerVariant: 'secondary' }, childrenIds: [] } },
      plain: { type: 'Container', data: { style: { backgroundColor: '#abcdef', borderWidth: 2, borderColor: '#111111', borderRadius: 0, padding: { top: 1, right: 1, bottom: 1, left: 1 }, margin: { top: 0, right: 0, bottom: 0, left: 0 } }, childrenIds: 'not-a-list' } },
      nokids: { type: 'Container', data: {} },
    }));
    expect(html).toMatch(/email-container-p" style="background-color: #[0-9A-F]{6}; border-radius: 8px;/);
    expect(html).toContain('Inside-777');
    expect(html).toMatch(/email-container-s" style="background-color: #[0-9A-F]{6};/);
    expect(html).toContain('email-container-plain" style="background-color: #abcdef; border-radius: 0px; padding: 1px 1px 1px 1px; margin: 0px 0px 0px 0px; border: 2px solid #111111;');
    expect(html).toContain('email-container-nokids" style="background-color: #f8f9fa; border-radius: 8px; padding: 20px 24px 20px 24px; margin: 12px 0px 12px 0px;"');
  });

  it('falls back to a neutral container color when the theme color cannot be parsed', () => {
    const html = jsonToHtml(doc(['p'], { p: { type: 'Container', data: { props: { containerVariant: 'primary' } } } }), {
      buttonBackgroundColor: 'not-a-color',
    } as EmailTheme);
    expect(html).toContain('email-container-p" style="background-color: #f8f9fa;');
  });

  it('renders dividers and images, and drops images without a source', () => {
    const html = jsonToHtml(doc(['d', 'img', 'noimg'], {
      d: { type: 'Divider', data: { style: { padding: { top: 3, bottom: 3 } } } },
      img: { type: 'Image', data: { props: { src: 'https://x.example/qr.png', alt: 'QR' }, style: { width: '120px' } } },
      noimg: { type: 'Image', data: { props: { alt: 'nothing' } } },
    }));
    expect(html).toContain('<div style="padding: 3px 0px 3px 0px;"><hr class="email-divider"');
    expect(html).toContain('<img src="https://x.example/qr.png" alt="QR" style="max-width: 120px; height: auto;">');
    expect(html).not.toContain('nothing');
  });
});

describe('Email templates — theme overrides', () => {
  it('uses the default theme when none is given and the layout colors as fallback', () => {
    const plain = jsonToHtml(doc(['t'], { t: { type: 'Text', data: { props: { text: 'x' } } } }));
    expect(plain).toContain('<div style="font-family: Arial, sans-serif; color: #333333;">');

    const fromLayout = jsonToHtml(
      doc(['t'], { t: { type: 'Text', data: { props: { text: 'x' } } } }, { textColor: '#0a0a0a', fontFamily: 'Verdana' }),
      { textColor: '', fontFamily: '' } as EmailTheme,
    );
    expect(fromLayout).toContain('<div style="font-family: Verdana; color: #0a0a0a;">');
  });

  it('fills every empty theme field from the defaults', () => {
    const html = jsonToHtml(doc(['h', 'b', 's'], {
      h: { type: 'Heading', data: { props: { text: 'H' } } },
      b: { type: 'Button', data: { props: { text: 'B' } } },
      s: { type: 'Button', data: { props: { text: 'S', buttonType: 'secondary' } } },
    }), {
      headingColor: '', buttonBackgroundColor: '', buttonTextColor: '', secondaryButtonBackgroundColor: '', secondaryButtonTextColor: '',
    } as unknown as EmailTheme);
    expect(html).toContain('style="color: #FF6B35; font-size: 22px;');
    expect(html).toContain('background-color: #FF6B35;');
    expect(html).toContain('background-color: #4A90A4;');
    expect(html).toContain('border-radius: 6px;');
  });

  it('keeps contrast handling robust for 8-digit hex, rgb and invalid colors', () => {
    expect(ensureButtonTextContrast('#000000ff', '#ffffff')).toBe('#ffffff');
    expect(ensureButtonTextContrast('#ffffff80', '#ffffff')).toBe('#1a1a1a');
    expect(ensureButtonTextContrast('rgb(20, 20, 20)', '#222222')).toBe('#FFFFFF');
    expect(ensureButtonTextContrast('bogus', '#123456')).toBe('#123456');
  });
});

describe('Email templates — stored theme, footer and custom texts (in memory only)', () => {
  const memory = useInMemoryEmailStorage();
  const service = new EmailTemplateService();

  beforeEach(() => memory.reset());

  it('returns the default theme when none is stored and merges partial updates', async () => {
    const initial = await service.getEmailTheme();
    expect(initial.buttonBackgroundColor).toBe('#FF6B35');
    const updated = await service.setEmailTheme({ fontFamily: 'Georgia, serif' });
    expect(updated).toEqual({ ...initial, fontFamily: 'Georgia, serif' });
    expect(memory.settings.get('email_theme')).toEqual(updated);
  });

  it('applies the stored theme font and falls back to the email theme colors when branding has none', async () => {
    await service.setEmailTheme({ fontFamily: 'Georgia, serif', buttonBackgroundColor: '#0b3d91', secondaryButtonBackgroundColor: '#5c2d91' });
    memory.setCustomization({ branding: { siteName: 'Polly', siteNameAccent: 'Lab' }, theme: { primaryColor: '', secondaryColor: '' } });
    for (const lang of EMAIL_LANGUAGES) {
      const rendered = await service.renderEmail('new_vote_notification', { voterName: 'Ola', pollTitle: 'T', adminLink: 'https://x.example/a', resultsLink: 'https://x.example/r' }, lang);
      expect(rendered.html).toContain('font-family: Georgia, serif;');
      expect(rendered.html).toContain('class="btn-primary" style="display: inline-block; font-family: system-ui, -apple-system, Arial, sans-serif; font-size: 13px; font-weight: 500; letter-spacing: 0.02em; color: #ffffff; background-color: #0b3d91;');
      expect(rendered.html).toContain('background-color: #5c2d91;');
    }
  });

  it('falls back to the default font when the stored theme has none', async () => {
    await service.setEmailTheme({ fontFamily: '' });
    const rendered = await service.renderEmail('password_changed', { userName: 'Ola' }, 'en');
    expect(rendered.html).toContain('<body style="margin: 0; padding: 28px 16px; background-color: #f0ede8; font-family: Arial, sans-serif;">');
  });

  it('resets the theme from branding colors, with default colors when branding has none', async () => {
    memory.setCustomization({ theme: { primaryColor: '', secondaryColor: '' } });
    const theme = await service.resetEmailTheme();
    expect(theme.buttonBackgroundColor).toBe('#FF6B35');
    expect(theme.secondaryButtonBackgroundColor).toBe('#4A90A4');
    expect(memory.settings.get('email_theme')).toEqual(theme);
  });

  it('imports a theme from nested emailbuilder JSON and uses it for rendering', async () => {
    const imported = await service.importThemeFromEmailBuilder({
      root: { type: 'EmailLayout', data: { backdropColor: '#eeeeee', canvasColor: '#fafafa', fontFamily: 'Verdana, sans-serif', childrenIds: ['c', 'h', 'bad', 'nostyle', 7] } },
      c: { type: 'Container', data: { childrenIds: ['t', 'b1', 'b2', 'cnested'] } },
      cnested: { type: 'Container', data: { childrenIds: 'nope' } },
      t: { type: 'Text', data: { style: { color: '#202020' } } },
      b1: { type: 'Button', data: { style: { backgroundColor: '#0b3d91', color: '#ffffff', borderRadius: 14.6 } } },
      b2: { type: 'Button', data: { style: { backgroundColor: '#5c2d91', borderRadius: 500 } } },
      h: { type: 'Heading', data: { style: { color: 'javascript:alert(1)' } } },
      bad: { type: 'Heading', data: 'oops' },
      nostyle: { type: 'Text', data: {} },
    });
    expect(imported).toMatchObject({
      backdropColor: '#eeeeee',
      canvasColor: '#fafafa',
      fontFamily: 'Verdana, sans-serif',
      textColor: '#202020',
      buttonBackgroundColor: '#5c2d91',
      // The first button sets the link color; later buttons do not override it.
      linkColor: '#0b3d91',
      buttonTextColor: '#ffffff',
      buttonBorderRadius: 15,
    });
    // The unsafe heading color was dropped, the default stays.
    expect(imported.headingColor).toBe('#FF6B35');

    const html = await EmailTemplateService.renderTemplate('invitation', { pollTitle: 'X', inviterName: 'Y', publicLink: 'https://x.example' }, 'en');
    expect(html).toContain('font-family: Verdana, sans-serif;');
  });

  it('rejects font families that are too long or contain no letters', () => {
    expect(service.extractThemeFromEmailBuilder({ root: { data: { fontFamily: `${'a'.repeat(201)}` } } })).toEqual({});
    expect(service.extractThemeFromEmailBuilder({ root: { data: { fontFamily: '123, 456' } } })).toEqual({});
  });

  it('returns an empty theme when reading the JSON throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const hostile = { get root() { throw new Error('boom'); } };
    expect(service.extractThemeFromEmailBuilder(hostile)).toEqual({});
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('fills empty footer fields with this language\'s default footer and drops unsafe footer links', async () => {
    for (const lang of EMAIL_LANGUAGES) {
      memory.settings.set(EmailTemplateService.footerSettingKey(lang), { html: '', text: 'See {{link:javascript:alert(1)}} and {{link:ftp://x|Files}}' });
      const footer = await service.getEmailFooter(lang);
      expect(footer.html).toBe(DEFAULT_EMAIL_FOOTERS[lang]);
      const rendered = await service.renderEmail('password_changed', { userName: 'Ola' }, lang);
      expect(rendered.text).toContain('---\nSee  and Files');
      expect(rendered.text).not.toContain('javascript:');
    }
  });

  it('replaces an auto-generated footer line in custom text with the configured footer', async () => {
    memory.settings.set('email_footer_en', { html: 'Footer-EN', text: 'Footer-EN-777' });
    storeTemplate(memory, {
      type: 'password_changed',
      language: 'en',
      subject: 'Changed',
      textContent: 'Body line\n---\nThis email was sent automatically by Old Site.',
    });
    const rendered = await service.renderEmail('password_changed', {}, 'en');
    expect(rendered.text).toBe('Body line\n---\nFooter-EN-777');

    const wrapped = await service.wrapWithEmailTheme('Subj', '<p>Hi</p>', 'Hi\n---\nThis email was generated automatically', 'en');
    expect(wrapped.text).toBe('Hi\n---\nFooter-EN-777');
    expect(wrapped.html).toContain('<p>Hi</p>');
    expect(wrapped.html).toContain('<html lang="en">');
  });

  describe.each(EMAIL_LANGUAGES.map((lang) => [lang]))('custom texts (%s)', (lang: EmailLanguage) => {
    const L = emailStrings(lang);

    it('turns custom poll_created text into intro, sections and notice overrides', async () => {
      storeTemplate(memory, {
        type: 'poll_created',
        language: lang,
        subject: '{{pollTitle}}',
        textContent: [
          'Intro line for {{pollTitle}}',
          '{{adminLink}} (bookmark me)',
          'Share-this description',
          'Share now: {{publicLink}}',
          'Keep this mail safe forever',
        ].join('\n'),
      });
      const rendered = await service.renderEmail('poll_created', {
        pollTitle: 'Roadmap', adminLink: 'https://x.example/admin', publicLink: 'https://x.example/pub',
      }, lang);
      // No greeting and no admin header: the intro becomes the subline.
      expect(rendered.html).toContain('Intro line for Roadmap');
      // "{{adminLink}} (bookmark me)" is not a "Label: {{adminLink}}" line, so the default button stays.
      expect(rendered.html).toContain(L.pollCreated.adminButton);
      // Public lines without a recognizable title become the description.
      expect(rendered.html).toContain('Share-this description');
      expect(rendered.html).toContain('>Share now</a>');
      // A notice line without "Title:" becomes the notice body.
      expect(rendered.html).toContain('Keep this mail safe forever');
      expect(rendered.html).toContain('href="https://x.example/admin"');
      expect(rendered.html).toContain('href="https://x.example/pub"');
      expect(rendered.html).not.toMatch(/\{\{/);
    });

    it('maps a fully structured custom poll_created text onto every section', async () => {
      storeTemplate(memory, {
        type: 'poll_created',
        language: lang,
        subject: 'S',
        textContent: [
          'Hello {{pollTitle}} team',
          'Intro-777',
          'Admin link:',
          'Admin-desc-777',
          'Open admin: {{adminLink}}',
          'Public link:',
          'Public-desc-777',
          'Open vote: {{publicLink}}',
          'Heads-up: keep-777',
          'second-777',
        ].join('\n'),
      });
      const rendered = await service.renderEmail('poll_created', { pollTitle: 'Roadmap', adminLink: 'https://x.example/a', publicLink: 'https://x.example/p' }, lang);
      expect(rendered.html).toContain('Hello Roadmap team<br>Intro-777');
      expect(rendered.html).toContain('>Admin link</p>');
      expect(rendered.html).toContain('Admin-desc-777');
      expect(rendered.html).toContain('>Open admin</a>');
      expect(rendered.html).toContain('>Public link</p>');
      expect(rendered.html).toContain('Public-desc-777');
      expect(rendered.html).toContain('>Open vote</a>');
      expect(rendered.html).toContain('Heads-up</span> keep-777 second-777');
      // Custom templates drop the big default section titles.
      expect(rendered.html).not.toContain(L.pollCreated.adminTitle);
    });

    it('parses a notice with a title only and falls back to the full text when no intro is found', async () => {
      storeTemplate(memory, {
        type: 'poll_created',
        language: lang,
        subject: 'S',
        textContent: [
          'Admin-Link',
          'Manage: {{adminLink}}',
          'Participant link',
          'Vote: {{publicLink}}',
          'Notice-Title:',
        ].join('\n'),
      });
      const rendered = await service.renderEmail('poll_created', { adminLink: 'https://x.example/a', publicLink: 'https://x.example/p' }, lang);
      expect(rendered.html).toContain('Notice-Title</span>');
      // Default notice body of this language is used because the custom notice has no body.
      expect(rendered.html).toContain(L.pollCreated.noticeBodyGuest.slice(0, 20));
      expect(rendered.html).toContain('>Manage</a>');
      expect(rendered.html).toContain('>Vote</a>');
    });

    it('renders custom vote texts with selections, edit link and hidden results', async () => {
      storeTemplate(memory, {
        type: 'vote_confirmation',
        language: lang,
        subject: 'Thanks {{voterName}}',
        textContent: `Thanks {{voterName}}\n\n${L.vote.resultsText}\n\nResults: {{resultsLink}}`,
      });
      const rendered = await service.renderEmail('vote_confirmation', {
        voterName: 'Ola', resultsLink: 'https://x.example/r', editLink: 'https://x.example/e',
        selectedOptionsHtml: OPTIONS_HTML, resultsPublic: 'false', voteManagementAction: 'withdraw',
      }, lang);
      expect(rendered.text).not.toContain('https://x.example/r');
      expect(rendered.text).not.toContain(L.vote.resultsText);
      expect(rendered.text).toContain(`${L.vote.selection}:\n- Option-Alpha\n- Option-Beta`);
      expect(rendered.text).toContain(`${L.vote.withdrawLabel}: https://x.example/e`);
      expect(rendered.html).toContain('href="https://x.example/e"');
      expect(rendered.html).not.toContain('href="https://x.example/r"');
    });

    it('does not repeat reminder selections that the custom text already lists', async () => {
      storeTemplate(memory, {
        type: 'reminder',
        language: lang,
        subject: 'R',
        textContent: 'Please vote. You picked Option-Alpha and Option-Beta.\n\nVote: {{pollLink}}',
      });
      const rendered = await service.renderEmail('reminder', { pollLink: 'https://x.example/p', selectedOptionsHtml: OPTIONS_HTML }, lang);
      expect(rendered.text).not.toContain(L.reminder.currentSelection);
      expect(rendered.text.match(/Option-Alpha/g)).toHaveLength(1);
      expect(rendered.html).toContain('href="https://x.example/p"');
    });

    it('appends the organizer message to custom poll_finalized texts in this language', async () => {
      storeTemplate(memory, {
        type: 'poll_finalized',
        language: lang,
        subject: '{{pollTitle}}',
        textContent: 'Done: {{pollTitle}}',
      });
      const rendered = await service.renderEmail('poll_finalized', {
        pollTitle: 'Roadmap', closingMessageHtml: '<p>Bye 777</p>', closingMessageText: '  Bye 777  ',
      }, lang);
      expect(rendered.html).toContain(L.organizerMessage);
      expect(rendered.html).toContain('<p>Bye 777</p>');
      expect(rendered.text).toContain(`Done: Roadmap\n\n${L.organizerMessage}:\nBye 777`);
    });

    it('renders a customized template without text through the default body builder', async () => {
      storeTemplate(memory, { type: 'welcome', language: lang, subject: 'W {{userName}}', textContent: '' });
      const rendered = await service.renderEmail('welcome', { userName: 'Ola', verificationLink: 'https://x.example/v' }, lang);
      expect(rendered.subject).toBe('W Ola');
      expect(rendered.html).toContain(L.welcome.button);
      expect(rendered.text).toMatch(/^\s*---\n/);
    });
  });

  it('renders the survey and organization variants of poll_finalized in both languages', async () => {
    for (const lang of EMAIL_LANGUAGES) {
      const F = emailStrings(lang).finalized;
      const survey = await service.renderEmail('poll_finalized', { pollType: 'survey', pollTitle: 'S', finalOptionText: 'Winner-777', resultsPublic: 'false' }, lang);
      expect(survey.html).toContain(F.endedTag);
      expect(survey.html).toContain(F.resultsPrivateNote);
      expect(survey.html).toContain(`${F.finalResult}</strong> Winner-777`);

      const org = await service.renderEmail('poll_finalized', { pollType: 'organization', pollTitle: 'O', slotSummaryHtml: '<ul><li>Slot-777</li></ul>', closingMessageHtml: '<p>Org bye</p>' }, lang);
      expect(org.html).toContain(F.slotOverview);
      expect(org.html).toContain('Slot-777');
      expect(org.html).toContain('<p>Org bye</p>');
      expect(org.html).toContain(F.resultsPublicNote);

      const bare = await service.renderEmail('poll_finalized', { pollType: 'survey', pollTitle: 'B' }, lang);
      expect(bare.html).not.toContain(F.slotOverview);
      expect(bare.html).not.toContain(F.finalResult);
      expect(bare.html).not.toContain(emailStrings(lang).organizerMessage);
    }
  });

  it('saves templates from builder JSON in memory, deriving text and falling back to defaults', async () => {
    const saved = await service.saveTemplate('invitation', {
      root: { type: 'EmailLayout', data: { childrenIds: ['c', 'b', 'nodata'] } },
      c: { type: 'Container', data: { childrenIds: ['t'] } },
      t: { type: 'Text', data: { props: { text: '<b>Hello</b> {{inviterName}}' } } },
      b: { type: 'Button', data: { props: { text: 'Go', url: '{{publicLink}}' } } },
      nodata: { type: 'Text' },
    }, undefined, undefined, undefined, 'en');
    expect(saved.language).toBe('en');
    expect(saved.subject).toBe(EmailTemplateService.getDefaultTemplate('invitation', 'en').subject);
    expect(saved.textContent).toBe('Hello {{inviterName}}\n\nGo\n\n{{publicLink}}');
    expect(memory.templates.get('invitation:en')?.htmlContent).toContain('Hello</b> {{inviterName}}');

    const empty = await service.saveTemplate('welcome', { foo: 'bar' }, 'Custom', 'Name', undefined, 'de');
    expect(empty.textContent).toBe(EmailTemplateService.getDefaultTemplate('welcome', 'de').textContent);
    expect(empty.htmlContent).toContain('Template-Fehler');

    const reset = await service.resetTemplate('invitation', 'en');
    expect(reset.isDefault).toBe(true);
    expect(memory.templates.has('invitation:en')).toBe(false);
  });

  it('escapes variables only when requested', () => {
    expect(substituteVariables('{{a}}|{{b}}', { a: '<i>', b: undefined })).toBe('&lt;i&gt;|{{b}}');
    expect(EmailTemplateService.substituteVariables('{{a}}', { a: '<i>' }, false)).toBe('<i>');
  });
});
