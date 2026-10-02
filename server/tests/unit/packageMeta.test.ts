import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('package.json metadata', () => {
  const pkg = JSON.parse(
    readFileSync(resolve(__dirname, '../../../package.json'), 'utf8'),
  );

  it('has the canonical project name "polly"', () => {
    expect(pkg.name).toBe('polly');
  });

  it('has a SemVer version matching alpha/beta/rc/stable pattern', () => {
    expect(pkg.version).toMatch(
      /^\d+\.\d+\.\d+(-(alpha|beta|rc)\.\d+)?$/,
    );
  });

  it('has MIT license', () => {
    expect(pkg.license).toBe('MIT');
  });
});
