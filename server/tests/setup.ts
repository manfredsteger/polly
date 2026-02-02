import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
});

afterAll(async () => {
  // Don't close the pool here - it's shared across all test files
  // The pool is closed in globalTeardown.ts which runs once after ALL tests
});

beforeEach(async () => {
});

afterEach(async () => {
});
