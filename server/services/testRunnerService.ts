import { spawn } from 'child_process';
import { db } from '../db';
import { testRuns, testResults, testConfigurations, systemSettings } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';
import { emailService } from './emailService';
import { generateTestReportPDF } from './pdfService';

// Test type classification
export type TestType = 'unit' | 'integration' | 'e2e' | 'data' | 'accessibility';

// Individual test info extracted from test files
export interface IndividualTest {
  testId: string;        // unique: file:testName
  testFile: string;
  testName: string;
  testType: TestType;
  category: string;
  description?: string;
  enabled: boolean;
  lastStatus?: string;
  lastRunAt?: Date;
}

// Test mode configuration
export interface TestModeConfig {
  mode: 'auto' | 'manual';  // auto = run all, manual = run only enabled
}

const TEST_MODE_KEY = 'test_mode_config';

interface VitestAssertionResult {
  ancestorTitles?: string[];
  fullName?: string;
  title: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  duration?: number;
  failureMessages?: string[];
}

interface VitestFileResult {
  name: string;
  filepath?: string;
  assertionResults?: VitestAssertionResult[];
  tests?: VitestAssertionResult[];
}

interface VitestJsonOutput {
  numTotalTestSuites: number;
  numPassedTestSuites: number;
  numFailedTestSuites: number;
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numSkippedTests?: number;
  numPendingTests?: number;
  startTime: number;
  success: boolean;
  testResults: VitestFileResult[];
}

export interface TestCategory {
  id: string;
  name: string;
  description: string;
  testCount: number;
}

export interface TestScheduleConfig {
  enabled: boolean;
  intervalDays: number;
  runTime: string;
  lastRun?: string;
  nextRun?: string;
  notifyEmail?: string;
}

const TEST_SCHEDULE_KEY = 'test_schedule_config';

function extractCategoryFromPath(filepath: string): string {
  const parts = filepath.split('/');
  const testsIndex = parts.findIndex(p => p === 'tests');
  if (testsIndex >= 0 && testsIndex + 1 < parts.length) {
    const category = parts[testsIndex + 1];
    if (!category.includes('.test.')) {
      return category;
    }
  }
  return 'other';
}

export async function getAvailableTests(): Promise<TestCategory[]> {
  const testDir = path.join(process.cwd(), 'server', 'tests');
  const categories: Map<string, TestCategory> = new Map();
  
  const categoryInfo: Record<string, { name: string; description: string }> = {
    auth: { name: 'Authentifizierung', description: 'Login, Session, Token-Validierung' },
    api: { name: 'API-Sicherheit', description: 'Berechtigungen, Header, Input-Validierung' },
    polls: { name: 'Umfragen', description: 'CRUD-Operationen, Voting, Ergebnisse' },
    security: { name: 'Sicherheit', description: 'Security-Header, Injection-Schutz' },
    database: { name: 'Datenbank', description: 'Schema, Migrations, Queries' },
    fixtures: { name: 'Test-Fixtures', description: 'Testdaten-Generierung' },
    other: { name: 'Sonstige', description: 'Weitere Tests' },
  };

  function scanDir(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.name.endsWith('.test.ts')) {
          const category = extractCategoryFromPath(fullPath);
          const info = categoryInfo[category] || categoryInfo.other;
          
          if (!categories.has(category)) {
            categories.set(category, {
              id: category,
              name: info.name,
              description: info.description,
              testCount: 0,
            });
          }
          
          const cat = categories.get(category)!;
          cat.testCount++;
        }
      }
    } catch (error) {
      console.error('Error scanning test directory:', error);
    }
  }

  scanDir(testDir);
  return Array.from(categories.values());
}

export async function runAllTests(triggeredBy: 'manual' | 'scheduled' = 'manual'): Promise<number> {
  const [testRun] = await db.insert(testRuns).values({
    status: 'running',
    triggeredBy,
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
  }).returning();

  runTestsInBackground(testRun.id);
  
  return testRun.id;
}

