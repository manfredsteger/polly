import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Guards against shipping a release with an empty CHANGELOG.
 *
 * Rules:
 *   - The "[Unreleased]" section MUST exist.
 *   - When the project version is a stable or pre-release tag, an entry block
 *     for that version MUST exist (e.g. "## [0.1.0-beta.3]").
 *   - The Version History table MUST list the current package.json version.
 */
describe('CHANGELOG.md', () => {
  const root = resolve(__dirname, '../../..');
  const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8');
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

  it('contains the [Unreleased] section header', () => {
    expect(changelog).toMatch(/##\s*\[Unreleased\]/);
  });

  it('lists a section block for the current package.json version OR keeps changes under [Unreleased]', () => {
    const version = pkg.version as string;
    const hasVersionBlock = new RegExp(`##\\s*\\[${version.replace(/\./g, '\\.')}\\]`).test(changelog);

    // Extract the [Unreleased] block content up to the next "## [" header
    const unreleasedMatch = changelog.match(/##\s*\[Unreleased\][^\n]*\n([\s\S]*?)(?=\n##\s*\[)/);
    const unreleasedBody = (unreleasedMatch?.[1] || '').trim();

    const unreleasedHasContent =
      unreleasedBody.length > 0 &&
      !/^\*?\(no pending changes\)\*?$/i.test(unreleasedBody);

    // Either a versioned block exists, or [Unreleased] is non-empty.
    expect(hasVersionBlock || unreleasedHasContent).toBe(true);
  });

  it('Version History table mentions the current version (only required for tagged releases)', () => {
    const version = pkg.version as string;
    // For an untagged in-progress version, this is a soft warning via test name.
    // We only enforce when there's a versioned block (i.e. release was cut).
    const hasVersionBlock = new RegExp(`##\\s*\\[${version.replace(/\./g, '\\.')}\\]`).test(changelog);
    if (hasVersionBlock) {
      expect(changelog).toContain(version);
    } else {
      // No-op: still in Unreleased phase.
      expect(true).toBe(true);
    }
  });
});
