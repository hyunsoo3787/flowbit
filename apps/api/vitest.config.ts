import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC (instead of esbuild) so NestJS decorators emit the metadata DI relies on.
const plugins = [swc.vite({ module: { type: 'es6' } })];

const testDatabaseUrl =
  process.env['TEST_DATABASE_URL'] ?? 'postgresql://flowbit:flowbit@localhost:5432/flowbit_test';

export default defineConfig({
  test: {
    projects: [
      {
        plugins,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        plugins,
        test: {
          name: 'integration',
          include: ['test/**/*.test.ts'],
          globalSetup: ['test/global-setup.ts'],
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 30_000,
          env: {
            NODE_ENV: 'test',
            LOG_LEVEL: 'error',
            DATABASE_URL: testDatabaseUrl,
            PUBLIC_URL: 'http://localhost:5173',
            AUTH_SECRET: 'integration-test-secret-integration-test-secret',
            VALKEY_URL: process.env['TEST_VALKEY_URL'] ?? '',
          },
        },
      },
    ],
  },
});
