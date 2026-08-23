import { afterEach, describe, expect, it } from 'vitest';
import { requiresTotpChallenge } from '../../lib/mfaPolicy';

describe('MFA challenge policy', () => {
  afterEach(() => {
    delete process.env.MFA_ADMIN_REQUIRED;
  });

  it('requires TOTP for every enrolled user by default', () => {
    expect(requiresTotpChallenge({ role: 'user', totpEnabled: true })).toBe(true);
    expect(requiresTotpChallenge({ role: 'admin', totpEnabled: true })).toBe(true);
  });

  it('does not require TOTP when no factor is enrolled', () => {
    expect(requiresTotpChallenge({ role: 'user', totpEnabled: false })).toBe(false);
    expect(requiresTotpChallenge({ role: 'admin', totpEnabled: null })).toBe(false);
  });

  it('limits the emergency override to enrolled admins', () => {
    process.env.MFA_ADMIN_REQUIRED = 'false';

    expect(requiresTotpChallenge({ role: 'admin', totpEnabled: true })).toBe(false);
    expect(requiresTotpChallenge({ role: 'user', totpEnabled: true })).toBe(true);
  });
});