async function runTestsInBackground(runId: number): Promise<void> {
  const startTime = Date.now();
  
  try {
    // Get test mode and filter tests if in manual mode
    const modeConfig = await getTestModeConfig();
    let testFiles: string[] | undefined;
    let testNamePattern: string | undefined;
    
    // Collect E2E tests to mark as skipped (Playwright not available in Replit)
    // Note: E2E tests are stored in test_configurations but NOT run by Vitest
    // They appear separately in the UI as skipped with an explanation
    const e2eTestsToSkip: Array<{ testFile: string; testName: string; category: string }> = [];
    
    if (modeConfig.mode === 'manual') {
      const enabledConfig = await getEnabledTestsConfig();
      // Filter out E2E tests from test files (they don't run in internal environment)
      testFiles = enabledConfig.files.filter(f => !f.startsWith('e2e/') && !f.includes('/e2e/'));
      testNamePattern = enabledConfig.testNamePattern;
      
      // Collect skipped E2E tests for reporting (only in manual mode when explicitly enabled)
      const skippedE2EFiles = enabledConfig.files.filter(f => f.startsWith('e2e/') || f.includes('/e2e/'));
      for (const e2eFile of skippedE2EFiles) {
        const tests = await getTestNamesFromFile(e2eFile);
        for (const testName of tests) {
          e2eTestsToSkip.push({ testFile: e2eFile, testName, category: 'e2e' });
        }
      }
      
      console.log(`[TestRunner] Running in manual mode with ${testFiles.length} test files (${e2eTestsToSkip.length} E2E tests skipped)`);
      
      // Short-circuit if no tests are enabled in manual mode (only E2E or nothing)
      if (testFiles.length === 0) {
        // Record skipped E2E tests if any
        for (const e2eTest of e2eTestsToSkip) {
          await db.insert(testResults).values({
            runId,
            testFile: e2eTest.testFile,
            testName: e2eTest.testName,
            category: e2eTest.category,
            status: 'skipped',
            duration: null,
            error: 'E2E tests require Playwright (only available in CI/CD)',
            errorStack: null,
          });
        }
        
        const hasOnlyE2E = e2eTestsToSkip.length > 0;
        console.log(`[TestRunner] No runnable tests in manual mode${hasOnlyE2E ? ' (only E2E tests enabled)' : ''}`);
        
        await db.update(testRuns)
          .set({
            status: 'completed',
            totalTests: e2eTestsToSkip.length,
            passed: 0,
            failed: 0,
            skipped: e2eTestsToSkip.length,
            duration: Date.now() - startTime,
            completedAt: new Date(),
          })
          .where(eq(testRuns.id, runId));
        return;
      }
    } else {
      // Auto mode: E2E tests are NOT included in Vitest runs at all
      // They're shown separately in the UI via test_configurations
      // No need to add them to results here - they're never "run"
      console.log('[TestRunner] Running in auto mode (server tests only, E2E excluded)');
    }
    
    const vitestOutput = await executeVitest(testFiles, testNamePattern);
    const parsed = parseVitestOutput(vitestOutput);
    
    const duration = Date.now() - startTime;
    
    const testResultsData: Array<{
      runId: number;
      testFile: string;
      testName: string;
      category: string;
      status: 'passed' | 'failed' | 'skipped';
      duration: number | null;
      error: string | null;
      errorStack: string | null;
    }> = [];
    
    for (const fileResult of parsed.testResults) {
      const category = extractCategoryFromPath(fileResult.name || fileResult.filepath || '');
      const tests = fileResult.assertionResults || fileResult.tests || [];
      
      for (const test of tests) {
        const testStatus = test.status === 'pending' ? 'skipped' : test.status;
        const resultData = {
          runId,
          testFile: fileResult.name || fileResult.filepath || 'unknown',
          testName: test.fullName || test.title || 'unknown',
          category,
          status: testStatus as 'passed' | 'failed' | 'skipped',
          duration: test.duration ? Math.round(test.duration) : null,
          error: test.failureMessages?.join('\n') || null,
          errorStack: null,
        };
        testResultsData.push(resultData);
        await db.insert(testResults).values(resultData);
      }
    }
    
    // In manual mode only: add skipped E2E tests to results
    // (auto mode doesn't track E2E tests in run results - they're shown via test_configurations)
    if (e2eTestsToSkip.length > 0) {
      for (const e2eTest of e2eTestsToSkip) {
        const resultData = {
          runId,
          testFile: e2eTest.testFile,
          testName: e2eTest.testName,
          category: e2eTest.category,
          status: 'skipped' as const,
          duration: null,
          error: 'E2E tests require Playwright (only available in CI/CD)',
          errorStack: null,
        };
        testResultsData.push(resultData);
        await db.insert(testResults).values(resultData);
      }
    }
    
    // Calculate totals: add manually-skipped E2E tests only if in manual mode
    const totalTests = parsed.numTotalTests + e2eTestsToSkip.length;
    const totalSkipped = (parsed.numSkippedTests || 0) + e2eTestsToSkip.length;
    
    const completedAt = new Date();
    await db.update(testRuns)
      .set({
        status: parsed.success ? 'completed' : 'failed',
        totalTests,
        passed: parsed.numPassedTests,
        failed: parsed.numFailedTests,
        skipped: totalSkipped,
        duration,
        completedAt,
      })
      .where(eq(testRuns.id, runId));
    
    // Send email notification if configured
    await sendTestReportNotification(runId, {
      status: parsed.success ? 'completed' : 'failed',
      totalTests,
      passed: parsed.numPassedTests,
      failed: parsed.numFailedTests,
      skipped: totalSkipped,
      duration,
      completedAt,
    }, testResultsData);
      
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Test run failed:', error);
    
    const completedAt = new Date();
    await db.update(testRuns)
      .set({
        status: 'failed',
        duration,
        completedAt,
      })
      .where(eq(testRuns.id, runId));
    
    // Send failure notification
    await sendTestReportNotification(runId, {
      status: 'failed',
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration,
      completedAt,
    }, []);
  }
}

