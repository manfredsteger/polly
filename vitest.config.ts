import { defineConfig } from 'vitest/config';
import path from 'path';
import { testDatabaseEnvironment } from './server/lib/testDatabaseSafety';

// Runs before setup or test imports can create the application connection pool.
Object.assign(process.env, testDatabaseEnvironment(process.env));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['server/tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['server/tests/setup.ts'],
    globalSetup: ['server/tests/globalTeardown.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
    pool: 'forks' as const,
    // Vitest 4: poolOptions.forks.singleFork was removed; the equivalent is
    // disabling file parallelism so all test files share one sequential fork.
    fileParallelism: false,
    maxWorkers: 1,
    isolate: false,
    sequence: {
      concurrent: false,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['server/**/*.ts'],
      exclude: [
        'server/tests/**',
        // Test files outside server/tests (e.g. DB-free privacy tests) are not source code.
        'server/**/*.test.ts',
        'server/vite.ts',
        'node_modules/**',
      ],
      // Coverage gate (enforced in CI). Thresholds are a ratchet: set about one
      // point below the last measured full run so normal fluctuation passes,
      // but a real coverage drop fails the build. Raise them whenever new
      // tests lift the measurement; never lower them to make CI green.
      //   Oct 2026 baseline: 45.6 % statements / 42.9 % branches / 49.4 % functions / 46.4 % lines
      //   Oct 2026 after targeted tests: 67.1 % / 63.4 % / 72.7 % / 67.8 %
      //   Oct 2026 scheduler/OIDC helpers: 68.83 % / 65.16 % / 74.64 % / 69.56 %
      //   Oct 2026 test runner, admin failures, vote emails: 75.8 % / 70.11 % / 81.22 % / 76.53 %
      //   Oct 2026 legacy email layout removed: 77.01 % / 70.57 % / 81.68 % / 76.27 %
      //   Oct 2026 auth/poll-edit errors, storage edges, admin branding, system routes: 80.95 % / 76 % / 86.11 % / 81.42 %
      // Next milestone: 85 % lines/statements, 80 % branches, 90 % functions.
      thresholds: {
        lines: 80,
        branches: 75,
        functions: 85,
        statements: 80,
      },
    },
  },
  // Component tests (e.g. server/tests/ui/*Render.test.ts) import client .tsx files,
  // which rely on the automatic JSX runtime; tsconfig's "preserve" is for Vite only.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
      '@server': path.resolve(__dirname, 'server'),
      '@': path.resolve(__dirname, 'client/src'),
    },
  },
});
