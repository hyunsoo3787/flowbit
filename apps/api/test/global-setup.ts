import { execFileSync } from 'node:child_process';

/** Applies all migrations to the test database once before the integration tests. */
export default function setup() {
  const databaseUrl =
    process.env['TEST_DATABASE_URL'] ?? 'postgresql://flowbit:flowbit@localhost:5432/flowbit_test';
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}
