import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock('child_process', () => ({ spawn: mocks.spawn }));
vi.mock('../db', () => ({ db: {} }));
vi.mock('../services/emailService', () => ({ emailService: {} }));
vi.mock('../services/pdfService', () => ({ generateTestReportPDF: vi.fn() }));
import { executeVitest } from '../services/testRunnerService';

beforeEach(() => {
  vi.stubEnv('DATABASE_URL', 'postgresql://app:pw@db/polly');
  vi.stubEnv('TEST_DATABASE_URL', 'postgresql://tests:pw@db/polly_test');
  vi.stubEnv('POLLY_APPLICATION_DATABASE_NAME', undefined);
  vi.stubEnv('APP_URL', '');
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it.each([0, 1])('reads the report even with exit code %s and removes its temporary directory', async code => {
  let reportPath = '';
  const report = JSON.stringify({ numTotalTests: 2, numPassedTests: 1, numFailedTests: 1 });
  mocks.spawn.mockImplementation((_binary, args, options) => {
    reportPath = args.find((arg: string) => arg.startsWith('--outputFile=')).slice('--outputFile='.length);
    expect(path.dirname(reportPath)).not.toBe(process.cwd());
    expect(options.env.DATABASE_URL).toContain('/polly_test');
    expect(options.env.APP_URL).toBe('http://localhost:5000');
    const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter() });
    queueMicrotask(() => {
      fs.writeFileSync(reportPath, report);
      child.emit('close', code);
    });
    return child;
  });
  expect(await executeVitest()).toBe(report);
  expect(fs.existsSync(path.dirname(reportPath))).toBe(false);
});

it('cleans up after a process startup error', async () => {
  let reportPath = '';
  mocks.spawn.mockImplementation((_binary, args) => {
    reportPath = args.find((arg: string) => arg.startsWith('--outputFile=')).slice('--outputFile='.length);
    const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter() });
    queueMicrotask(() => child.emit('error', new Error('Unable to start')));
    return child;
  });
  await expect(executeVitest()).rejects.toThrow('Unable to start');
  expect(fs.existsSync(path.dirname(reportPath))).toBe(false);
});
