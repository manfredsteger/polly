/**
 * Returns the effective adminMfaRequired value, applying the
 * MFA_ADMIN_REQUIRED environment-variable override when set to 'false'.
 *
 * Use this everywhere the stored adminMfaRequired flag is evaluated at
 * request time so that a redeployed environment variable is honoured
 * without a database change.
 */
export function getEffectiveAdminMfaRequired(stored: boolean): boolean {
  if (process.env.MFA_ADMIN_REQUIRED === 'false') return false;
  return stored;
}
