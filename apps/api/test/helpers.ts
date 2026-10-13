import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../src/app.factory.js';
import { MailService } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

export const ORIGIN = 'http://localhost:5173';

export interface TestContext {
  app: NestFastifyApplication;
  prisma: PrismaService;
  mail: MailService;
}

export async function createTestContext(): Promise<TestContext> {
  const app = await createApp({ logger: false });
  return { app, prisma: app.get(PrismaService), mail: app.get(MailService) };
}

export async function resetDatabase(prisma: PrismaService) {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map(({ tablename }) => `"${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} CASCADE`);
}

interface RequestOptions {
  cookie?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export async function request(
  app: NestFastifyApplication,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  { cookie, body, headers }: RequestOptions = {},
) {
  const response = await app.inject({
    method,
    url,
    headers: {
      origin: ORIGIN,
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
  });
  return {
    status: response.statusCode,
    body: response.body ? (response.json() as Record<string, unknown>) : undefined,
    cookies: response.cookies,
  };
}

/** Signs up a user and returns a cookie header for their session. */
export async function signUp(
  app: NestFastifyApplication,
  user: { name: string; email: string; password?: string },
  headers: Record<string, string> = {},
) {
  const response = await request(app, 'POST', '/api/auth/sign-up/email', {
    body: { password: 'correct-horse-battery', ...user },
    headers,
  });
  if (response.status !== 200) {
    throw new Error(`Sign-up failed (${response.status}): ${JSON.stringify(response.body)}`);
  }
  const cookie = response.cookies.map(({ name, value }) => `${name}=${value}`).join('; ');
  const userId = (response.body?.['user'] as { id: string }).id;
  return { cookie, userId };
}
