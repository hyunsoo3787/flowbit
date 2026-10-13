import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ENV, type Env } from '../config/env.js';

// Fixed-window counter: increments the key and sets its expiry on first use.
const CONSUME_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return {count, redis.call('TTL', KEYS[1])}
`;

/**
 * Valkey client (Redis protocol). Valkey holds no durable state: it is used
 * for rate limiting now, and for real-time fan-out and job queues later.
 * It is optional for single-instance self-hosted deployments.
 */
@Injectable()
export class ValkeyService implements OnModuleDestroy {
  private readonly logger = new Logger(ValkeyService.name);
  readonly client: Redis | null;

  constructor(@Inject(ENV) env: Env) {
    this.client = env.VALKEY_URL
      ? new Redis(env.VALKEY_URL, { lazyConnect: false, maxRetriesPerRequest: 2 })
      : null;
    this.client?.on('error', (error: Error) => this.logger.warn(`Valkey error: ${error.message}`));
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  async ping(): Promise<boolean> {
    if (!this.client) return false;
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  /** Counts one hit against `key` in a fixed window of `windowSeconds`. */
  async consume(
    key: string,
    windowSeconds: number,
    max: number,
  ): Promise<{ allowed: boolean; retryAfter: number | null }> {
    if (!this.client) throw new Error('Valkey is not configured');
    const [count, ttl] = (await this.client.eval(CONSUME_SCRIPT, 1, key, windowSeconds)) as [
      number,
      number,
    ];
    return count <= max
      ? { allowed: true, retryAfter: null }
      : { allowed: false, retryAfter: Math.max(ttl, 1) };
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }
}
