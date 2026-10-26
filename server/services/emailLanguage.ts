import type { Request } from 'express';
import { storage } from '../storage';
import {
  DEFAULT_EMAIL_LANGUAGE,
  emailLanguageSettingsSchema,
  type EmailLanguage,
  type EmailLanguageSettings,
} from '@shared/schema';
import { normalizeEmailLanguage } from './emailI18n';

export const EMAIL_LANGUAGE_SETTING_KEY = 'email_language';

/** Header the web client sends with every API request to announce its UI language. */
export const CLIENT_LANGUAGE_HEADER = 'x-polly-language';

export async function getEmailLanguageSettings(): Promise<EmailLanguageSettings> {
  const setting = await storage.getSetting(EMAIL_LANGUAGE_SETTING_KEY);
  const parsed = emailLanguageSettingsSchema.safeParse(setting?.value ?? {});
  return parsed.success ? parsed.data : { defaultLanguage: DEFAULT_EMAIL_LANGUAGE };
}

export async function setEmailLanguageSettings(settings: EmailLanguageSettings): Promise<EmailLanguageSettings> {
  const value = emailLanguageSettingsSchema.parse(settings);
  await storage.setSetting({ key: EMAIL_LANGUAGE_SETTING_KEY, value });
  return value;
}

export async function getDefaultEmailLanguage(): Promise<EmailLanguage> {
  try {
    return (await getEmailLanguageSettings()).defaultLanguage;
  } catch (error) {
    console.error('[Email] Failed to read email language setting, using default:', error);
    return DEFAULT_EMAIL_LANGUAGE;
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
 * 1. the language saved in the recipient's own account (registered users),
 * 2. the requester's UI language — only for mails sent to the person who
 *    triggered them (e.g. a guest voting in the English UI),
 * 3. the admin-configured default email language,
 * 4. German.
 */
export async function resolveEmailLanguage(
  recipientEmail: string | null | undefined | Array<string | null | undefined>,
  requesterLanguage?: EmailLanguage,
): Promise<EmailLanguage> {
  // Several addresses may identify the same account (e.g. old and new address
  // during an email change); the first one that belongs to an account wins.
  const candidates = Array.isArray(recipientEmail) ? recipientEmail : [recipientEmail];
  for (const email of candidates) {
    if (!email) continue;
    try {
      const user = await storage.getUserByEmail(email);
      const preference = normalizeEmailLanguage(user?.languagePreference);
      if (preference) return preference;
    } catch (error) {
      console.error('[Email] Failed to look up recipient language:', error);
    }
  }
  if (requesterLanguage) return requesterLanguage;
  return getDefaultEmailLanguage();
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
