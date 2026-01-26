import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { closeTestApp } from './testApp';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
});

afterAll(async () => {
  // Ensure test app and server are properly closed
  await closeTestApp();
});

beforeEach(async () => {
});

afterEach(async () => {
});
