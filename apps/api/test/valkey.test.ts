import { afterAll, describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env.js';
import { ValkeyService } from '../src/valkey/valkey.service.js';

const valkeyUrl = process.env['TEST_VALKEY_URL'];

describe.skipIf(!valkeyUrl)('ValkeyService.consume (needs TEST_VALKEY_URL)', () => {
  const service = new ValkeyService(parseEnv({ ...process.env, VALKEY_URL: valkeyUrl }));

  afterAll(async () => {
    await service.onModuleDestroy();
  });

  it('allows up to `max` hits per window, then reports when to retry', async () => {
    const key = `test:rate-limit:${crypto.randomUUID()}`;
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await service.consume(key, 60, 3));

    expect(results.slice(0, 3)).toEqual(Array(3).fill({ allowed: true, retryAfter: null }));
    expect(results[3]?.allowed).toBe(false);
    expect(results[3]?.retryAfter).toBeGreaterThan(0);
    expect(results[3]?.retryAfter).toBeLessThanOrEqual(60);
  });
});
