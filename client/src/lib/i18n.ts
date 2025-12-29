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

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      de: { translation: de },
      en: { translation: en }
    },
    fallbackLng: 'en',
    supportedLngs: supportedLanguages,
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'polly-language'
    }
  });

export const getDateLocale = () => {
  return i18n.language === 'de' ? deLocale : enLocale;
};

export default i18n;
