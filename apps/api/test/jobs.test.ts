import { afterEach, describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env.js';
import { JobsService } from '../src/jobs/jobs.service.js';
import { ValkeyService } from '../src/valkey/valkey.service.js';

const valkeyUrl = process.env['TEST_VALKEY_URL'];
const started: { jobs: JobsService; valkey: ValkeyService }[] = [];

/** A JobsService as in production (not inline), on the test Valkey. */
async function start(configure: (jobs: JobsService) => void) {
  const env = parseEnv({
    NODE_ENV: 'development',
    PUBLIC_URL: 'http://localhost:3000',
    AUTH_SECRET: 'x'.repeat(32),
    DATABASE_URL: 'postgresql://unused',
    VALKEY_URL: valkeyUrl,
  });
  const valkey = new ValkeyService(env);
  await valkey.client!.del('jobs:queue', 'jobs:delayed', 'jobs:lock:tick');
  const jobs = new JobsService(valkey, env);
  configure(jobs);
  jobs.onApplicationBootstrap();
  started.push({ jobs, valkey });
  return jobs;
}

async function waitFor(check: () => boolean, timeout = 8000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error('Timed out');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

afterEach(async () => {
  for (const { jobs, valkey } of started.splice(0)) {
    await jobs.onApplicationShutdown();
    await valkey.onModuleDestroy();
  }
});

describe.skipIf(!valkeyUrl)('JobsService on Valkey (needs TEST_VALKEY_URL)', () => {
  it('runs queued jobs and retries failures with backoff', async () => {
    const seen: string[] = [];
    let failures = 1;
    const jobs = await start((service) =>
      service.register('greet', async (data: { name: string }) => {
        if (data.name === 'flaky' && failures-- > 0) throw new Error('try again');
        seen.push(data.name);
      }),
    );
    await jobs.enqueue('greet', { name: 'ann' });
    await jobs.enqueue('greet', { name: 'flaky' });
    await waitFor(() => seen.includes('ann') && seen.includes('flaky'));
    expect(seen).toEqual(['ann', 'flaky']);
  });

  it('runs a recurring task on one instance at a time', async () => {
    let runs = 0;
    const tick = (service: JobsService) =>
      service.every('tick', 300, async () => {
        runs++;
      });
    await start(tick);
    await start(tick);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // Two instances, ~3 periods: without the lock this would be about 6.
    expect(runs).toBeGreaterThanOrEqual(2);
    expect(runs).toBeLessThanOrEqual(4);
  });
});
