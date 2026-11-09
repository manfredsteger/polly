// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import fs from 'fs';
import path from 'path';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createInstance, type i18n as I18n } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { EMAIL_TEMPLATE_TYPES, EMAIL_TEMPLATE_VARIABLES } from '@shared/schema';
import { TooltipProvider } from '../../../client/src/components/ui/tooltip';
import { EmailTemplatesPanel } from '../../../client/src/components/admin/settings/EmailTemplatesPanel';

export const testMeta = {
  category: 'ui' as const,
  name: 'E-Mail-Vorlagen: Admin-Ansicht rendert in Deutsch und Englisch',
  description: 'Rendert die Admin-Ansicht der E-Mail-Vorlagen mit den echten Sprachdateien und prüft Titel, Beschreibung, Vorlagenkarten und Tooltips in jeder Sprache',
  severity: 'medium' as const,
};

const LOCALES_DIR = path.resolve(__dirname, '../../../client/src/locales');

type Language = 'de' | 'en';

// Literal expectations, so a swapped or untranslated locale entry fails here
// even when both locale files are internally complete.
const EXPECTED: Record<Language, {
  title: string;
  description: string;
  importThemeTooltip: string;
  pollCreatedName: string;
  pollTitleVariableTooltip: string;
  clickToInsert: string;
}> = {
  de: {
    title: 'E-Mail-Vorlagen',
    description: 'Gestalten Sie Ihre E-Mail-Benachrichtigungen',
    importThemeTooltip: 'Diese Funktion befindet sich in Entwicklung. Nutzen Sie die Farbeinstellungen unten, um Ihr E-Mail-Design anzupassen.',
    pollCreatedName: 'Umfrage erstellt',
    pollTitleVariableTooltip: 'Titel der Umfrage',
    clickToInsert: 'Klicken zum Einfügen',
  },
  en: {
    title: 'Email Templates',
    description: 'Design your email notifications',
    importThemeTooltip: 'This feature is in development. Use the color settings below to customize your email design.',
    pollCreatedName: 'Poll Created',
    pollTitleVariableTooltip: 'Poll title',
    clickToInsert: 'Click to insert',
  },
};

// The historic German card title; the English UI must never show it.
const GERMAN_POLL_CREATED_NAME = 'Neue Abstimmung (Ersteller)';

