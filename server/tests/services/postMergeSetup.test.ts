import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const directories: string[] = [];
const script = path.resolve('scripts/post-merge.sh');

// Exercise the real shell script with stub executables: never install packages
// or contact a database from these regression tests.
function runSetup(scenario: string) {
  const directory = mkdtempSync(path.join(tmpdir(), 'post-merge-test-'));
  directories.push(directory);
  const log = path.join(directory, 'commands.log');
  const executable = (name: string, body: string) =>
    writeFileSync(path.join(directory, name), `#!/bin/bash\n${body}\n`, { mode: 0o755 });
  executable('npm', 'echo "npm $*" >> "$COMMAND_LOG"\n[[ "$SCENARIO" != install-fails ]]');
  executable('npx', 'echo "npx $*" >> "$COMMAND_LOG"\n[[ "$SCENARIO" != migration-fails ]]');
  executable('git', `
if [[ "$1" == rev-parse ]]; then
  [[ "$SCENARIO" == no-parent ]] && exit 1
  echo parent
  exit 0
fi
if [[ "$*" == *"-- migrations"* ]]; then
  [[ "$SCENARIO" == migration || "$SCENARIO" == migration-fails ]] && exit 1
  exit 0
fi
[[ "$SCENARIO" == schema-only ]] && exit 1
exit 0`);
  const result = spawnSync('bash', [script], {
    env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, COMMAND_LOG: log, SCENARIO: scenario },
    encoding: 'utf8',
    timeout: 5000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { ...result, commands: readFileSync(log, 'utf8') };
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('Non-interactive post-merge setup', () => {
  it('uses the lockfile and skips database changes for a code-only merge', () => {
    const result = runSetup('code-only');
    expect(result.status).toBe(0);
    expect(result.commands).toBe('npm ci --no-audit --no-fund\n');
    expect(result.stdout).toContain('skipping database setup');
  });

  it('applies checked-in migrations without force-pushing the schema', () => {
    const result = runSetup('migration');
    expect(result.status).toBe(0);
    expect(result.commands).toContain('npx drizzle-kit migrate');
    expect(result.commands).not.toMatch(/push|--force/);
  });

  it('fails explicitly when schema changes lack a migration', () => {
    const result = runSetup('schema-only');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('schema changed without a checked-in migration');
    expect(result.commands).not.toContain('npx');
  });

  it('propagates installation and migration failures', () => {
    expect(runSetup('install-fails').status).toBe(1);
    expect(runSetup('migration-fails').status).toBe(1);
  });

  it('does not attempt a schema push when no parent commit exists', () => {
    const result = runSetup('no-parent');
    expect(result.status).toBe(0);
    expect(result.commands).not.toContain('npx');
  });
});
