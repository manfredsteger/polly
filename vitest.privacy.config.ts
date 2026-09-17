import { defineConfig } from 'vitest/config';

// Deliberately separate from vitest.config.ts: no database setup, seeding or cleanup.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/privacy-tests/**/*.test.ts'],
  },
});
