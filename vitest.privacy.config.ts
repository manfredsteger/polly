import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Deliberately separate from vitest.config.ts: no database setup, seeding or cleanup.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: { '@shared': path.resolve(__dirname, 'shared'), '@': path.resolve(__dirname, 'client/src') },
  },
  test: {
    environment: 'node',
    include: ['server/privacy-tests/**/*.test.ts'],
  },
});