async function sendTestReportNotification(
  runId: number,
  runData: {
    status: string;
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    completedAt: Date;
  },
  results: Array<{
    testFile: string;
    testName: string;
    category: string;
    status: 'passed' | 'failed' | 'skipped';
    duration: number | null;
    error: string | null;
    errorStack: string | null;
  }>
): Promise<void> {
  try {
    const config = await getScheduleConfig();
    
    if (!config.notifyEmail) {
      console.log('[TestRunner] No notification email configured, skipping email');
      return;
    }
    
    // Get full test run data
    const [testRun] = await db.select().from(testRuns).where(eq(testRuns.id, runId));
    if (!testRun) {
      console.error('[TestRunner] Test run not found for notification:', runId);
      return;
    }
    
    // Generate PDF report
    let pdfBuffer: Buffer | undefined;
    try {
      const fullResults = results.map((r, i) => ({
        id: i + 1,
        runId,
        testFile: r.testFile,
        testName: r.testName,
        category: r.category,
        status: r.status,
        duration: r.duration,
        error: r.error,
        errorStack: r.errorStack,
        createdAt: new Date(),
      }));
      
      pdfBuffer = await generateTestReportPDF(testRun, fullResults);
    } catch (pdfError) {
      console.error('[TestRunner] Failed to generate PDF for email:', pdfError);
    }
    
    // Send email
    await emailService.sendTestReportEmail(
      config.notifyEmail,
      {
        id: testRun.id,
        status: testRun.status,
        triggeredBy: testRun.triggeredBy,
        totalTests: testRun.totalTests ?? 0,
        passed: testRun.passed ?? 0,
        failed: testRun.failed ?? 0,
        skipped: testRun.skipped ?? 0,
        duration: testRun.duration,
        startedAt: testRun.startedAt,
        completedAt: testRun.completedAt,
      },
      pdfBuffer
    );
    
    console.log(`[TestRunner] Email notification sent to ${config.notifyEmail} for run #${runId}`);
  } catch (error) {
    console.error('[TestRunner] Failed to send email notification:', error);
  }
}

