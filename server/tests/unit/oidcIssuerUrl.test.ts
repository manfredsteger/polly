import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock openid-client so initializeKeycloak's discovery call can be inspected
vi.mock('openid-client', () => ({
  discovery: vi.fn(),
}));

import * as client from 'openid-client';
import { authService, resolveIssuerUrl, extractRoleFromClaims } from '../../services/authService';

// authService binds openid-client at import time; when another test file loaded
// the real module first, the top-level mock is not picked up. Load a fresh
// instance per discovery test so the mock is guaranteed to apply.
async function freshAuthService() {
  vi.resetModules();
  const mod = await import('../../services/authService');
  return mod.authService;
}

const KEYCLOAK_ENV_KEYS = [
  'KEYCLOAK_REALM',
  'KEYCLOAK_AUTH_SERVER_URL',
  'KEYCLOAK_URL',
  'KEYCLOAK_ISSUER_URL',
  'KEYCLOAK_CLIENT_ID',
  'KEYCLOAK_CLIENT_SECRET',
] as const;

describe('OIDC issuer URL resolution (KEYCLOAK_ISSUER_URL / Authentik support)', () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of KEYCLOAK_ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
    vi.mocked(client.discovery).mockReset();
  });

  afterEach(() => {
    for (const key of KEYCLOAK_ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
    vi.restoreAllMocks();
  });

  describe('resolveIssuerUrl', () => {
    it('falls back to Keycloak realm construction when no issuerUrl is set', () => {
      expect(
        resolveIssuerUrl({ serverUrl: 'https://keycloak.example.com', realm: 'myrealm' })
      ).toBe('https://keycloak.example.com/realms/myrealm');
    });

    it('prefers explicit issuerUrl over realm construction', () => {
      expect(
        resolveIssuerUrl({
          issuerUrl: 'https://auth.example.com/application/o/polly/',
          serverUrl: 'https://keycloak.example.com',
          realm: 'myrealm',
        })
      ).toBe('https://auth.example.com/application/o/polly/');
    });

    it('works with issuerUrl only (realm/serverUrl unset)', () => {
      expect(
        resolveIssuerUrl({ issuerUrl: 'https://auth.example.com/application/o/polly/' })
      ).toBe('https://auth.example.com/application/o/polly/');
    });

    it('returns empty string for null or incomplete config', () => {
      expect(resolveIssuerUrl(null)).toBe('');
      expect(resolveIssuerUrl({ serverUrl: 'https://keycloak.example.com' })).toBe('');
      expect(resolveIssuerUrl({ realm: 'myrealm' })).toBe('');
    });
  });

  describe('Test 1: existing Keycloak setup (realm + serverUrl, no ISSUER_URL)', () => {
    it('getDisplayConfig reports the Keycloak-constructed issuer unchanged', () => {
      process.env.KEYCLOAK_REALM = 'myrealm';
      process.env.KEYCLOAK_AUTH_SERVER_URL = 'https://keycloak.example.com';
      process.env.KEYCLOAK_CLIENT_ID = 'polly';
      process.env.KEYCLOAK_CLIENT_SECRET = 'secret123';

      const display = authService.getDisplayConfig();
      expect(display.configured).toBe(true);
      expect(display.issuerUrl).toBe('https://keycloak.example.com/realms/myrealm');
      expect(display.clientId).toBe('polly');
      expect(display.hasClientSecret).toBe(true);
    });

    it('initializeKeycloak discovers against the Keycloak-constructed issuer', async () => {
      process.env.KEYCLOAK_REALM = 'myrealm';
      process.env.KEYCLOAK_AUTH_SERVER_URL = 'https://keycloak.example.com';
      process.env.KEYCLOAK_CLIENT_ID = 'polly';
      vi.mocked(client.discovery).mockResolvedValue({} as any);

      const service = await freshAuthService();
      const ok = await service.initializeKeycloak();
      expect(ok).toBe(true);
      const [issuerUrl, clientId] = vi.mocked(client.discovery).mock.calls[0];
      expect((issuerUrl as URL).href).toBe('https://keycloak.example.com/realms/myrealm');
      expect(clientId).toBe('polly');
    });
  });

  describe('Test 2: explicit KEYCLOAK_ISSUER_URL (realm/serverUrl optional)', () => {
    it('is configured with ISSUER_URL + client id only', () => {
      process.env.KEYCLOAK_ISSUER_URL = 'https://keycloak.example.com/realms/myrealm';
      process.env.KEYCLOAK_CLIENT_ID = 'polly';
      process.env.KEYCLOAK_CLIENT_SECRET = 'secret123';

      const display = authService.getDisplayConfig();
      expect(display.configured).toBe(true);
      expect(display.issuerUrl).toBe('https://keycloak.example.com/realms/myrealm');
    });

    it('ISSUER_URL overrides realm construction when both are set', () => {
      process.env.KEYCLOAK_REALM = 'otherrealm';
      process.env.KEYCLOAK_AUTH_SERVER_URL = 'https://old.example.com';
      process.env.KEYCLOAK_ISSUER_URL = 'https://keycloak.example.com/realms/myrealm';
      process.env.KEYCLOAK_CLIENT_ID = 'polly';

      expect(authService.getDisplayConfig().issuerUrl).toBe(
        'https://keycloak.example.com/realms/myrealm'
      );
    });

    it('remains unconfigured without ISSUER_URL when realm/serverUrl are missing', () => {
      process.env.KEYCLOAK_CLIENT_ID = 'polly';
      expect(authService.getDisplayConfig().configured).toBe(false);
    });
  });

  describe('Test 3: Authentik provider (issuer with path and trailing slash)', () => {
    it('initializeKeycloak discovers against the Authentik issuer', async () => {
      process.env.KEYCLOAK_ISSUER_URL = 'https://auth.example.com/application/o/polly/';
      process.env.KEYCLOAK_CLIENT_ID = 'polly-client-id';
      process.env.KEYCLOAK_CLIENT_SECRET = 'authentik-secret';
      vi.mocked(client.discovery).mockResolvedValue({} as any);

      const service = await freshAuthService();
      const ok = await service.initializeKeycloak();
      expect(ok).toBe(true);
      const [issuerUrl] = vi.mocked(client.discovery).mock.calls[0];
      expect((issuerUrl as URL).href).toBe('https://auth.example.com/application/o/polly/');
    });

    it('testOidcConnection builds the well-known URL without double slashes', async () => {
      process.env.KEYCLOAK_ISSUER_URL = 'https://auth.example.com/application/o/polly/';
      process.env.KEYCLOAK_CLIENT_ID = 'polly-client-id';

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ issuer: 'https://auth.example.com/application/o/polly/' }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await authService.testOidcConnection();
      expect(result.success).toBe(true);
      expect(fetchMock.mock.calls[0][0]).toBe(
        'https://auth.example.com/application/o/polly/.well-known/openid-configuration'
      );
    });

    it('testOidcConnection uses the Keycloak well-known URL when ISSUER_URL is unset', async () => {
      process.env.KEYCLOAK_REALM = 'myrealm';
      process.env.KEYCLOAK_AUTH_SERVER_URL = 'https://keycloak.example.com';
      process.env.KEYCLOAK_CLIENT_ID = 'polly';

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ issuer: 'https://keycloak.example.com/realms/myrealm' }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await authService.testOidcConnection();
      expect(result.success).toBe(true);
      expect(fetchMock.mock.calls[0][0]).toBe(
        'https://keycloak.example.com/realms/myrealm/.well-known/openid-configuration'
      );
    });
  });

  describe('Test 4: role mapping (extractRoleFromClaims regression)', () => {
    it('extracts role from Keycloak realm_access.roles', () => {
      expect(extractRoleFromClaims({ realm_access: { roles: ['admin'] } })).toBe('admin');
      expect(extractRoleFromClaims({ realm_access: { roles: ['polly-manager'] } })).toBe('manager');
    });

    it('extracts role from Keycloak resource_access[client].roles', () => {
      expect(
        extractRoleFromClaims({ resource_access: { polly: { roles: ['manager'] } } })
      ).toBe('manager');
      expect(
        extractRoleFromClaims({ resource_access: { polly: { roles: ['polly-admin'] } } })
      ).toBe('admin');
    });

    it('extracts role from a custom string "role" claim (Authentik property mapper)', () => {
      expect(extractRoleFromClaims({ role: 'admin' })).toBe('admin');
      expect(extractRoleFromClaims({ role: 'polly-user' })).toBe('user');
    });

    it('extracts role from a custom array "roles" claim', () => {
      expect(extractRoleFromClaims({ roles: ['manager'] })).toBe('manager');
      expect(extractRoleFromClaims({ roles: ['polly-admin', 'something-else'] })).toBe('admin');
    });

    it('returns null for unknown roles (caller defaults to user)', () => {
      expect(extractRoleFromClaims({ role: 'superuser' })).toBeNull();
      expect(extractRoleFromClaims({})).toBeNull();
    });
  });
});
