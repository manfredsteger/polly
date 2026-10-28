import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import type { Express } from 'express';

export const testMeta = {
  category: 'services' as const,
  name: 'Testlauf-Ausführung im Admin-Bereich',
  description: 'Admin-Testläufe speichern Ergebnisse, Live-Fortschritt, Abbruch und Berichts-E-Mails korrekt – ohne echte Vitest-Prozesse zu starten',
  severity: 'high' as const,
};

// Only the spawn function is replaced: no nested Vitest run ever starts here.
const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return { ...actual, spawn: spawnMock };
});

class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn(() => true);
}

interface Spawned { args: string[]; child: FakeChild }

type Runner = typeof import('../../services/testRunnerService');
let runner: Runner;
let db: typeof import('../../db').db;
let pool: typeof import('../../db').pool;
let schema: typeof import('@shared/schema');
let orm: typeof import('drizzle-orm');
let storage: typeof import('../../storage').storage;
let emailService: typeof import('../../services/emailService').emailService;
let pdfService: typeof import('../../services/pdfService').pdfService;
let app: Express;
let admin: import('../fixtures/users').TestAgent;

let spawned: Spawned[] = [];
const createdRunIds: number[] = [];
const SETTING_KEYS = ['test_schedule_config', 'test_mode_config'];
const originalSettings = new Map<string, unknown>();
let originallyEnabled: string[] = [];
const ownConfigIds = ['e2e/navigation.spec.ts:coverage-e2e', 'server/tests/unit/coverage-only.test.ts:a.b (c)'];

const cwd = process.cwd();
const report = {
  numTotalTestSuites: 2,
  numPassedTestSuites: 1,
  numFailedTestSuites: 1,
  numTotalTests: 4,
  numPassedTests: 2,
  numFailedTests: 1,
  numSkippedTests: 1,
  startTime: Date.now(),
  success: false,
  testResults: [
    {
      name: path.join(cwd, 'server/tests/api/alpha.test.ts'),
      assertionResults: [
        { fullName: 'Alpha passes', status: 'passed', duration: 12.4 },
        { title: 'Alpha fails', status: 'failed', duration: 3, failureMessages: ['boom', 'at line 1'] },
      ],
    },
    {
      filepath: 'server/tests/security/beta.test.ts',
      tests: [
        { fullName: 'Beta pending', status: 'pending' },
        { status: 'passed' },
      ],
    },
  ],
};

function runSpawns() {
  return spawned.filter((s) => s.args[0] === 'run');
}

async function waitFor<T>(check: () => T | Promise<T>, label: string, timeoutMs = 8000): Promise<NonNullable<T>> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value) return value as NonNullable<T>;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 20));
  }
}

async function waitForRunSpawn(count: number): Promise<Spawned> {
  return waitFor(() => runSpawns().length >= count && runSpawns()[count - 1], 'vitest run spawn');
}

async function waitForFinished(runId: number) {
  return waitFor(async () => {
    const run = await runner.getTestRun(runId);
    return run && run.status !== 'running' ? run : null;
  }, `run ${runId} to finish`);
}

function finishWithReport(s: Spawned, json: unknown = report) {
  const outputArg = s.args.find((a) => a.startsWith('--outputFile='))!;
  fs.writeFileSync(outputArg.slice('--outputFile='.length), JSON.stringify(json));
  s.child.emit('close', 0);
}

