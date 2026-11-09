import type { Request } from 'express';
import { storage } from '../storage';
import { languageSettingsSchema, type EmailLanguage } from '@shared/schema';
import { normalizeEmailLanguage } from './emailI18n';

/** Header the web client sends with every API request to announce its UI language. */
export const CLIENT_LANGUAGE_HEADER = 'x-polly-language';

/**
 * The site's default language (Admin → Customize → Language). It is the
 * language for recipients whose own language is unknown, and the starting
 * language of new accounts that were created without a UI language.
 */
export async function getSiteDefaultLanguage(): Promise<EmailLanguage> {
  try {
    const settings = await storage.getCustomizationSettings();
    return normalizeEmailLanguage(settings.language?.defaultLanguage) ?? languageSettingsSchema.parse({}).defaultLanguage;
  } catch (error) {
    console.error('[Email] Failed to read the site default language:', error);
    return languageSettingsSchema.parse({}).defaultLanguage;
  }
}

/**
 * The UI language of the browser that made the request, if it announced one.
 * Only the explicit Polly header is trusted — Accept-Language is ignored so a
 * German browser showing the English UI still gets English mail.
 */
export function getRequestLanguage(
  req: Partial<Pick<Request, 'get' | 'headers'>> | undefined,
): EmailLanguage | undefined {
  if (!req) return undefined;
  // Prefer Express' case-insensitive lookup; fall back to the raw (lower-cased)
  // header map for minimal request objects.
  const value = typeof req.get === 'function'
    ? req.get(CLIENT_LANGUAGE_HEADER)
    : req.headers?.[CLIENT_LANGUAGE_HEADER];
  return normalizeEmailLanguage(Array.isArray(value) ? value[0] : value);
}

/**
 * Picks the language for one recipient:
 * 1. the language saved in the recipient's own account (registered users —
 *    updated whenever they switch the language in the menu or profile),
 * 2. the requester's current UI language — only for mails sent to the person
 *    who triggered them (e.g. a guest voting in the English UI),
 * 3. the UI language a guest last used when creating a poll or voting with
 *    this address,
 * 4. the site default language.
 */
export async function resolveEmailLanguage(
  recipientEmail: string | null | undefined | Array<string | null | undefined>,
  requesterLanguage?: EmailLanguage,
): Promise<EmailLanguage> {
  // Several addresses may identify the same person (e.g. old and new address
  // during an email change); the first one with a known language wins.
  const candidates = (Array.isArray(recipientEmail) ? recipientEmail : [recipientEmail])
    .filter((email): email is string => !!email);

  for (const email of candidates) {
    try {
      const user = await storage.getUserByEmail(email);
      const preference = normalizeEmailLanguage(user?.languagePreference);
      if (preference) return preference;
    } catch (error) {
      console.error('[Email] Failed to look up recipient language:', error);
    }
  }

  if (requesterLanguage) return requesterLanguage;

  for (const email of candidates) {
    try {
      const remembered = normalizeEmailLanguage(await storage.getLatestGuestLanguage(email));
      if (remembered) return remembered;
    } catch (error) {
      console.error('[Email] Failed to look up remembered guest language:', error);
    }
  }

  return getSiteDefaultLanguage();
}

/** Groups recipients by their resolved language, preserving input order within a group. */
export async function groupRecipientsByLanguage<T>(
  items: T[],
  getEmail: (item: T) => string | null | undefined,
): Promise<Map<EmailLanguage, T[]>> {
  const groups = new Map<EmailLanguage, T[]>();
  for (const item of items) {
    const lang = await resolveEmailLanguage(getEmail(item));
    const list = groups.get(lang);
    if (list) list.push(item);
    else groups.set(lang, [item]);
  }
  return groups;
}

/** Language a new account starts with: the UI language it was created in, else the site default. */
export async function initialAccountLanguage(requestLanguage?: EmailLanguage): Promise<EmailLanguage> {
  return requestLanguage ?? getSiteDefaultLanguage();
}
