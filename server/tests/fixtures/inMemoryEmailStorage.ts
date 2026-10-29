import { afterAll, beforeAll, expect, vi, type MockInstance } from 'vitest';
import { storage } from '../../storage';
import {
  customizationSettingsSchema,
  DEFAULT_EMAIL_LANGUAGE,
  EMAIL_LANGUAGES,
  type CustomizationSettings,
  type EmailLanguage,
  type EmailTemplate,
  type EmailTemplateType,
} from '@shared/schema';

/**
 * Keeps every email-template read and write of one test file in memory.
 *
 * The template service reads/writes templates, the email theme, footers and the
 * branding through `storage`. These spies answer all of those calls from local
 * maps, so a test can save customized templates, import themes or change the
 * footer without touching the shared test database. After the file finishes,
 * the spies are removed and the real database is checked to be unchanged.
 */
export interface InMemoryEmailStorage {
  settings: Map<string, unknown>;
  templates: Map<string, EmailTemplate>;
  customization: CustomizationSettings;
  /** Replace the branding/theme settings the service sees. */
  setCustomization(input: Record<string, unknown>): void;
  /** Forget all stored templates, settings and customization overrides. */
  reset(): void;
}

const DEFAULT_CUSTOMIZATION_INPUT = {
  branding: { siteName: 'Polly', siteNameAccent: 'Lab', logoUrl: null },
  theme: { primaryColor: '#7a3800', secondaryColor: '#1e40af' },
};

function templateKey(type: string, lang: string | null | undefined): string {
  return `${type}:${lang ?? DEFAULT_EMAIL_LANGUAGE}`;
}

async function snapshotPersistedEmailState() {
  const settingKeys = ['email_theme', 'email_footer', ...EMAIL_LANGUAGES.filter((l) => l !== 'de').map((l) => `email_footer_${l}`)];
  const settings: Record<string, unknown> = {};
  for (const key of settingKeys) settings[key] = (await storage.getSetting(key))?.value ?? null;
  const templates: Record<string, unknown> = {};
  for (const lang of EMAIL_LANGUAGES) {
    templates[lang] = (await storage.getEmailTemplates(lang))
      .map((t) => ({ type: t.type, language: t.language, subject: t.subject, textContent: t.textContent, htmlContent: t.htmlContent }))
      .sort((a, b) => a.type.localeCompare(b.type));
  }
  return { settings, templates };
}

export function useInMemoryEmailStorage(): InMemoryEmailStorage {
  const state: InMemoryEmailStorage = {
    settings: new Map(),
    templates: new Map(),
    customization: customizationSettingsSchema.parse(DEFAULT_CUSTOMIZATION_INPUT),
    setCustomization(input) {
      state.customization = customizationSettingsSchema.parse(input);
    },
    reset() {
      state.settings.clear();
      state.templates.clear();
      state.customization = customizationSettingsSchema.parse(DEFAULT_CUSTOMIZATION_INPUT);
    },
  };

  let nextId = 1;
  let persistedBefore: Awaited<ReturnType<typeof snapshotPersistedEmailState>>;
  const spies: MockInstance[] = [];

  beforeAll(async () => {
    persistedBefore = await snapshotPersistedEmailState();

    spies.push(
      vi.spyOn(storage, 'getSetting').mockImplementation(async (key: string) =>
        state.settings.has(key)
          ? ({ id: 0, key, value: state.settings.get(key), description: null, updatedAt: new Date() } as any)
          : undefined),
      vi.spyOn(storage, 'setSetting').mockImplementation(async (setting: any) => {
        state.settings.set(setting.key, setting.value);
        return { id: 0, description: null, updatedAt: new Date(), ...setting };
      }),
      vi.spyOn(storage, 'deleteSetting').mockImplementation(async (key: string) => {
        state.settings.delete(key);
      }),
      vi.spyOn(storage, 'getCustomizationSettings').mockImplementation(async () => state.customization),
      vi.spyOn(storage, 'getEmailTemplate').mockImplementation(async (type: EmailTemplateType, lang?: EmailLanguage) =>
        state.templates.get(templateKey(type, lang))),
      vi.spyOn(storage, 'getEmailTemplates').mockImplementation(async (lang?: EmailLanguage) =>
        [...state.templates.values()].filter((t) => !lang || (t.language ?? DEFAULT_EMAIL_LANGUAGE) === lang)),
      vi.spyOn(storage, 'upsertEmailTemplate').mockImplementation(async (input: any) => {
        const key = templateKey(input.type, input.language);
        const existing = state.templates.get(key);
        const saved = {
          id: existing?.id ?? nextId++,
          htmlContent: null,
          textContent: null,
          isDefault: false,
          isActive: true,
          createdAt: existing?.createdAt ?? new Date(),
          ...input,
          updatedAt: new Date(),
        } as EmailTemplate;
        state.templates.set(key, saved);
        return saved;
      }),
      vi.spyOn(storage, 'resetEmailTemplate').mockImplementation(async (type: EmailTemplateType, lang?: EmailLanguage) => {
        const key = templateKey(type, lang);
        const existing = state.templates.get(key);
        state.templates.delete(key);
        return existing;
      }),
    );
  });

  afterAll(async () => {
    for (const spy of spies) spy.mockRestore();
    spies.length = 0;
    // Nothing a test wrote may have reached the shared database.
    expect(await snapshotPersistedEmailState()).toEqual(persistedBefore);
  });

  return state;
}

/** Store a customized template directly, bypassing saveTemplate's HTML generation. */
export function storeTemplate(
  state: InMemoryEmailStorage,
  template: Partial<EmailTemplate> & { type: EmailTemplateType; language?: EmailLanguage | null },
): void {
  state.templates.set(templateKey(template.type, template.language), {
    id: 900,
    name: template.type,
    subject: '',
    jsonContent: {},
    htmlContent: null,
    textContent: null,
    variables: [],
    isDefault: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    language: DEFAULT_EMAIL_LANGUAGE,
    ...template,
  } as EmailTemplate);
}
