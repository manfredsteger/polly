import { timingSafeEqual } from "crypto";

/**
 * Test-mode gate.
 *
 * Test mode lets automated E2E runs bypass API rate limits, suppress
 * notification emails, flag created data as test data, and log in to test
 * accounts. It is therefore only active when BOTH conditions hold:
 *   - ENABLE_TEST_MODE is exactly "true"
 *   - TEST_MODE_SECRET is set and at least MIN_TEST_MODE_SECRET_LENGTH chars
 * There is deliberately no fallback secret.
 */
export const MIN_TEST_MODE_SECRET_LENGTH = 32;
export const TEST_MODE_HEADER = "x-test-mode";

type Env = Record<string, string | undefined>;

/** Returns the configured secret when test mode is fully enabled, otherwise null. */
export function getActiveTestModeSecret(env: Env = process.env): string | null {
  if (env.ENABLE_TEST_MODE !== "true") return null;
  const secret = env.TEST_MODE_SECRET;
  if (!secret || secret.length < MIN_TEST_MODE_SECRET_LENGTH) return null;
  return secret;
}

export function isTestModeEnabled(env: Env = process.env): boolean {
  return getActiveTestModeSecret(env) !== null;
}

/** Constant-time check of a header value against the active secret. */
export function isValidTestModeHeader(
  headerValue: string | string[] | undefined,
  env: Env = process.env,
): boolean {
  const secret = getActiveTestModeSecret(env);
  if (secret === null) return false;
  if (typeof headerValue !== "string") return false;

  const provided = Buffer.from(headerValue, "utf8");
  const expected = Buffer.from(secret, "utf8");
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

/**
 * Startup diagnostics. Returns the messages that were logged so callers and
 * tests can inspect them.
 */
export function logTestModeStatus(
  env: Env = process.env,
  logger: Pick<Console, "warn"> = console,
): string[] {
  const messages: string[] = [];
  const enabled = isTestModeEnabled(env);

  if (enabled && env.NODE_ENV === "production") {
    messages.push(
      "[SECURITY] Test mode is enabled (ENABLE_TEST_MODE=true) while NODE_ENV=production. " +
        "Requests with the X-Test-Mode header can bypass rate limits, suppress emails and log in to test accounts. " +
        "Remove ENABLE_TEST_MODE and TEST_MODE_SECRET from production environments.",
    );
  } else if (env.ENABLE_TEST_MODE === "true" && !enabled) {
    messages.push(
      `[SECURITY] ENABLE_TEST_MODE=true is ignored: TEST_MODE_SECRET must be set and at least ${MIN_TEST_MODE_SECRET_LENGTH} characters long. Test mode stays disabled.`,
    );
  }

  for (const message of messages) logger.warn(message);
  return messages;
}
