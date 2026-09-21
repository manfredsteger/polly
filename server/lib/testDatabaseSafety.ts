export class TestDatabaseSafetyError extends Error {}

// Shared by the runner and Vitest. Never imports application code or opens a DB.
function databaseName(value: string, setting: string): string {
  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) throw new Error();
    // Reject connection overrides that could point pg at a different database.
    for (const key of url.searchParams.keys()) {
      if (!['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'application_name'].includes(key)) throw new Error();
    }
    const name = decodeURIComponent(url.pathname.slice(1));
    if (!name || name.includes('/')) throw new Error();
    return name;
  } catch {
    throw new TestDatabaseSafetyError(`${setting} must be a PostgreSQL URL with an explicit database name and no connection overrides.`);
  }
}

export function testDatabaseEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  if (!env.TEST_DATABASE_URL) {
    throw new TestDatabaseSafetyError('Database tests are disabled: configure TEST_DATABASE_URL for a separate test database. The application database will not be used.');
  }
  const testName = databaseName(env.TEST_DATABASE_URL, 'TEST_DATABASE_URL');
  // Preserve only the application DB name across child/config/setup boundaries.
  // Compare names even across host aliases or different credentials.
  const applicationName = env.POLLY_APPLICATION_DATABASE_NAME ??
    (env.DATABASE_URL ? databaseName(env.DATABASE_URL, 'DATABASE_URL') : '');
  if (applicationName === testName) {
    throw new TestDatabaseSafetyError('Unsafe test database: TEST_DATABASE_URL must use a different database name from the application database.');
  }
  let appUrl = env.APP_URL?.trim() || 'http://localhost:5000';
  try {
    if (!['http:', 'https:'].includes(new URL(appUrl).protocol)) appUrl = 'http://localhost:5000';
  } catch {
    appUrl = 'http://localhost:5000';
  }
  return {
    ...env,
    APP_URL: appUrl,
    NODE_ENV: 'test',
    DATABASE_URL: env.TEST_DATABASE_URL,
    DATABASE_SSL: env.TEST_DATABASE_SSL || 'false',
    POLLY_APPLICATION_DATABASE_NAME: applicationName,
  };
}

export function assertIsolatedTestDatabase(env: NodeJS.ProcessEnv): void {
  const safe = testDatabaseEnvironment(env);
  if (env.NODE_ENV !== 'test' || env.DATABASE_URL !== safe.DATABASE_URL || env.POLLY_APPLICATION_DATABASE_NAME === undefined) {
    throw new TestDatabaseSafetyError('Database test setup refused: start tests through the isolated Vitest configuration.');
  }
}
