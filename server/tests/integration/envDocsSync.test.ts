import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

/**
 * Every `process.env.X` read in the server source must be documented in
 * either README.md, .env.example, or docs/SELF-HOSTING.md. Otherwise
 * operators have no way to discover the configuration knob.
 *
 * Vars that are well-known Node/system internals (NODE_ENV, PORT, PATH, …)
 * or test-only/internal toggles are explicitly allow-listed.
 */
describe('environment variable documentation', () => {
  const root = resolve(__dirname, '../../..');

  // System / runtime / test-only env vars that don't need user-facing docs.
  const ALLOW_LIST = new Set([
    'NODE_ENV',
    'PORT',
    'PATH',
    'HOME',
    'TZ',
    'CI',
    'DEBUG',
    'DOCKER_CONTAINER',
    'GITHUB_ACTIONS',
    'GITLAB_CI',
    'npm_package_version',
    // Replit-injected
    'REPL_ID',
    'REPLIT_DEV_DOMAIN',
    'REPLIT_DOMAINS',
    // Internal/legacy aliases that are documented under another name
    'BASE_URL',
    'VITE_APP_URL',
    'EMAIL_FROM',
    'SMTP_PASS',
    'KEYCLOAK_URL',
    // Documented in README under different formatting
    'APP_URL',
  ]);

  function collectEnvReads(): Set<string> {
    const out = execSync(
      `grep -RhoE "process\\.env\\.[A-Z_][A-Z0-9_]+" server 2>/dev/null || true`,
      { cwd: root, encoding: 'utf8' },
    );
    const names = new Set<string>();
    for (const line of out.split('\n')) {
      const m = line.match(/process\.env\.([A-Z_][A-Z0-9_]+)/);
      if (m) names.add(m[1]);
    }
    return names;
  }

  function collectDocs(): string {
    const files = ['README.md', '.env.example', 'docs/SELF-HOSTING.md'];
    return files
      .map((f) => {
        try {
          return readFileSync(resolve(root, f), 'utf8');
        } catch {
          return '';
        }
      })
      .join('\n');
  }

  it('every server env-var read is documented', () => {
    const reads = collectEnvReads();
    const docs = collectDocs();
    const undocumented: string[] = [];

    for (const name of reads) {
      if (ALLOW_LIST.has(name)) continue;
      // Match the exact var name as a whole token in any markdown file.
      const re = new RegExp(`\\b${name}\\b`);
      if (!re.test(docs)) undocumented.push(name);
    }

    expect(
      undocumented,
      `Undocumented env vars (add to README, .env.example or docs/SELF-HOSTING.md):\n${undocumented.sort().join('\n')}`,
    ).toEqual([]);
  });
});
