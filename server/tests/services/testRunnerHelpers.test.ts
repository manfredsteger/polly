import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  calculateNextRun, normalizeScheduleConfig, parseVitestOutput,
  getAvailableTests, scanTestFiles, startScheduler, stopScheduler,
} from '../../services/testRunnerService';

describe('admin test runner helpers', () => {
  const temporaryDirectories: string[] = [];
  afterEach(() => {
    stopScheduler();
    vi.restoreAllMocks();
    vi.useRealTimers();
    for (const directory of temporaryDirectories.splice(0)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('provides a disabled weekly schedule by default', () => {
    expect(normalizeScheduleConfig()).toEqual({
      enabled: false, intervalDays: 7, runTime: '03:00', notifyEmails: [], notifyEmail: '',
    });
    expect(normalizeScheduleConfig(null)).toEqual(normalizeScheduleConfig());
  });
  it('normalizes recipients, removing empty, malformed and duplicate addresses', () => {
    expect(normalizeScheduleConfig({
      enabled: true, intervalDays: 2, runTime: '09:30',
      notifyEmails: [' ADA@example.test ', '', 'invalid', 'ada@example.test', 'bob@example.test'],
      notifyEmail: 'BOB@example.test',
    })).toEqual({
      enabled: true, intervalDays: 2, runTime: '09:30',
      notifyEmails: ['ada@example.test', 'bob@example.test'], notifyEmail: 'ada@example.test',
    });
  });
  it('migrates the legacy single recipient and preserves scheduling timestamps', () => {
    expect(normalizeScheduleConfig({ notifyEmail: ' Owner@example.test ', lastRun: 'last', nextRun: 'next' }))
      .toMatchObject({ notifyEmails: ['owner@example.test'], notifyEmail: 'owner@example.test', lastRun: 'last', nextRun: 'next' });
  });
  it.each([
    [2, 59, 7, 0],
    [3, 0, 7, 7],
    [9, 30, 1, 1],
  ])('schedules at local run time, advancing only when due time has passed %#', (hour, minute, interval, addedDays) => {
    vi.useFakeTimers();
    // Local dates make the test independent of the host timezone.
    vi.setSystemTime(new Date(2026, 9, 28, hour, minute));
    expect(calculateNextRun(interval, '03:00')).toBe(new Date(2026, 9, 28 + addedDays, 3, 0).toISOString());
  });
  it('rolls the next run across a year boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 31, 12));
    expect(calculateNextRun(7, '03:00')).toBe(new Date(2027, 0, 7, 3).toISOString());
  });
  it.each(['json', 'with output'])('parses %s without dropping skipped or failed assertions', (format) => {
    const report = {
      numTotalTests: 3, numPassedTests: 1, numFailedTests: 1, numPendingTests: 1,
      success: false, testResults: [{
        name: 'server/tests/unit/sample.test.ts',
        assertionResults: [
          { title: 'passes', status: 'passed', duration: 2 },
          { title: 'fails', status: 'failed', failureMessages: ['Expected true'] },
          { title: 'pending', status: 'pending' },
        ],
      }],
    };
    const json = JSON.stringify(report);
    expect(parseVitestOutput(format === 'json' ? json : `Starting tests\n${json}\nDone`)).toEqual(report);
  });
  it.each(['', 'not json', '{"numTotalTests": broken}'])('returns an explicit unsuccessful empty result for corrupt output %#', (output) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(parseVitestOutput(output)).toMatchObject({
      success: false, numTotalTests: 0, numPassedTests: 0, numFailedTests: 0, numSkippedTests: 0, testResults: [],
    });
    expect(console.error).toHaveBeenCalledOnce();
  });
  it('keeps only one scheduler timer and stops it idempotently', () => {
    vi.useFakeTimers();
    startScheduler();
    startScheduler();
    expect(vi.getTimerCount()).toBe(1);
    stopScheduler();
    stopScheduler();
    expect(vi.getTimerCount()).toBe(0);
  });

  function fixtureRoot(files: Record<string, string>) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'polly-scanner-test-'));
    temporaryDirectories.push(root);
    for (const [name, content] of Object.entries(files)) {
      const filename = path.join(root, name);
      fs.mkdirSync(path.dirname(filename), { recursive: true });
      fs.writeFileSync(filename, content);
    }
    vi.spyOn(process, 'cwd').mockReturnValue(root);
    return root;
  }
  it('scans nested files, metadata, and browser specs without executing their contents', async () => {
    fixtureRoot({
      'server/tests/auth/login.test.ts': `
export const testMeta = { category: 'auth', name: 'Login', description: 'Token checks', severity: 'high', testType: 'integration' };
it('accepts token', () => {});
test.skip('offline', () => {});
// it('commented out', () => {});
`,
      'server/tests/unit/math.test.ts': "it('adds', () => {});",
      'server/tests/root.test.ts': "test('root case', () => {});",
      'server/tests/unit/ignored.ts': "it('not discovered', () => {});",
      'e2e/accessibility.spec.ts': "test('contrast', () => {});",
      'e2e/data.spec.ts': "test('seed data', () => {});",
      'e2e/browser.spec.ts': "test('navigation', () => {});",
    });
    const tests = await scanTestFiles();
    expect(tests).toHaveLength(7);
    expect(tests).toContainEqual({
      testId: 'server/tests/auth/login.test.ts:accepts token', testFile: 'server/tests/auth/login.test.ts',
      testName: 'accepts token', testType: 'integration', category: 'auth', description: 'Token checks', enabled: true,
    });
    expect(tests.find(t => t.testName === 'adds')).toMatchObject({ testType: 'unit', category: 'unit' });
    expect(tests.find(t => t.testName === 'root case')).toMatchObject({ category: 'other' });
    expect(tests.find(t => t.testName === 'contrast')).toMatchObject({ testType: 'accessibility' });
    expect(tests.find(t => t.testName === 'seed data')).toMatchObject({ testType: 'data' });
    expect(tests.find(t => t.testName === 'navigation')).toMatchObject({ testType: 'e2e' });
    expect(await getAvailableTests()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'auth', name: 'Authentifizierung', testCount: 1 }),
      expect.objectContaining({ id: 'unit', testCount: 1 }),
      expect.objectContaining({ id: 'other', testCount: 1 }),
    ]));
  });
  it.each([
    ["// testType: 'data'", 'data'],
    ['/* testType: "accessibility" */', 'accessibility'],
    ["const x = { testType: 'e2e' };", 'e2e'],
    ["// testType: 'unknown'\nimport request from 'supertest';", 'integration'],
    ["import { AxeBuilder } from 'axe';", 'accessibility'],
    ["const fixture = {};", 'data'],
    ["import { test } from '@playwright/test';", 'e2e'],
    ["request(app);", 'integration'],
  ])('classifies declarations and content: %s', async (prefix, expected) => {
    fixtureRoot({
      'server/tests/unit/example.test.ts': `${prefix}\nit('example', () => {});`,
      'e2e/empty.spec.ts': '// no tests',
    });
    expect(await scanTestFiles()).toEqual([expect.objectContaining({ testName: 'example', testType: expected })]);
  });
  it('reports unavailable directories instead of throwing from the admin listing', async () => {
    fixtureRoot({});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await scanTestFiles()).toEqual([]);
    expect(await getAvailableTests()).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });
});
