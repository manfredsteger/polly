import { execSync } from 'child_process';
import { existsSync } from 'fs';

/**
 * Reports whether a Chromium binary is available for server-side PDF rendering.
 * PDF tests that need a real render skip when this returns false.
 */
export function isChromiumAvailable(): boolean {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return true;
  }
  const possiblePaths = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ];
  if (possiblePaths.some((p) => existsSync(p))) return true;
  try {
    const result = execSync('which chromium || which chromium-browser || which google-chrome 2>/dev/null', {
      encoding: 'utf8',
    }).trim();
    return !!result;
  } catch {
    return false;
  }
}