function executeVitest(testFiles?: string[], testNamePattern?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ['vitest', 'run', '--reporter=json'];
    
    // Add test name pattern filter if provided (for manual mode individual test filtering)
    // Using array args without shell=true to avoid shell interpretation of regex patterns
    if (testNamePattern) {
      args.push('--testNamePattern', testNamePattern);
    }
    
    // Add specific test files if provided
    if (testFiles && testFiles.length > 0) {
      args.push(...testFiles);
    }
    
    // Use shell: false (default) to avoid shell interpretation of special characters in patterns
    const child = spawn('npx', args, {
      cwd: process.cwd(),
      env: { ...process.env, CI: 'true' },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      const jsonMatch = stdout.match(/\{[\s\S]*"numTotalTests"[\s\S]*\}/);
      if (jsonMatch) {
        resolve(jsonMatch[0]);
      } else if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Vitest exited with code ${code}: ${stderr || stdout}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

function parseVitestOutput(output: string): VitestJsonOutput {
  try {
    const jsonMatch = output.match(/\{[\s\S]*"numTotalTests"[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return JSON.parse(output);
  } catch (error) {
    console.error('Failed to parse vitest output:', error);
    return {
      numTotalTestSuites: 0,
      numPassedTestSuites: 0,
      numFailedTestSuites: 0,
      numTotalTests: 0,
      numPassedTests: 0,
      numFailedTests: 0,
      numSkippedTests: 0,
      startTime: Date.now(),
      success: false,
      testResults: [],
    };
  }
}

export async function getTestRun(runId: number) {
  const [run] = await db.select().from(testRuns).where(eq(testRuns.id, runId));
  if (!run) return null;
  
  const results = await db.select().from(testResults).where(eq(testResults.runId, runId));
  
  return { ...run, results };
}

export async function getTestRunHistory(limit = 20) {
  return await db.select()
    .from(testRuns)
    .orderBy(desc(testRuns.startedAt))
    .limit(limit);
}

export async function getScheduleConfig(): Promise<TestScheduleConfig> {
  const { systemSettings } = await import('@shared/schema');
  
  const [setting] = await db.select()
    .from(systemSettings)
    .where(eq(systemSettings.key, TEST_SCHEDULE_KEY));
  
  if (!setting) {
    return {
      enabled: false,
      intervalDays: 7,
      runTime: '03:00',
    };
  }
  
  return setting.value as TestScheduleConfig;
}

export async function updateScheduleConfig(config: Partial<TestScheduleConfig>): Promise<TestScheduleConfig> {
  const { systemSettings } = await import('@shared/schema');
  
  const currentConfig = await getScheduleConfig();
  const newConfig = { ...currentConfig, ...config };
  
  if (newConfig.enabled) {
    newConfig.nextRun = calculateNextRun(newConfig.intervalDays, newConfig.runTime);
  }
  
  const existing = await db.select()
    .from(systemSettings)
    .where(eq(systemSettings.key, TEST_SCHEDULE_KEY));
  
  if (existing.length > 0) {
    await db.update(systemSettings)
      .set({ value: newConfig, updatedAt: new Date() })
      .where(eq(systemSettings.key, TEST_SCHEDULE_KEY));
  } else {
    await db.insert(systemSettings).values({
      key: TEST_SCHEDULE_KEY,
      value: newConfig,
      description: 'Automated test schedule configuration',
    });
  }
  
  return newConfig;
}

function calculateNextRun(intervalDays: number, runTime: string): string {
  const [hours, minutes] = runTime.split(':').map(Number);
  const now = new Date();
  const next = new Date();
  
  next.setHours(hours, minutes, 0, 0);
  
  if (next <= now) {
    next.setDate(next.getDate() + intervalDays);
  }
  
  return next.toISOString();
}

let schedulerInterval: NodeJS.Timeout | null = null;

export function startScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }
  
  schedulerInterval = setInterval(async () => {
    try {
      const config = await getScheduleConfig();
      
      if (!config.enabled || !config.nextRun) return;
      
      const now = new Date();
      const nextRun = new Date(config.nextRun);
      
      if (now >= nextRun) {
        console.log('[TestScheduler] Starting scheduled test run...');
        const runId = await runAllTests('scheduled');
        
        await updateScheduleConfig({
          lastRun: now.toISOString(),
          nextRun: calculateNextRun(config.intervalDays, config.runTime),
        });
        
        console.log(`[TestScheduler] Test run ${runId} started`);
      }
    } catch (error) {
      console.error('[TestScheduler] Error:', error);
    }
  }, 60000);
  
  console.log('[TestScheduler] Scheduler started, checking every minute');
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[TestScheduler] Scheduler stopped');
  }
}

// ===== Test Mode Configuration =====

export async function getTestModeConfig(): Promise<TestModeConfig> {
  const [setting] = await db.select()
    .from(systemSettings)
    .where(eq(systemSettings.key, TEST_MODE_KEY));
  
  if (!setting) {
    return { mode: 'auto' };
  }
  
  return setting.value as TestModeConfig;
}

export async function updateTestModeConfig(mode: 'auto' | 'manual'): Promise<TestModeConfig> {
  const newConfig: TestModeConfig = { mode };
  
  const existing = await db.select()
    .from(systemSettings)
    .where(eq(systemSettings.key, TEST_MODE_KEY));
  
  if (existing.length > 0) {
    await db.update(systemSettings)
      .set({ value: newConfig, updatedAt: new Date() })
      .where(eq(systemSettings.key, TEST_MODE_KEY));
  } else {
    await db.insert(systemSettings).values({
      key: TEST_MODE_KEY,
      value: newConfig,
      description: 'Test mode configuration (auto/manual)',
    });
  }
  
  return newConfig;
}

// ===== Test File Scanning =====

function detectTestType(filePath: string, content: string): TestType {
  // Check for explicit testType declaration in comments or code
  // Matches: // testType: 'data', /* testType: "accessibility" */, testType: 'e2e'
  const typePatterns = [
    /\/\/\s*testType:\s*['"](\w+)['"]/,      // Single-line comment
    /\/\*\s*testType:\s*['"](\w+)['"]/,      // Multi-line comment start
    /testType:\s*['"](\w+)['"]/,              // In code/object
  ];
  
  for (const pattern of typePatterns) {
    const match = content.match(pattern);
    if (match) {
      const type = match[1].toLowerCase();
      if (['unit', 'integration', 'e2e', 'data', 'accessibility'].includes(type)) {
        return type as TestType;
      }
    }
  }
  
  // Infer from file path or content
  const lowerPath = filePath.toLowerCase();
  const lowerContent = content.toLowerCase();
  
  // Priority 1: Check specific test type keywords BEFORE generic e2e path check
  // This ensures e2e/accessibility.spec.ts is detected as 'accessibility', not 'e2e'
  
  // Accessibility tests check WCAG compliance, color contrast, etc.
  if (lowerPath.includes('accessibility') || lowerPath.includes('a11y') || 
      lowerContent.includes('wcag') || lowerContent.includes('color-contrast') ||
      lowerContent.includes('axebuilder')) {
    return 'accessibility';
  }
  
  // Data tests deal with fixtures or test data generation
  // Check filename specifically for data.spec.ts or data.test.ts, OR /data/ directory
  const fileName = filePath.split('/').pop()?.toLowerCase() || '';
  if (fileName.includes('data.spec') || fileName.includes('data.test') ||
      lowerPath.includes('/data/') || lowerPath.includes('fixture') || 
      lowerContent.includes('testdata') || lowerContent.includes('fixture')) {
    return 'data';
  }
  
  // Priority 2: E2E tests (generic fallback for e2e/ directory)
  if (lowerPath.includes('/e2e/') || lowerPath.startsWith('e2e/') || 
      lowerContent.includes('playwright') || lowerContent.includes('@playwright/test')) {
    return 'e2e';
  }
  
  // Integration tests typically make HTTP requests or use database
  if (lowerContent.includes('supertest') || lowerContent.includes('request(app)') || 
      lowerContent.includes('database') || lowerPath.includes('integration')) {
    return 'integration';
  }
  
  // Default to unit test
  return 'unit';
}

interface ParsedTestMeta {
  category?: string;
  name?: string;
  description?: string;
  severity?: string;
  testType?: string;
}

function parseTestMeta(content: string): ParsedTestMeta {
  const meta: ParsedTestMeta = {};
  
  // Try to parse testMeta export
  const metaMatch = content.match(/export\s+const\s+testMeta\s*=\s*\{([^}]+)\}/s);
  if (metaMatch) {
    const metaContent = metaMatch[1];
    
    const categoryMatch = metaContent.match(/category:\s*['"](\w+)['"]/);
    if (categoryMatch) meta.category = categoryMatch[1];
    
    const nameMatch = metaContent.match(/name:\s*['"]([^'"]+)['"]/);
    if (nameMatch) meta.name = nameMatch[1];
    
    const descMatch = metaContent.match(/description:\s*['"]([^'"]+)['"]/);
    if (descMatch) meta.description = descMatch[1];
    
    const severityMatch = metaContent.match(/severity:\s*['"](\w+)['"]/);
    if (severityMatch) meta.severity = severityMatch[1];
    
    const typeMatch = metaContent.match(/testType:\s*['"](\w+)['"]/);
    if (typeMatch) meta.testType = typeMatch[1];
  }
  
  return meta;
}

interface ParsedTest {
  name: string;
  description?: string;
}

function parseTestCases(content: string): ParsedTest[] {
  const tests: ParsedTest[] = [];
  
  // Match it() or test() calls
  const testRegex = /(?:it|test)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let match;
  
  while ((match = testRegex.exec(content)) !== null) {
    tests.push({
      name: match[1],
    });
  }
  
  return tests;
}

async function getTestNamesFromFile(filePath: string): Promise<string[]> {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      return [];
    }
    const content = fs.readFileSync(fullPath, 'utf-8');
    const testCases = parseTestCases(content);
    return testCases.map(tc => tc.name);
  } catch (error) {
    console.error(`[TestRunner] Error reading test file ${filePath}:`, error);
    return [];
  }
}

export async function scanTestFiles(): Promise<IndividualTest[]> {
  const allTests: IndividualTest[] = [];
  
  function scanDir(dir: string, filePattern: RegExp) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          scanDir(fullPath, filePattern);
        } else if (filePattern.test(entry.name)) {
          const relativePath = path.relative(process.cwd(), fullPath);
          const content = fs.readFileSync(fullPath, 'utf-8');
          
          const meta = parseTestMeta(content);
          const testCases = parseTestCases(content);
          const category = meta.category || extractCategoryFromPath(fullPath);
          const testType = detectTestType(fullPath, content);
          
          for (const testCase of testCases) {
            const testId = `${relativePath}:${testCase.name}`;
            
            allTests.push({
              testId,
              testFile: relativePath,
              testName: testCase.name,
              testType,
              category,
              description: testCase.description || meta.description,
              enabled: true,
            });
          }
        }
      }
    } catch (error) {
      console.error('[TestScanner] Error scanning directory:', dir, error);
    }
  }
  
  const serverTestDir = path.join(process.cwd(), 'server', 'tests');
  scanDir(serverTestDir, /\.test\.ts$/);
  
  const e2eTestDir = path.join(process.cwd(), 'e2e');
  scanDir(e2eTestDir, /\.spec\.ts$/);
  
  return allTests;
}

// ===== Test Configuration Management =====

export async function syncTestConfigurations(): Promise<IndividualTest[]> {
  const scannedTests = await scanTestFiles();
  
  // Get existing configurations
  const existingConfigs = await db.select().from(testConfigurations);
  const existingMap = new Map(existingConfigs.map(c => [c.testId, c]));
  
  const result: IndividualTest[] = [];
  
  for (const test of scannedTests) {
    const existing = existingMap.get(test.testId);
    
    if (existing) {
      // Use existing configuration for enabled status
      result.push({
        ...test,
        enabled: existing.enabled,
        lastStatus: existing.lastStatus || undefined,
        lastRunAt: existing.lastRunAt || undefined,
      });
    } else {
      // Insert new test configuration
      await db.insert(testConfigurations).values({
        testId: test.testId,
        testFile: test.testFile,
        testName: test.testName,
        testType: test.testType,
        category: test.category,
        description: test.description || null,
        enabled: true,
      }).onConflictDoNothing();
      
      result.push(test);
    }
    
    existingMap.delete(test.testId);
  }
  
  // Clean up removed tests
  for (const [testId] of existingMap) {
    await db.delete(testConfigurations).where(eq(testConfigurations.testId, testId));
  }
  
  return result;
}

export async function getAllTestConfigurations(): Promise<IndividualTest[]> {
  // Sync first to ensure database is up-to-date with file system
  return await syncTestConfigurations();
}

export async function getTestConfigurationsByType(): Promise<Record<TestType, IndividualTest[]>> {
  const tests = await getAllTestConfigurations();
  
  const grouped: Record<TestType, IndividualTest[]> = {
    unit: [],
    integration: [],
    e2e: [],
    data: [],
    accessibility: [],
  };
  
  for (const test of tests) {
    grouped[test.testType].push(test);
  }
  
  return grouped;
}

export async function updateTestEnabled(testId: string, enabled: boolean): Promise<void> {
  await db.update(testConfigurations)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(testConfigurations.testId, testId));
}

export async function updateTestStatus(testId: string, status: string): Promise<void> {
  await db.update(testConfigurations)
    .set({ lastStatus: status, lastRunAt: new Date(), updatedAt: new Date() })
    .where(eq(testConfigurations.testId, testId));
}

export interface EnabledTestsConfig {
  files: string[];
  testNamePattern?: string; // Regex pattern for --testNamePattern
}

export async function getEnabledTestsConfig(): Promise<EnabledTestsConfig> {
  const config = await getTestModeConfig();
  
  if (config.mode === 'auto') {
    // In auto mode, return all test files without filtering
    const testDir = path.join(process.cwd(), 'server', 'tests');
    const files: string[] = [];
    
    function scanDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.name.endsWith('.test.ts')) {
          files.push(path.relative(process.cwd(), fullPath));
        }
      }
    }
    
    scanDir(testDir);
    return { files };
  }
  
  // In manual mode, return only enabled test files AND test name pattern
  const enabledConfigs = await db.select()
    .from(testConfigurations)
    .where(eq(testConfigurations.enabled, true));
  
  if (enabledConfigs.length === 0) {
    return { files: [], testNamePattern: undefined };
  }
  
  // Get unique test files
  const files = [...new Set(enabledConfigs.map(c => c.testFile))];
  
  // Build regex pattern matching enabled test names
  // Use unanchored pattern to match test names within describe blocks
  // Vitest uses full names like "Auth flow › should send email"
  // so we match the test title anywhere in the full test name
  const escapedNames = enabledConfigs.map(c => 
    c.testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  // Use word boundary or pattern that matches test titles at end or after separator
  const testNamePattern = `(${escapedNames.join('|')})$`;
  
  return { files, testNamePattern };
}

// Legacy function for backwards compatibility
export async function getEnabledTestFiles(): Promise<string[]> {
  const config = await getEnabledTestsConfig();
  return config.files;
}
