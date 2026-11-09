import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { resolve } from 'path';
import { readFileSync } from 'node:fs';

/**
 * Hygiene checks for runtime dependencies.
 *
 * - passport / passport-local are listed in package.json (legacy) but the
 *   actual auth code uses bcrypt + express-session directly. This test
 *   prevents accidental re-introduction of passport in source code without
 *   an explicit decision.
 */
describe('dependency hygiene', () => {
  const root = resolve(__dirname, '../../..');

  function grepImports(pkg: string): string[] {
    try {
      const out = execSync(
        `grep -RIl --include='*.ts' --include='*.tsx' -E "(from ['\\"]${pkg}['\\"]|require\\(['\\"]${pkg}['\\"])" server client shared 2>/dev/null || true`,
        { cwd: root, encoding: 'utf8' },
      );
      return out.split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  it('does not import passport in any source file', () => {
    const matches = grepImports('passport');
    expect(matches, `passport imported in:\n${matches.join('\n')}`).toEqual([]);
  });

  it('does not import passport-local in any source file', () => {
    const matches = grepImports('passport-local');
    expect(matches, `passport-local imported in:\n${matches.join('\n')}`).toEqual([]);
  });

  it('keeps security-blocked versions out of the lockfile so installation can finish', () => {
    const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));
    const minimum: Record<string, number[]> = { 'proxy-addr': [2, 0, 8], dompurify: [3, 4, 17] };
    for (const [name, floor] of Object.entries(minimum)) {
      const entries = Object.entries(lock.packages).filter(([key]) => key.endsWith(`/node_modules/${name}`) || key === `node_modules/${name}`);
      expect(entries.length, `${name} missing from lockfile`).toBeGreaterThan(0);
      for (const [key, pkg] of entries) {
        const version = (pkg as { version: string }).version.split('.').map(Number);
        const difference = version.map((part, index) => part - (floor[index] ?? 0)).find(part => part !== 0) ?? 0;
        expect(difference, `${key} must be at least ${floor.join('.')}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('uses portable registry URLs rather than workspace-only package mirrors', () => {
    const lock = readFileSync(resolve(root, 'package-lock.json'), 'utf8');
    expect(lock).not.toContain('package-firewall.replit.internal');
  });
});
