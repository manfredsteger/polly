import type { PasswordPolicySettings } from '@shared/schema';

export const DEFAULT_PASSWORD_POLICY: PasswordPolicySettings = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
};

export const SPECIAL_CHARS_RE = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;

export function validatePasswordAgainstPolicy(
  password: string,
  policy: PasswordPolicySettings,
): string[] {
  const errors: string[] = [];
  if (password.length < policy.minLength) {
    errors.push(`Passwort muss mindestens ${policy.minLength} Zeichen lang sein`);
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Passwort muss mindestens einen Großbuchstaben enthalten');
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Passwort muss mindestens einen Kleinbuchstaben enthalten');
  }
  if (policy.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Passwort muss mindestens eine Zahl enthalten');
  }
  if (policy.requireSpecialChars && !SPECIAL_CHARS_RE.test(password)) {
    errors.push('Passwort muss mindestens ein Sonderzeichen enthalten');
  }
  return errors;
}
