import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  lookup: vi.fn(), values: vi.fn(), conflict: vi.fn(), returning: vi.fn(),
  insert: vi.fn(), update: vi.fn(), hash: vi.fn(), compare: vi.fn(),
}));
vi.mock('../db', () => ({ db: {
  select: () => ({ from: () => ({ where: () => ({ limit: mocks.lookup }) }) }),
  insert: mocks.insert, update: mocks.update,
} }));
vi.mock('bcryptjs', () => ({ default: { hash: mocks.hash, compare: mocks.compare } }));
import { seedInitialAdmin } from '../seed-admin';

beforeEach(() => {
  vi.resetAllMocks();
  for (const key of ['ADMIN_USERNAME', 'ADMIN_EMAIL', 'ADMIN_PASSWORD']) vi.stubEnv(key, undefined);
  mocks.lookup.mockResolvedValue([]);
  mocks.hash.mockResolvedValue('new-bootstrap-hash');
  mocks.compare.mockResolvedValue(true);
  mocks.insert.mockReturnValue({ values: mocks.values });
  mocks.values.mockReturnValue({ onConflictDoNothing: mocks.conflict });
  mocks.conflict.mockReturnValue({ returning: mocks.returning });
  mocks.returning.mockResolvedValue([{ id: 1 }]);
});
afterEach(() => vi.unstubAllEnvs());

describe('Create-only startup admin seeding', () => {
  it.each(['local', 'keycloak'])('preserves an existing %s account across repeated restarts', async provider => {
    const existing = { id: 1, username: 'admin', provider, role: 'user',
      passwordHash: 'user-changed-hash', email: 'changed@example.test',
      isInitialAdmin: false, emailVerified: false, totpEnabled: true, totpSecret: 'private-secret',
    };
    mocks.lookup.mockResolvedValue([existing]);
    vi.stubEnv('ADMIN_PASSWORD', 'DifferentBootstrapPassword123!');
    await seedInitialAdmin();
    await seedInitialAdmin();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.hash).not.toHaveBeenCalled();
    expect(mocks.compare).not.toHaveBeenCalled();
    expect(existing.isInitialAdmin).toBe(false);
    expect(existing.totpEnabled).toBe(true);
  });
  it('creates a missing default admin with the initial password-change requirement', async () => {
    await seedInitialAdmin();
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({
      username: 'admin', email: 'admin@polly.local', role: 'admin', provider: 'local',
      passwordHash: 'new-bootstrap-hash', isInitialAdmin: true, emailVerified: true,
    }));
    expect(mocks.conflict).toHaveBeenCalledTimes(1);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('preserves custom bootstrap settings for a new installation', async () => {
    vi.stubEnv('ADMIN_USERNAME', 'bootstrap-admin');
    vi.stubEnv('ADMIN_EMAIL', 'bootstrap@example.test');
    vi.stubEnv('ADMIN_PASSWORD', 'CustomBootstrapPassword123!');
    await seedInitialAdmin();
    expect(mocks.hash).toHaveBeenCalledWith('CustomBootstrapPassword123!', 10);
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({
      username: 'bootstrap-admin', email: 'bootstrap@example.test', isInitialAdmin: false,
    }));
  });
  it('does not overwrite a conflicting account created after the lookup', async () => {
    mocks.returning.mockResolvedValue([]);
    await seedInitialAdmin();
    expect(mocks.conflict).toHaveBeenCalledTimes(1);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