describe('admin test runner execution', () => {
  beforeAll(async () => {
    // The runner keeps module-level state and may already be loaded with the
    // real child_process by an earlier file; load a fresh graph with the mock.
    vi.resetModules();
    runner = await import('../../services/testRunnerService');
    ({ db, pool } = await import('../../db'));
    schema = await import('@shared/schema');
    orm = await import('drizzle-orm');
    ({ storage } = await import('../../storage'));
    ({ emailService } = await import('../../services/emailService'));
    ({ pdfService } = await import('../../services/pdfService'));
    const { createTestApp } = await import('../testApp');
    const { loginAdminAgent } = await import('../fixtures/users');
    app = await createTestApp();
    admin = await loginAdminAgent(app);

    for (const key of SETTING_KEYS) originalSettings.set(key, (await storage.getSetting(key))?.value);
    originallyEnabled = (await db.select({ testId: schema.testConfigurations.testId })
      .from(schema.testConfigurations)
      .where(orm.eq(schema.testConfigurations.enabled, true))).map((r) => r.testId);
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    spawned = [];
    spawnMock.mockReset().mockImplementation((_cmd: string, args: string[]) => {
      const child = new FakeChild();
      spawned.push({ args, child });
      if (args[0] === 'list') {
        // `vitest list` prints one line per test.
        setImmediate(() => {
          child.stdout.emit('data', Buffer.from('a > one\nb > two\nc > three\n'));
          child.emit('close', 0);
        });
      }
      return child;
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(emailService, 'sendTestReportEmail').mockResolvedValue(undefined as any);
    // Rendering the PDF launches Chromium; the report content has its own tests.
    vi.spyOn(pdfService, 'generateTestReportPDF').mockResolvedValue(Buffer.from('%PDF-1.4 test'));
    await runner.updateTestModeConfig('auto');
    await runner.updateScheduleConfig({ notifyEmails: ['qa@test.example'] });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    const { inArray } = orm;
    if (createdRunIds.length) {
      await db.delete(schema.testResults).where(inArray(schema.testResults.runId, createdRunIds));
      await db.delete(schema.testRuns).where(inArray(schema.testRuns.id, createdRunIds));
    }
    await db.delete(schema.testConfigurations).where(inArray(schema.testConfigurations.testId, ownConfigIds));
    if (originallyEnabled.length) {
      await db.update(schema.testConfigurations).set({ enabled: true })
        .where(inArray(schema.testConfigurations.testId, originallyEnabled));
    }
    for (const key of SETTING_KEYS) {
      const value = originalSettings.get(key);
      if (value === undefined) await storage.deleteSetting(key);
      else await storage.setSetting({ key, value });
    }
    await pool.end();
    vi.resetModules();
  });

  it('stores every result, shows live progress and emails the report when a run finishes', async () => {
    const start = await admin.post('/api/v1/admin/tests/run');
    expect(start.status).toBe(200);
    const runId = start.body.runId as number;
    createdRunIds.push(runId);

    // The expected total comes from `vitest list`, never from a real run.
    expect(spawned[0].args[0]).toBe('list');
    // Auto mode runs every server test file.
    expect(await runner.getEnabledTestFiles()).toContain(path.join('server', 'tests', 'services', 'testRunnerExecution.test.ts'));
    const s = await waitForRunSpawn(1);
    expect(s.args).toContain('--reporter=json');
    expect(s.args.some((a) => a.startsWith('--testNamePattern'))).toBe(false);

    s.child.stdout.emit('data', Buffer.from([
      ' ✓ server/tests/api/alpha.test.ts > Suite > Alpha passes 12ms',
      ' × server/tests/api/alpha.test.ts > Suite > Alpha fails 3ms',
      ' ↓ server/tests/security/beta.test.ts > Beta > Beta pending',
    ].join('\n')));
    s.child.stderr.emit('data', Buffer.from('some warning'));
    expect(runner.getLiveProgress()).toEqual({
      passed: 1, failed: 1, skipped: 1, currentTest: 'Beta pending', currentFile: 'server/tests/security/beta.test.ts',
    });

    const current = await admin.get('/api/v1/admin/test-runs/current');
    expect(current.body).toMatchObject({ id: String(runId), status: 'running', summary: { passed: 1, failed: 1, skipped: 1 } });
    expect(current.body.liveProgress.currentTest).toBe('Beta pending');

    finishWithReport(s);
    const run = await waitForFinished(runId);
    const e2eSkipped = run.skipped! - 1;
    expect(run).toMatchObject({ status: 'failed', passed: 2, failed: 1 });
    expect(run.totalTests).toBe(2 + 1 + 1 + e2eSkipped);
    expect(e2eSkipped).toBeGreaterThan(0);

    const byName = new Map(run.results.map((r) => [r.testName, r]));
    expect(byName.get('Alpha passes')).toMatchObject({ status: 'passed', duration: 12, category: 'api' });
    expect(byName.get('Alpha fails')).toMatchObject({ status: 'failed', error: 'boom\nat line 1' });
    expect(byName.get('Beta pending')).toMatchObject({ status: 'skipped', category: 'security', testFile: 'server/tests/security/beta.test.ts' });
    expect(byName.get('unknown')).toMatchObject({ status: 'passed', duration: null });
    expect(run.results.filter((r) => r.category === 'e2e' && r.error?.includes('Playwright'))).toHaveLength(e2eSkipped);

    const send = vi.mocked(emailService.sendTestReportEmail);
    await waitFor(() => send.mock.calls.length > 0, 'report email');
    const [to, payload, pdf, results] = send.mock.calls[0];
    expect(to).toBe('qa@test.example');
    expect(payload).toMatchObject({ id: runId, status: 'failed', passed: 2, failed: 1 });
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(results).toHaveLength(run.results.length);

    expect(runner.getLiveProgress()).toBeNull();
    expect((await admin.get('/api/v1/admin/test-runs/current')).body).toBeNull();
    const history = await admin.get('/api/v1/admin/test-runs?limit=100');
    const listed = history.body.find((r: any) => r.id === String(runId));
    expect(listed.summary).toEqual({ total: run.totalTests, passed: 2, failed: 1, skipped: run.skipped });
    expect(listed.results.find((r: any) => r.name === 'Alpha fails').error).toBe('boom\nat line 1');

    const pdfRes = await admin.get(`/api/v1/admin/tests/runs/${runId}/pdf`);
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');
  });

  it('marks a crashed run as failed and still sends the failure report', async () => {
    vi.mocked(pdfService.generateTestReportPDF).mockRejectedValueOnce(new Error('no browser'));
    const start = await admin.post('/api/v1/admin/test-runs');
    const runId = start.body.runId as number;
    createdRunIds.push(runId);
    const s = await waitForRunSpawn(1);

    s.child.stderr.emit('data', Buffer.from('Error: cannot start'));
    s.child.emit('close', 1);

    const run = await waitForFinished(runId);
    expect(run.status).toBe('failed');
    expect(run.results).toHaveLength(0);
    const send = vi.mocked(emailService.sendTestReportEmail);
    await waitFor(() => send.mock.calls.length > 0, 'failure email');
    expect(send.mock.calls[0][1]).toMatchObject({ id: runId, status: 'failed' });
    expect(send.mock.calls[0][3]).toEqual([]);
    // A broken PDF renderer must not suppress the notification.
    expect(send.mock.calls[0][2]).toBeUndefined();
  });

  it('runs only the enabled tests in manual mode, with an escaped name filter', async () => {
    const { testConfigurations } = schema;
    await db.update(testConfigurations).set({ enabled: false });
    await db.insert(testConfigurations).values({
      testId: ownConfigIds[1], testFile: 'server/tests/unit/coverage-only.test.ts', testName: 'a.b (c)',
      testType: 'unit', category: 'unit', enabled: true,
    }).onConflictDoUpdate({ target: testConfigurations.testId, set: { enabled: true } });
    await runner.updateTestModeConfig('manual');

    expect(await runner.getEnabledTestFiles()).toEqual(['server/tests/unit/coverage-only.test.ts']);
    const runId = await runner.runAllTests('manual');
    createdRunIds.push(runId);
    const s = await waitForRunSpawn(1);
    const pattern = s.args[s.args.indexOf('--testNamePattern') + 1];
    expect(pattern).toBe('(a\\.b \\(c\\))$');
    expect(new RegExp(pattern).test('Suite a.b (c)')).toBe(true);
    expect(s.args.at(-1)).toBe('server/tests/unit/coverage-only.test.ts');

    finishWithReport(s, { ...report, numTotalTests: 1, numPassedTests: 1, numFailedTests: 0, numSkippedTests: 0, testResults: [] });
    const run = await waitForFinished(runId);
    expect(run).toMatchObject({ status: 'completed', passed: 1, failed: 0, skipped: 0 });
  });

  it('skips E2E-only selections in manual mode without starting Vitest', async () => {
    const { testConfigurations } = schema;
    await db.update(testConfigurations).set({ enabled: false });
    await db.insert(testConfigurations).values({
      testId: ownConfigIds[0], testFile: 'e2e/navigation.spec.ts', testName: 'coverage-e2e',
      testType: 'e2e', category: 'e2e', enabled: true,
    }).onConflictDoUpdate({ target: testConfigurations.testId, set: { enabled: true } });
    await runner.updateTestModeConfig('manual');

    const runId = await runner.runAllTests('scheduled');
    createdRunIds.push(runId);
    const run = await waitForFinished(runId);
    expect(runSpawns()).toHaveLength(0);
    expect(run).toMatchObject({ status: 'completed', triggeredBy: 'scheduled', passed: 0, failed: 0 });
    expect(run.skipped).toBeGreaterThan(0);
    expect(run.results.every((r) => r.status === 'skipped' && r.testFile === 'e2e/navigation.spec.ts')).toBe(true);
  });

  it('keeps a stopped run marked as cancelled and does not send a failure report (regression)', async () => {
    const runId = await runner.runAllTests('manual');
    createdRunIds.push(runId);
    const s = await waitForRunSpawn(1);
    expect((await runner.getCurrentTestRun())?.id).toBe(runId);

    const stop = await admin.post('/api/v1/admin/test-runs/stop');
    expect(stop.body.success).toBe(true);
    expect(s.child.kill).toHaveBeenCalledWith('SIGTERM');
    expect((await runner.getTestRun(runId))?.status).toBe('cancelled');

    // The killed process exits without a report afterwards.
    s.child.emit('close', null);
    await waitFor(() => runner.getLiveProgress() === null && runSpawns().length === 1, 'process exit');
    await new Promise((r) => setTimeout(r, 200));
    expect((await runner.getTestRun(runId))?.status).toBe('cancelled');
    expect(emailService.sendTestReportEmail).not.toHaveBeenCalled();
    expect(await runner.getCurrentTestRun()).toBeNull();
  });

  it('reports spawn errors and falls back to stdout when no report file exists', async () => {
    const failing = runner.executeVitest(['server/tests/unit/x.test.ts']);
    const first = await waitForRunSpawn(1);
    first.child.emit('error', new Error('ENOENT'));
    await expect(failing).rejects.toThrow('ENOENT');

    const fromStdout = runner.executeVitest();
    const second = await waitForRunSpawn(2);
    second.child.stdout.emit('data', Buffer.from('noise {"numTotalTests":1,"numPassedTests":1} trailing'));
    second.child.emit('close', 0);
    expect(runner.parseVitestOutput(await fromStdout).numPassedTests).toBe(1);

    const plain = runner.executeVitest();
    const third = await waitForRunSpawn(3);
    third.child.stdout.emit('data', Buffer.from('no json here'));
    third.child.emit('close', 0);
    expect(await plain).toBe('no json here');
  });

  it('marks runs left over from a server restart as failed', async () => {
    const [stuck] = await db.insert(schema.testRuns).values({ status: 'running', triggeredBy: 'manual' }).returning();
    createdRunIds.push(stuck.id);
    expect(await runner.cleanupStuckTestRuns()).toBeGreaterThanOrEqual(1);
    const run = await runner.getTestRun(stuck.id);
    expect(run?.status).toBe('failed');
    expect(run?.completedAt).toBeTruthy();
    expect(await runner.cleanupStuckTestRuns()).toBe(0);
  });

  it('records the last status of an individual test', async () => {
    const { testConfigurations } = schema;
    await db.insert(testConfigurations).values({
      testId: ownConfigIds[1], testFile: 'server/tests/unit/coverage-only.test.ts', testName: 'a.b (c)',
      testType: 'unit', category: 'unit', enabled: false,
    }).onConflictDoNothing();
    await runner.updateTestStatus(ownConfigIds[1], 'passed');
    const [row] = await db.select().from(testConfigurations).where(orm.eq(testConfigurations.testId, ownConfigIds[1]));
    expect(row.lastStatus).toBe('passed');
    expect(row.lastRunAt).toBeTruthy();
  });
});
