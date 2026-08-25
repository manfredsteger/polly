import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock openid-client so initializeOIDC's discovery call can be inspected
vi.mock('openid-client', () => ({
  discovery: vi.fn(),
  tokenIntrospection: vi.fn(),
}));

import * as client from 'openid-client';

const KEYCLOAK_ENV_KEYS = [
  'KEYCLOAK_REALM',
  'KEYCLOAK_AUTH_SERVER_URL',
  'KEYCLOAK_URL',
  'KEYCLOAK_ISSUER_URL',
  'KEYCLOAK_CLIENT_ID',
  'KEYCLOAK_CLIENT_SECRET',
  'KEYCLOAK_ADMIN_CLIENT_ID',
  'KEYCLOAK_ADMIN_CLIENT_SECRET',
] as const;

// tokenService caches initialization state at module level, so load a fresh
// module instance per test.
async function freshTokenService() {
  vi.resetModules();
  const mod = await import('../../services/tokenService');
  return mod.tokenService;
}

describe('tokenService issuer URL resolution (KEYCLOAK_ISSUER_URL)', () => {
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
    vi.unstubAllGlobals();
  });

  it('legacy fallback: discovers against {serverUrl}/realms/{realm} when ISSUER_URL is unset', async () => {
    process.env.KEYCLOAK_REALM = 'myrealm';
    process.env.KEYCLOAK_AUTH_SERVER_URL = 'https://keycloak.example.com';
    process.env.KEYCLOAK_CLIENT_ID = 'polly';
    vi.mocked(client.discovery).mockResolvedValue({} as any);

    const tokenService = await freshTokenService();
    const ok = await tokenService.initializeOIDC();
    expect(ok).toBe(true);
    const [issuerUrl] = vi.mocked(client.discovery).mock.calls[0];
    expect((issuerUrl as URL).href).toBe('https://keycloak.example.com/realms/myrealm');
  });

  it('issuer-only config (Authentik): discovers against KEYCLOAK_ISSUER_URL', async () => {
    process.env.KEYCLOAK_ISSUER_URL = 'https://auth.example.com/application/o/polly/';
    process.env.KEYCLOAK_CLIENT_ID = 'polly-client-id';
    vi.mocked(client.discovery).mockResolvedValue({} as any);

    const tokenService = await freshTokenService();
    const ok = await tokenService.initializeOIDC();
    expect(ok).toBe(true);
    const [issuerUrl] = vi.mocked(client.discovery).mock.calls[0];
    expect((issuerUrl as URL).href).toBe('https://auth.example.com/application/o/polly/');
  });

  it('override precedence: ISSUER_URL wins over realm/serverUrl construction', async () => {
    process.env.KEYCLOAK_REALM = 'otherrealm';
    process.env.KEYCLOAK_AUTH_SERVER_URL = 'https://old.example.com';
    process.env.KEYCLOAK_ISSUER_URL = 'https://keycloak.example.com/realms/myrealm';
    process.env.KEYCLOAK_CLIENT_ID = 'polly';
    vi.mocked(client.discovery).mockResolvedValue({} as any);

    const tokenService = await freshTokenService();
    await tokenService.initializeOIDC();
    const [issuerUrl] = vi.mocked(client.discovery).mock.calls[0];
    expect((issuerUrl as URL).href).toBe('https://keycloak.example.com/realms/myrealm');
  });

  it('stays disabled without any OIDC configuration', async () => {
    const tokenService = await freshTokenService();
    const ok = await tokenService.initializeOIDC();
    expect(ok).toBe(false);
    expect(client.discovery).not.toHaveBeenCalled();
  });

  describe('checkEmailExistsInKeycloak guard for issuer-only configs', () => {
    it('returns false without any Keycloak request when realm/serverUrl are missing', async () => {
      process.env.KEYCLOAK_ISSUER_URL = 'https://auth.example.com/application/o/polly/';
      process.env.KEYCLOAK_CLIENT_ID = 'polly-client-id';
      process.env.KEYCLOAK_CLIENT_SECRET = 'authentik-secret';

      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const tokenService = await freshTokenService();
      const exists = await tokenService.checkEmailExistsInKeycloak('user@example.com');
      expect(exists).toBe(false);
      // No malformed "undefined/realms/undefined" request may be issued
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('still performs the Admin API lookup for full Keycloak configs', async () => {
      process.env.KEYCLOAK_REALM = 'myrealm';
      process.env.KEYCLOAK_AUTH_SERVER_URL = 'https://keycloak.example.com';
      process.env.KEYCLOAK_CLIENT_ID = 'polly';
      process.env.KEYCLOAK_CLIENT_SECRET = 'secret123';

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 'user-1' }],
        });
      vi.stubGlobal('fetch', fetchMock);

      const tokenService = await freshTokenService();
      const exists = await tokenService.checkEmailExistsInKeycloak('user@example.com');
      expect(exists).toBe(true);
      expect(fetchMock.mock.calls[0][0]).toBe(
        'https://keycloak.example.com/realms/myrealm/protocol/openid-connect/token'
      );
      expect(fetchMock.mock.calls[1][0]).toContain(
        'https://keycloak.example.com/admin/realms/myrealm/users?email='
      );
    });
  });
});
