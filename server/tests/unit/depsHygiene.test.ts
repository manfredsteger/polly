import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { resolve } from 'path';

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
});
