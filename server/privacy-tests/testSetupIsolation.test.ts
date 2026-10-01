import { afterEach, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({ purge: vi.fn(), pool: vi.fn() }));
vi.mock('../storage', () => ({ storage: { purgeTestData: calls.purge } }));
vi.mock('pg', () => ({ Pool: calls.pool }));
import globalSetup from '../tests/globalTeardown';

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it.each(['missing', 'same-database', 'unprepared'])('blocks %s before test setup purges data or seeds an admin', async scenario => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('DATABASE_URL', 'postgresql://user:pw@db/polly');
  vi.stubEnv('POLLY_APPLICATION_DATABASE_NAME', undefined);
  vi.stubEnv('TEST_DATABASE_URL', scenario === 'missing' ? undefined :
    scenario === 'same-database' ? 'postgresql://other:pw@alias/polly' : 'postgresql://tests:pw@db/polly_test');
  await expect(globalSetup()).rejects.toThrow();
  expect(calls.purge).not.toHaveBeenCalled();
  expect(calls.pool).not.toHaveBeenCalled();
});
