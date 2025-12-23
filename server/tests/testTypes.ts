export interface TestMeta {
  category: 'auth' | 'api' | 'polls' | 'security' | 'database' | 'fixtures' | 'data';
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

export interface TestResult {
  id: string;
  testFile: string;
  testName: string;
  category: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  errorStack?: string;
  timestamp: Date;
}

export interface TestRunSummary {
  id: string;
  startedAt: Date;
  completedAt?: Date;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  results: TestResult[];
  triggeredBy: 'manual' | 'scheduled';
}

export interface TestScheduleConfig {
  enabled: boolean;
  intervalDays: number;
  runTime: string;
  lastRun?: Date;
  nextRun?: Date;
  notifyEmail?: string;
}
