import { describe, expect, it } from 'vitest';
import { assertIsolatedTestDatabase, testDatabaseEnvironment, TestDatabaseSafetyError } from '../../lib/testDatabaseSafety';

export const testMeta = {
  category: 'unit' as const,
  name: 'Schutz der Anwendungsdatenbank bei Testläufen',
  description: 'Testläufe verweigern den Start, wenn sie die Anwendungsdatenbank treffen könnten',
  severity: 'critical' as const,
};

const TEST_URL = 'postgres://u:p@db.example:5432/polly_test?sslmode=require';
const APP_URL = 'postgres://u:p@db.example:5432/polly';

describe('test database safety', () => {
  it('refuses to run without a separate test database', () => {
    expect(() => testDatabaseEnvironment({ DATABASE_URL: APP_URL })).toThrow(TestDatabaseSafetyError);
    expect(() => testDatabaseEnvironment({ DATABASE_URL: APP_URL })).toThrow(/TEST_DATABASE_URL/);
  });

  it('refuses a test database with the same name as the application database, even on another host', () => {
    expect(() => testDatabaseEnvironment({
      TEST_DATABASE_URL: 'postgresql://other:pw@alias.example/polly',
      DATABASE_URL: APP_URL,
    })).toThrow(/different database name/);
    // The remembered application name wins over a rewritten DATABASE_URL.
    expect(() => testDatabaseEnvironment({
      TEST_DATABASE_URL: TEST_URL,
      DATABASE_URL: TEST_URL,
      POLLY_APPLICATION_DATABASE_NAME: 'polly_test',
    })).toThrow(TestDatabaseSafetyError);
  });

  it.each([
    ['not a url'],
    ['mysql://u:p@h/db'],
    ['postgres://u:p@h/'],
    ['postgres://u:p@h/a/b'],
    ['postgres://u:p@h/db?host=/var/run/postgresql'],
    ['postgres://u:p@h/db?options=-csearch_path%3Dprod'],
  ])('rejects the unsafe test database URL %s', (url) => {
    expect(() => testDatabaseEnvironment({ TEST_DATABASE_URL: url, DATABASE_URL: APP_URL })).toThrow(/explicit database name/);
  });

  it('points the run at the test database and keeps only the application database name', () => {
    const env = testDatabaseEnvironment({ TEST_DATABASE_URL: TEST_URL, DATABASE_URL: APP_URL, APP_URL: ' https://polly.example ' });
    expect(env).toMatchObject({
      DATABASE_URL: TEST_URL,
      NODE_ENV: 'test',
      DATABASE_SSL: 'false',
      POLLY_APPLICATION_DATABASE_NAME: 'polly',
      APP_URL: 'https://polly.example',
    });
    expect(testDatabaseEnvironment({ TEST_DATABASE_URL: TEST_URL, TEST_DATABASE_SSL: 'true' })).toMatchObject({
      DATABASE_SSL: 'true',
      POLLY_APPLICATION_DATABASE_NAME: '',
    });
  });

  it('falls back to a safe local app URL for invalid or non-http values', () => {
    for (const APP_URL_VALUE of ['javascript:alert(1)', 'not a url', '']) {
      expect(testDatabaseEnvironment({ TEST_DATABASE_URL: TEST_URL, APP_URL: APP_URL_VALUE }).APP_URL).toBe('http://localhost:5000');
    }
  });

  it('only accepts setups started through the isolated configuration', () => {
    const safe = testDatabaseEnvironment({ TEST_DATABASE_URL: TEST_URL, DATABASE_URL: APP_URL });
    expect(() => assertIsolatedTestDatabase(safe)).not.toThrow();
    expect(() => assertIsolatedTestDatabase({ ...safe, NODE_ENV: 'development' })).toThrow(/isolated Vitest/);
    expect(() => assertIsolatedTestDatabase({ ...safe, DATABASE_URL: APP_URL })).toThrow(TestDatabaseSafetyError);
    expect(() => assertIsolatedTestDatabase({ ...safe, POLLY_APPLICATION_DATABASE_NAME: undefined })).toThrow(TestDatabaseSafetyError);
  });
});
