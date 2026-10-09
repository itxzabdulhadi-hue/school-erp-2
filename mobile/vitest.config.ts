import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Pure-logic tests only (api client, permissions) — no react-native imports.
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 15000,
  },
});
