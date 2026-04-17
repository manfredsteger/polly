/**
 * Session cookie configuration helpers.
 *
 * The session cookie's `Secure` attribute must only be enabled when the app
 * is actually served over HTTPS. If we set it on a plain-HTTP deployment
 * (e.g. the default Docker setup on http://localhost:3080), browsers
 * silently drop the cookie — login appears to succeed but the next request
 * has no session, bouncing the user back to the login page with no error.
 *
 * Keep this logic here (not inline in server/index.ts) so it can be
 * unit-tested against env-variable combinations.
 */

export interface SecureCookieEnv {
  resolvedAppUrl: string;
  forceHttps?: string;
  replitDevDomain?: string;
  replId?: string;
}

export function shouldUseSecureCookies(env: SecureCookieEnv): boolean {
  return (
    env.forceHttps === 'true' ||
    env.resolvedAppUrl.startsWith('https://') ||
    env.resolvedAppUrl.includes('replit') ||
    !!env.replitDevDomain ||
    !!env.replId
  );
}
