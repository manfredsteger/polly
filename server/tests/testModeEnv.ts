import { randomBytes } from 'crypto';
import { beforeAll, afterAll } from 'vitest';

/**
 * Opens the test-mode gate for the current test file only:
 * sets ENABLE_TEST_MODE=true and a fresh random TEST_MODE_SECRET before the
 * suite runs and restores the previous values afterwards. Returns the secret
 * to send as the X-Test-Mode header.
 */
export function enableTestModeForSuite(): { secret: string } {
  const secret = randomBytes(32).toString('hex');
  let previousEnable: string | undefined;
  let previousSecret: string | undefined;

  beforeAll(() => {
    previousEnable = process.env.ENABLE_TEST_MODE;
    previousSecret = process.env.TEST_MODE_SECRET;
    process.env.ENABLE_TEST_MODE = 'true';
    process.env.TEST_MODE_SECRET = secret;
  });

  afterAll(() => {
    restoreEnv('ENABLE_TEST_MODE', previousEnable);
    restoreEnv('TEST_MODE_SECRET', previousSecret);
  });

  return { secret };
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
