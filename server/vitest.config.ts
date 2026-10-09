import { defineConfig } from 'vitest/config';

export default defineConfig({
  // No CSS in the API: also stops Vite from loading the web app's root postcss.config.js.
  css: false,
  test: {
    environment: 'node',
    setupFiles: ['./src/tests/setup-file.ts'],
    include: ['src/tests/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    env: {
      NODE_ENV: 'test',
      UPLOAD_DIR: '/tmp/erp-test-uploads',
      JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdef',
      JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcdef',
    },
  },
});
