import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('openid-client', () => ({
  discovery: vi.fn(),
  tokenIntrospection: vi.fn(),
}));
import * as client from 'openid-client';
let storage: typeof import('../../storage').storage;
let tokenService: typeof import('../../services/tokenService').tokenService;

const claims = { active: true, sub: 'oidc-subject', email: 'voter@example.test' };
const user = { id: 123, role: 'user', emailVerified: true, keycloakId: claims.sub };

describe('OIDC access-token validation', () => {
  beforeAll(async () => {
    // OIDC discovery is cached at module scope; other files may already have
    // initialized it as disabled. Load storage from the same fresh module graph.
    vi.resetModules();
    ({ storage } = await import('../../storage'));
    ({ tokenService } = await import('../../services/tokenService'));
    vi.stubEnv('KEYCLOAK_CLIENT_ID', 'test-client');
    vi.stubEnv('KEYCLOAK_ISSUER_URL', 'https://issuer.example.test');
    vi.mocked(client.discovery).mockResolvedValue({} as any);
    await tokenService.initializeOIDC();
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  beforeEach(() => {
    vi.stubEnv('KEYCLOAK_CLIENT_ID', 'test-client');
    vi.stubEnv('KEYCLOAK_ISSUER_URL', 'https://issuer.example.test');
    vi.mocked(client.tokenIntrospection).mockReset().mockResolvedValue(claims as any);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(storage, 'getUserByKeycloakId').mockResolvedValue(user as any);
    vi.spyOn(storage, 'getUserByEmail').mockResolvedValue(undefined);
    vi.spyOn(storage, 'createUser').mockResolvedValue(user as any);
    vi.spyOn(storage, 'updateUser').mockImplementation(async (_id, update) => ({ ...user, ...update }) as any);
    vi.spyOn(storage, 'updateUserLastLogin').mockResolvedValue(undefined as any);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('reuses discovery and returns the existing user without unnecessary writes', async () => {
    expect(await tokenService.initializeOIDC()).toBe(true);
    expect(tokenService.isOIDCEnabled()).toBe(true);
    expect(await tokenService.validateToken('access-token')).toEqual({ valid: true, userId: 123, user });
    expect(client.tokenIntrospection).toHaveBeenCalledWith(expect.anything(), 'access-token');
    expect(storage.getUserByEmail).not.toHaveBeenCalled();
    expect(storage.updateUser).not.toHaveBeenCalled();
    expect(storage.updateUserLastLogin).toHaveBeenCalledWith(123);
  });
  it.each([
    [{ active: false }, 'TOKEN_INACTIVE'],
    [{ sub: '' }, 'MISSING_CLAIMS'],
    [{ email: '' }, 'MISSING_CLAIMS'],
    [{ exp: 1 }, 'TOKEN_EXPIRED'],
  ])('rejects invalid claims before accessing users: %s', async (overrides, errorCode) => {
    vi.mocked(client.tokenIntrospection).mockResolvedValue({ ...claims, ...overrides } as any);
    expect(await tokenService.validateAccessToken('invalid')).toMatchObject({ valid: false, errorCode });
    expect(storage.getUserByKeycloakId).not.toHaveBeenCalled();
    expect(storage.updateUserLastLogin).not.toHaveBeenCalled();
  });
  it('rejects configuration removed after discovery', async () => {
    vi.stubEnv('KEYCLOAK_CLIENT_ID', '');
    expect(await tokenService.validateAccessToken('token')).toMatchObject({ valid: false, errorCode: 'CONFIG_MISSING' });
    expect(client.tokenIntrospection).not.toHaveBeenCalled();
  });
  it.each([
    [{ role: 'polly-manager', realm_access: { roles: ['admin'] } }, 'manager'],
    [{ role: 'unknown', realm_access: { roles: ['user', 'polly-admin'] } }, 'admin'],
    [{ realm_access: { roles: ['polly-manager', 'user'] } }, 'manager'],
    [{ resource_access: { empty: {}, app: { roles: ['polly-admin'] } } }, 'admin'],
    [{ roles: ['user', 'polly-manager'] }, 'manager'],
    [{ role: 'admin' }, 'admin'],
    [{ role: 'unrecognized', roles: ['external-role'] }, 'user'],
    [{}, 'user'],
  ])('applies role precedence and normalization %#', async (roleClaims, expectedRole) => {
    vi.mocked(storage.getUserByKeycloakId).mockResolvedValue(undefined);
    vi.mocked(client.tokenIntrospection).mockResolvedValue({ ...claims, ...roleClaims } as any);
    const result = await tokenService.validateAccessToken('token');
    expect(result.valid).toBe(true);
    expect(storage.createUser).toHaveBeenCalledWith({
      username: 'voter', email: claims.email, name: claims.email,
      role: expectedRole, keycloakId: claims.sub, provider: 'keycloak', emailVerified: true,
    });
  });
  it('uses supplied username and display name for new users', async () => {
    vi.mocked(storage.getUserByKeycloakId).mockResolvedValue(undefined);
    vi.mocked(client.tokenIntrospection).mockResolvedValue({
      ...claims, preferred_username: 'ada', name: 'Ada Example', exp: Date.now() / 1000 + 3600,
    } as any);
    expect((await tokenService.validateAccessToken('token')).valid).toBe(true);
    expect(storage.createUser).toHaveBeenCalledWith(expect.objectContaining({ username: 'ada', name: 'Ada Example' }));
  });
  it('links an existing local account and synchronizes its role', async () => {
    vi.mocked(storage.getUserByKeycloakId).mockResolvedValue(undefined);
    vi.mocked(storage.getUserByEmail).mockResolvedValue({ ...user, keycloakId: null, emailVerified: false } as any);
    vi.mocked(client.tokenIntrospection).mockResolvedValue({ ...claims, role: 'admin' } as any);
    expect((await tokenService.validateAccessToken('token')).valid).toBe(true);
    expect(storage.updateUser).toHaveBeenCalledExactlyOnceWith(123, {
      keycloakId: claims.sub, provider: 'keycloak', emailVerified: true, role: 'admin',
    });
    expect(storage.createUser).not.toHaveBeenCalled();
  });
  it('preserves a local role when the provider supplies no recognized role', async () => {
    vi.mocked(storage.getUserByKeycloakId).mockResolvedValue({ ...user, role: 'manager', emailVerified: false } as any);
    expect((await tokenService.validateAccessToken('token')).valid).toBe(true);
    expect(storage.updateUser).toHaveBeenCalledExactlyOnceWith(123, { emailVerified: true });
  });
  it('syncs a changed provider role for an existing account', async () => {
    vi.mocked(client.tokenIntrospection).mockResolvedValue({ ...claims, role: 'manager' } as any);
    await tokenService.validateAccessToken('token');
    expect(storage.updateUser).toHaveBeenCalledExactlyOnceWith(123, { role: 'manager' });
  });
  it('fails explicitly when user creation returns no account', async () => {
    vi.mocked(storage.getUserByKeycloakId).mockResolvedValue(undefined);
    vi.mocked(storage.createUser).mockResolvedValue(undefined as any);
    expect(await tokenService.validateAccessToken('token')).toMatchObject({ valid: false, errorCode: 'USER_NOT_FOUND' });
    expect(storage.updateUserLastLogin).not.toHaveBeenCalled();
  });
  it.each(['provider', 'storage'])('contains %s errors without recording a login', async (source) => {
    if (source === 'provider') vi.mocked(client.tokenIntrospection).mockRejectedValue(new Error('offline'));
    else vi.mocked(storage.getUserByKeycloakId).mockRejectedValue(new Error('DB offline'));
    expect(await tokenService.validateAccessToken('token')).toMatchObject({ valid: false, errorCode: 'VALIDATION_FAILED' });
    expect(storage.updateUserLastLogin).not.toHaveBeenCalled();
  });
});
