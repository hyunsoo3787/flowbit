import {
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { Redis } from 'ioredis';
import { ENV, type Env } from '../config/env.js';
import { ValkeyService } from '../valkey/valkey.service.js';

type Handler = (data: unknown) => Promise<void>;

interface Job {
  name: string;
  data: unknown;
  attempts: number;
}

const QUEUE = 'jobs:queue';
const DELAYED = 'jobs:delayed';
const MAX_ATTEMPTS = 5;

/** Moves delayed jobs that are due back onto the queue, atomically. */
const PROMOTE_SCRIPT = `
local due = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, 100)
for _, job in ipairs(due) do
  redis.call('ZREM', KEYS[1], job)
  redis.call('LPUSH', KEYS[2], job)
end
return #due
`;

/** Retry after 2 s, 4 s, 8 s, … */
const backoff = (attempts: number) => 1000 * 2 ** attempts;

/**
 * Background jobs and recurring tasks (phase 4).
 *
 * With Valkey, jobs go through a Valkey list, so any replica can run them and
 * they survive a restart of the replica that queued them; failed jobs are
 * retried with backoff, and a recurring task runs on one replica at a time.
 * Without Valkey (a single self-hosted instance), jobs run in-process.
 * In tests, jobs run immediately so results can be awaited.
 */
@Injectable()
export class JobsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(JobsService.name);
  private readonly handlers = new Map<string, Handler>();
  private readonly recurring: { name: string; everyMs: number; run: () => Promise<void> }[] = [];
  private readonly timers: NodeJS.Timeout[] = [];
  private worker: Redis | null = null;
  private stopped = false;

  constructor(
    private readonly valkey: ValkeyService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private get inline() {
    return this.env.NODE_ENV === 'test';
  }

  register<T>(name: string, handler: (data: T) => Promise<void>) {
    this.handlers.set(name, handler as Handler);
  }

  /** Runs `run` every `everyMs`, on one replica at a time. */
  every(name: string, everyMs: number, run: () => Promise<void>) {
    this.recurring.push({ name, everyMs, run });
  }

  async enqueue(name: string, data: unknown) {
    const job: Job = { name, data, attempts: 0 };
    if (this.inline) return this.execute(job);
    if (this.valkey.client) {
      await this.valkey.client.lpush(QUEUE, JSON.stringify(job));
    } else {
      setImmediate(() => void this.runLocally(job));
    }
  }

  onApplicationBootstrap() {
    if (this.inline) return;
    for (const task of this.recurring) {
      this.timers.push(setInterval(() => void this.runRecurring(task), task.everyMs).unref());
    }
    if (this.valkey.client) {
      this.worker = this.valkey.client.duplicate();
      this.worker.on('error', () => undefined);
      void this.work(this.worker);
      this.timers.push(setInterval(() => void this.promote(), 1000).unref());
    }
  }

  async onApplicationShutdown() {
    this.stopped = true;
    for (const timer of this.timers) clearInterval(timer);
    this.worker?.disconnect();
  }

  private async work(connection: Redis) {
    while (!this.stopped) {
      try {
        const popped = await connection.brpop(QUEUE, 2);
        if (!popped) continue;
        const job = JSON.parse(popped[1]) as Job;
        try {
          await this.execute(job);
        } catch (error) {
          await this.retry(job, error);
        }
      } catch (error) {
        if (this.stopped) return;
        this.logger.warn(`Job worker error: ${String(error)}`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  private async retry(job: Job, error: unknown) {
    const attempts = job.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      this.logger.error(`Job ${job.name} failed ${attempts} times, giving up: ${String(error)}`);
      return;
    }
    this.logger.warn(`Job ${job.name} failed, retrying: ${String(error)}`);
    await this.valkey.client?.zadd(
      DELAYED,
      Date.now() + backoff(attempts),
      JSON.stringify({ ...job, attempts }),
    );
  }

  private async promote() {
    try {
      await this.valkey.client?.eval(PROMOTE_SCRIPT, 2, DELAYED, QUEUE, Date.now());
    } catch (error) {
      this.logger.warn(`Could not promote delayed jobs: ${String(error)}`);
    }
  }

  private async runLocally(job: Job) {
    try {
      await this.execute(job);
    } catch (error) {
      const attempts = job.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        this.logger.error(`Job ${job.name} failed ${attempts} times, giving up: ${String(error)}`);
        return;
      }
      setTimeout(() => void this.runLocally({ ...job, attempts }), backoff(attempts)).unref();
    }
  }

  private async execute(job: Job) {
    const handler = this.handlers.get(job.name);
    if (!handler) throw new Error(`No handler for job ${job.name}`);
    await handler(job.data);
  }

  private async runRecurring(task: { name: string; everyMs: number; run: () => Promise<void> }) {
    try {
      // With several replicas, only the one that takes the lock runs the task.
      if (this.valkey.client) {
        const lock = await this.valkey.client.set(
          `jobs:lock:${task.name}`,
          '1',
          'PX',
          Math.max(task.everyMs - 500, 500),
          'NX',
        );
        if (lock !== 'OK') return;
      }
      await task.run();
    } catch (error) {
      this.logger.warn(`Recurring task ${task.name} failed: ${String(error)}`);
    }
  }
}

@Global()
@Module({ providers: [JobsService], exports: [JobsService] })
export class JobsModule {}
