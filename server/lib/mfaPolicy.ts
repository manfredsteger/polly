/**
 * Returns the effective adminMfaRequired value, applying the
 * MFA_ADMIN_REQUIRED environment-variable override when set to 'false'.
 *
 * Use this everywhere the stored adminMfaRequired flag is evaluated at
 * request time so that a redeployed environment variable is honoured
 * without a database change.
 */
export function getEffectiveAdminMfaRequired(stored: boolean): boolean {
  if (isAdminMfaEmergencyOverrideActive()) return false;
  return stored;
}

/**
 * Indicates whether the documented break-glass override is active.
 *
 * This is deliberately separate from getEffectiveAdminMfaRequired(): an
 * enrolled admin must still complete MFA when the stored organisation policy
 * is off. Only an explicit environment override may bypass their challenge.
 */
export function isAdminMfaEmergencyOverrideActive(): boolean {
  return process.env.MFA_ADMIN_REQUIRED === 'false';
}

/**
 * An enrolled factor must be verified after every browser primary login.
 * The break-glass environment override is intentionally limited to admins.
 */
export function requiresTotpChallenge(user: {
  totpEnabled?: boolean | null;
  role?: string | null;
}): boolean {
  return Boolean(user.totpEnabled) &&
    !(user.role === 'admin' && isAdminMfaEmergencyOverrideActive());
}
