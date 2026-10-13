import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
// Set E2E_BASE_URL to test an already running deployment instead of starting one.
const externalBaseURL = process.env['E2E_BASE_URL'];
const baseURL = externalBaseURL ?? `http://localhost:${PORT}`;
const databaseUrl =
  process.env['E2E_DATABASE_URL'] ?? 'postgresql://flowbit:flowbit@localhost:5432/flowbit_test';
// Use a preinstalled browser when one is provided (e.g. in sandboxes without downloads).
const executablePath = process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE'];

/**
 * End-to-end tests run against the production setup: the built API server
 * serving the built web app from one process (docs/ARCHITECTURE.md, "Deployment").
 * Build first: `pnpm build` at the repository root.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: 'pnpm --filter @flowbit/api db:deploy && node ../api/dist/src/main.js',
        url: `${baseURL}/api/v1/health`,
        reuseExistingServer: !process.env['CI'],
        timeout: 60_000,
        env: {
          NODE_ENV: 'test',
          LOG_LEVEL: 'warn',
          PORT: String(PORT),
          PUBLIC_URL: baseURL,
          DATABASE_URL: databaseUrl,
          AUTH_SECRET: 'e2e-test-secret-e2e-test-secret-e2e-test',
          WEB_DIST_DIR: 'dist',
        },
      },
});
