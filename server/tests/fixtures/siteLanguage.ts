import { afterAll, beforeAll } from 'vitest';
import { storage } from '../../storage';

const SITE_LANGUAGE_KEY = 'customization_language';

/**
 * Pins the site default language (Admin → Customize → Language) for one test
 * file and restores the previous value afterwards. Mails to recipients without
 * a known language use this language, so tests that assert German (or English)
 * mail content must state which installation they simulate.
 */
export function useSiteDefaultLanguage(language: 'de' | 'en') {
  let previous: unknown;
  beforeAll(async () => {
    previous = (await storage.getSetting(SITE_LANGUAGE_KEY))?.value;
    await storage.setSetting({ key: SITE_LANGUAGE_KEY, value: { defaultLanguage: language } });
  });
  afterAll(async () => {
    if (previous === undefined) await storage.deleteSetting(SITE_LANGUAGE_KEY);
    else await storage.setSetting({ key: SITE_LANGUAGE_KEY, value: previous });
  });
}
