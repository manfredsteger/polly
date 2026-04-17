import { describe, it, expect } from 'vitest';
import { shouldUseSecureCookies } from '../../utils/sessionConfig';

describe('shouldUseSecureCookies', () => {
  describe('plain HTTP deployments (regression guard)', () => {
    it('returns false for default Docker setup on http://localhost:3080', () => {
      // Regression: previously the cookie was marked Secure whenever
      // NODE_ENV=production, which silently broke login in Docker because
      // browsers drop Secure cookies on plain HTTP.
      expect(
        shouldUseSecureCookies({
          resolvedAppUrl: 'http://localhost:3080',
        }),
      ).toBe(false);
    });

    it('returns false for plain-HTTP custom host', () => {
      expect(
        shouldUseSecureCookies({
          resolvedAppUrl: 'http://polly.internal.lan',
        }),
      ).toBe(false);
    });

    it('returns false for plain-HTTP host with explicit FORCE_HTTPS=false', () => {
      expect(
        shouldUseSecureCookies({
          resolvedAppUrl: 'http://localhost:3080',
          forceHttps: 'false',
        }),
      ).toBe(false);
    });
  });

  describe('HTTPS deployments', () => {
    it('returns true when APP_URL is https://', () => {
      expect(
        shouldUseSecureCookies({
          resolvedAppUrl: 'https://poll.example.com',
        }),
      ).toBe(true);
    });

    it('returns true when FORCE_HTTPS=true (e.g. behind TLS-terminating proxy)', () => {
      expect(
        shouldUseSecureCookies({
          resolvedAppUrl: 'http://localhost:3080',
          forceHttps: 'true',
        }),
      ).toBe(true);
    });
  });

  describe('Replit hosting', () => {
    it('returns true when resolved URL contains "replit"', () => {
      expect(
        shouldUseSecureCookies({
          resolvedAppUrl: 'https://my-app.replit.app',
        }),
      ).toBe(true);
    });

    it('returns true when REPLIT_DEV_DOMAIN is set', () => {
      expect(
        shouldUseSecureCookies({
          resolvedAppUrl: 'http://localhost:5000',
          replitDevDomain: 'abc.replit.dev',
        }),
      ).toBe(true);
    });

    it('returns true when REPL_ID is set', () => {
      expect(
        shouldUseSecureCookies({
          resolvedAppUrl: 'http://localhost:5000',
          replId: 'some-repl-id',
        }),
      ).toBe(true);
    });
  });
});
