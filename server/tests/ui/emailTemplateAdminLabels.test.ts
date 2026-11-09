import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createInstance, type TFunction } from 'i18next';
import {
  EMAIL_TEMPLATE_TYPES,
  EMAIL_TEMPLATE_VARIABLES,
  type EmailTemplateType,
} from '@shared/schema';
import { EmailTemplateService } from '../../services/emailTemplateService';
import {
  EMAIL_TEMPLATE_TYPE_ICONS,
  isKnownTemplateType,
  templateTypeDescriptionKey,
  templateTypeNameKey,
  templateVariableDescriptionKey,
} from '../../../client/src/components/admin/settings/emailTemplateTypes';

export const testMeta = {
  category: 'functional' as const,
  name: 'E-Mail-Vorlagen: Admin-Beschriftungen in jeder Sprache',
  description: 'Prüft, dass jede E-Mail-Vorlage und jede Vorlagen-Variable im Admin-Bereich in jeder UI-Sprache einen eigenen Namen und eine Beschreibung hat',
  severity: 'medium' as const,
};

const CLIENT_SRC = path.resolve(__dirname, '../../../client/src');
const LOCALES_DIR = path.join(CLIENT_SRC, 'locales');
const PANEL_FILE = path.join(CLIENT_SRC, 'components/admin/settings/EmailTemplatesPanel.tsx');

// Every UI language file is checked, so a new language is covered automatically.
const UI_LANGUAGES = fs.readdirSync(LOCALES_DIR)
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.replace(/\.json$/, ''))
  .sort();

const GERMAN_MARKERS = /[äöüßÄÖÜ]|\b(Umfrage|Abstimmung|Ersteller|Benachrichtigung|Bestätigung|Erinnerung|Einladung|Passwort|Stimme|Link zur|Name des|der|die|das|und|nach)\b/;

const ALL_VARIABLE_KEYS = [...new Set(
  EMAIL_TEMPLATE_TYPES.flatMap((type) => EMAIL_TEMPLATE_VARIABLES[type].map((variable) => variable.key)),
)].sort();

async function translatorFor(language: string): Promise<TFunction> {
  const resources = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${language}.json`), 'utf8'));
  const i18n = createInstance();
  await i18n.init({
    lng: language,
    resources: { [language]: { translation: resources } },
    interpolation: { escapeValue: false },
    // A missing key must surface as the key, not silently fall back to another language.
    fallbackLng: false,
  });
  return i18n.t.bind(i18n);
}

describe('Email template admin labels — every template type in every UI language', () => {
  it('finds the German and English UI languages', () => {
    expect(UI_LANGUAGES).toEqual(expect.arrayContaining(['de', 'en']));
  });

  it('has an icon entry for exactly the known template types', () => {
    expect(Object.keys(EMAIL_TEMPLATE_TYPE_ICONS).sort()).toEqual([...EMAIL_TEMPLATE_TYPES].sort());
    for (const type of EMAIL_TEMPLATE_TYPES) {
      expect(isKnownTemplateType(type), type).toBe(true);
    }
    expect(isKnownTemplateType('not_a_template')).toBe(false);
  });

  describe.each(UI_LANGUAGES.map((language) => [language]))('%s', (language) => {
    it('has a name and description for every template type', async () => {
      const t = await translatorFor(language);
      for (const type of EMAIL_TEMPLATE_TYPES) {
        for (const key of [templateTypeNameKey(type), templateTypeDescriptionKey(type)]) {
          const value = t(key);
          expect(value, `missing ${key} in ${language}.json`).not.toBe(key);
          expect(String(value).trim(), `empty ${key} in ${language}.json`).not.toBe('');
        }
      }
    });

    it('has a description for every template variable', async () => {
      const t = await translatorFor(language);
      for (const variableKey of ALL_VARIABLE_KEYS) {
        const key = templateVariableDescriptionKey(variableKey);
        const value = t(key);
        expect(value, `missing ${key} in ${language}.json`).not.toBe(key);
        expect(String(value).trim(), `empty ${key} in ${language}.json`).not.toBe('');
      }
    });
  });

  it('shows English names, descriptions and variable explanations in the English UI', async () => {
    const t = await translatorFor('en');
    const texts: Array<[string, string]> = [];
    for (const type of EMAIL_TEMPLATE_TYPES) {
      texts.push([templateTypeNameKey(type), t(templateTypeNameKey(type))]);
      texts.push([templateTypeDescriptionKey(type), t(templateTypeDescriptionKey(type))]);
    }
    for (const variableKey of ALL_VARIABLE_KEYS) {
      texts.push([templateVariableDescriptionKey(variableKey), t(templateVariableDescriptionKey(variableKey))]);
    }
    for (const [key, value] of texts) {
      expect(value.match(GERMAN_MARKERS)?.[0], `${key} looks German: "${value}"`).toBeUndefined();
    }
  });

  // Regression: the English admin UI showed "Neue Abstimmung (Ersteller)" without
  // a description because the panel fell back to the German template name.
  it('never needs the German template name as the card title in the English UI', async () => {
    const t = await translatorFor('en');
    for (const type of EMAIL_TEMPLATE_TYPES) {
      const germanName = EmailTemplateService.getDefaultTemplate(type as EmailTemplateType, 'de').name;
      expect(t(templateTypeNameKey(type)), type).not.toBe(germanName);
    }
  });

  it('renders the template cards and variable hints through the shared translation keys', () => {
    const panel = fs.readFileSync(PANEL_FILE, 'utf8');
    // Cards and the editor header use the shared, type-checked label helper…
    expect(panel).toContain('templateTypeInfo(template.type, template.name)');
    expect(panel).toContain('templateTypeNameKey(type)');
    expect(panel).toContain('templateTypeDescriptionKey(type)');
    // …and variable hints are translated instead of showing the server's German text.
    expect(panel).toContain('templateVariableDescriptionKey(variable.key)');
    expect(panel).not.toMatch(/<p>\{variable\.description\}<\/p>/);
    // No second, hand-maintained per-type label table that could miss a type again.
    expect(panel).not.toMatch(/admin\.emailTemplates\.templateTypes\.[a-z_]+'/);
  });
});