function readLocale(language: Language) {
  return JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${language}.json`), 'utf8'));
}

async function createI18n(language: Language): Promise<I18n> {
  const instance = createInstance();
  await instance.use(initReactI18next).init({
    lng: language,
    resources: { [language]: { translation: readLocale(language) } },
    interpolation: { escapeValue: false },
    // A missing key must render as the raw key, not silently fall back to another language.
    fallbackLng: false,
    react: { useSuspense: false },
  });
  return instance;
}

// The API returns the stored template name, which historically was German in
// every language. Serving it for both languages makes sure the panel shows the
// translated card title instead of the raw API name.
function templateFixtures() {
  return EMAIL_TEMPLATE_TYPES.map((type) => ({
    type,
    name: type === 'poll_created' ? GERMAN_POLL_CREATED_NAME : `Vorlage ${type}`,
    subject: `Betreff ${type}`,
    jsonContent: null,
    textContent: `Text ${type}`,
    variables: EMAIL_TEMPLATE_VARIABLES[type],
    isDefault: true,
    isActive: true,
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
  }));
}

const API_FIXTURES: Record<string, unknown> = {
  '/api/v1/admin/email-templates?language=de': templateFixtures(),
  '/api/v1/admin/email-templates?language=en': templateFixtures(),
  '/api/v1/admin/email-footer?language=de': { html: 'Fußzeile', text: 'Fußzeile' },
  '/api/v1/admin/email-footer?language=en': { html: 'Footer', text: 'Footer' },
  '/api/v1/system/language': { defaultLanguage: 'de' },
  '/api/v1/admin/email-theme': {
    backdropColor: '#F5F5F5',
    canvasColor: '#FFFFFF',
    textColor: '#333333',
    headingColor: '#111111',
    linkColor: '#0000EE',
    buttonBackgroundColor: '#7C3AED',
    buttonTextColor: '#FFFFFF',
    buttonBorderRadius: 4,
    fontFamily: 'Arial',
  },
};

async function renderPanel(language: Language) {
  const i18n = await createI18n(language);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const key = String(queryKey[0]);
          if (!(key in API_FIXTURES)) throw new Error(`Unexpected query in test: ${key}`);
          return API_FIXTURES[key];
        },
      },
    },
  });
  render(
    createElement(I18nextProvider, { i18n },
      createElement(QueryClientProvider, { client: queryClient },
        createElement(TooltipProvider, { delayDuration: 0 },
          createElement(EmailTemplatesPanel, { onBack: () => {} }),
        ),
      ),
    ),
  );
  // Wait until the template list has loaded.
  await screen.findByTestId('template-card-poll_created');
  return { i18n };
}

async function openTooltip(trigger: HTMLElement): Promise<string> {
  fireEvent.focus(trigger);
  const tooltip = await screen.findByRole('tooltip');
  return tooltip.textContent ?? '';
}

function expectNoRawTranslationKeys() {
  const text = document.body.textContent ?? '';
  expect(text.match(/admin\.emailTemplates\.[\w.]+/)?.[0], 'untranslated key rendered').toBeUndefined();
  expect(text.match(/common\.\w+/)?.[0], 'untranslated key rendered').toBeUndefined();
}

beforeAll(() => {
  // jsdom lacks the layout APIs Radix' tooltip positioning relies on.
  if (!('ResizeObserver' in globalThis)) {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
  }
});

afterEach(() => {
  cleanup();
});

describe.each(['de', 'en'] as const)('EmailTemplatesPanel rendered in %s', (language) => {
  const expected = EXPECTED[language];

  it('shows the translated page title and description', async () => {
    await renderPanel(language);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(expected.title);
    expect(screen.getByText(expected.description)).toBeTruthy();
    expectNoRawTranslationKeys();
  });

  it('shows translated template card titles and descriptions, not the API name', async () => {
    const { i18n } = await renderPanel(language);
    const card = screen.getByTestId('template-card-poll_created');
    expect(within(card).getByRole('heading', { level: 3 }).textContent).toBe(expected.pollCreatedName);
    expect(card.textContent).toContain(i18n.t('admin.emailTemplates.templateTypes.poll_created_desc'));
    expect(card.textContent).not.toContain(GERMAN_POLL_CREATED_NAME);

    for (const type of EMAIL_TEMPLATE_TYPES) {
      const typeCard = screen.getByTestId(`template-card-${type}`);
      const title = within(typeCard).getByRole('heading', { level: 3 }).textContent ?? '';
      expect(title, `${type} card title`).not.toBe('');
      expect(title, `${type} card title falls back to the API name`).not.toBe(`Vorlage ${type}`);
    }
  });

  it('shows the translated tooltip on the disabled theme import button', async () => {
    await renderPanel(language);
    const tooltipText = await openTooltip(screen.getByTestId('button-import-theme'));
    expect(tooltipText).toBe(expected.importThemeTooltip);
  });

  it('shows translated variable explanations as tooltips in the template editor', async () => {
    await renderPanel(language);
    fireEvent.click(screen.getByTestId('template-card-poll_created'));

    // Editor header uses the translated title, too.
    expect(await screen.findByText(expected.pollCreatedName)).toBeTruthy();
    expectNoRawTranslationKeys();

    const badge = screen.getByText('{{pollTitle}}');
    const tooltipText = await openTooltip(badge.parentElement as HTMLElement);
    expect(tooltipText).toContain(expected.pollTitleVariableTooltip);
    expect(tooltipText).toContain(expected.clickToInsert);
    if (language === 'en') {
      // The server only ships German variable descriptions; English must not fall back to them.
      const germanDescription = EMAIL_TEMPLATE_VARIABLES.poll_created.find((v) => v.key === 'pollTitle')!.description;
      expect(tooltipText).not.toContain(germanDescription);
    }
  });
});
