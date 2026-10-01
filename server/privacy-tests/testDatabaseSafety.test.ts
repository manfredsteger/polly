import { describe, expect, it } from 'vitest';
import { assertIsolatedTestDatabase, testDatabaseEnvironment } from '../lib/testDatabaseSafety';

const app = 'postgresql://app:private-password@db:5432/polly';
const test = 'postgresql://tests:test-password@db:5432/polly_test';

describe('Database test isolation', () => {
  it('refuses application-only configuration even with NODE_ENV=test', () => {
    expect(() => testDatabaseEnvironment({ DATABASE_URL: app, NODE_ENV: 'test' })).toThrow('TEST_DATABASE_URL');
  });
  it.each([
    app,
    'postgres://other:other-password@127.0.0.1:5433/polly',
    'postgresql://tests:pw@db/%70olly',
  ])('rejects the application database regardless of credentials or host aliases', unsafe => {
    expect(() => testDatabaseEnvironment({ DATABASE_URL: app, TEST_DATABASE_URL: unsafe })).toThrow('different database name');
  });
  it.each(['not-a-url', 'https://db/polly_test', 'postgresql://db/', `${test}?database=polly`, `${test}?host=other`, `${test}?options=-csearch_path=public`])('rejects malformed or overriding URLs', unsafe => {
    expect(() => testDatabaseEnvironment({ DATABASE_URL: app, TEST_DATABASE_URL: unsafe })).toThrow();
  });
  it('changes only the child environment and keeps isolation across setup boundaries', () => {
    const parent = { DATABASE_URL: app, TEST_DATABASE_URL: test, NODE_ENV: 'production', DATABASE_SSL: 'true' };
    const child = testDatabaseEnvironment(parent);
    expect(parent.DATABASE_URL).toBe(app);
    expect(parent.NODE_ENV).toBe('production');
    expect(child.DATABASE_URL).toBe(test);
    expect(child.DATABASE_SSL).toBe('false');
    expect(child.NODE_ENV).toBe('test');
    expect(testDatabaseEnvironment(child)).toEqual(child);
    expect(() => assertIsolatedTestDatabase(child)).not.toThrow();
    expect(() => assertIsolatedTestDatabase({ ...child, DATABASE_URL: app })).toThrow();
  });
  it('allows CI with only an explicit test database and independent SSL settings', () => {
    const child = testDatabaseEnvironment({ TEST_DATABASE_URL: test, TEST_DATABASE_SSL: 'true' });
    expect(child.DATABASE_SSL).toBe('true');
    expect(() => assertIsolatedTestDatabase(child)).not.toThrow();
  });
  it('refuses direct setup without the isolated config', () => {
    expect(() => assertIsolatedTestDatabase({ NODE_ENV: 'test', DATABASE_URL: app, TEST_DATABASE_URL: test })).toThrow();
  });
  it('does not expose connection credentials in errors', () => {
    try {
      testDatabaseEnvironment({ DATABASE_URL: app, TEST_DATABASE_URL: app });
      throw new Error('Expected refusal');
    } catch (error) {
      expect(String(error)).not.toContain('private-password');
      expect(String(error)).not.toContain(app);
    }
  });
});
