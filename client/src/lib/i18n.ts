import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { de as deLocale, enUS as enLocale } from 'date-fns/locale';

import de from '../locales/de.json';
import en from '../locales/en.json';

export const supportedLanguages = ['de', 'en'] as const;
export type SupportedLanguage = typeof supportedLanguages[number];

export const languageNames: Record<SupportedLanguage, string> = {
  de: 'Deutsch',
  en: 'English'
};

let systemDefaultLanguage: SupportedLanguage = 'en';

async function fetchSystemLanguage(): Promise<SupportedLanguage> {
  try {
    const response = await fetch('/api/v1/system/language');
    if (response.ok) {
      const data = await response.json();
      const lang = data?.defaultLanguage;
      if (lang === 'de' || lang === 'en') {
        return lang;
      }
    }
  } catch (_e) {}
  return 'en';
}

export function getSystemDefaultLanguage(): SupportedLanguage {
  return systemDefaultLanguage;
}

export async function initI18n() {
  systemDefaultLanguage = await fetchSystemLanguage();

  await i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        de: { translation: de },
        en: { translation: en }
      },
      fallbackLng: systemDefaultLanguage,
      supportedLngs: supportedLanguages,
      interpolation: {
        escapeValue: false
      },
      detection: {
        order: ['localStorage'],
        caches: ['localStorage'],
        lookupLocalStorage: 'polly-language'
      }
    });

  return i18n;
}

export function applySystemLanguageIfNoPreference() {
  const stored = localStorage.getItem('polly-language');
  if (!stored && i18n.language !== systemDefaultLanguage) {
    i18n.changeLanguage(systemDefaultLanguage);
  }
}

export const getDateLocale = () => {
  return i18n.language === 'de' ? deLocale : enLocale;
};

export default i18n;
