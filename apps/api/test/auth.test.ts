import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, request, resetDatabase, signUp, type TestContext } from './helpers.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx.app.close();
});
beforeEach(async () => {
  await resetDatabase(ctx.prisma);
  ctx.mail.outbox.length = 0;
});

describe('sign-up', () => {
  it('creates exactly one personal organization owned by the user', async () => {
    const { userId } = await signUp(ctx.app, { name: 'Ann', email: 'ann@example.com' });

    const organizations = await ctx.prisma.organization.findMany({ include: { members: true } });
    expect(organizations).toHaveLength(1);
    expect(organizations[0]).toMatchObject({ personalOwnerId: userId, name: 'Ann' });
    expect(organizations[0]?.members).toEqual([expect.objectContaining({ userId, role: 'OWNER' })]);
  });

  it('uses UUIDv7 identifiers', async () => {
    const { userId } = await signUp(ctx.app, { name: 'Ann', email: 'ann@example.com' });
    expect(userId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/);
  });

  it("stores the browser's language when no locale is given", async () => {
    const { cookie } = await signUp(
      ctx.app,
      { name: '현수', email: 'hs@example.com' },
      { 'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8' },
    );
    const me = await request(ctx.app, 'GET', '/api/v1/me', { cookie });
    expect(me.body).toMatchObject({ locale: 'ko', name: '현수' });
  });

  it('sends a verification email in the user locale', async () => {
    await signUp(ctx.app, { name: '현수', email: 'hs@example.com', locale: 'ko' } as never);
    expect(ctx.mail.outbox).toHaveLength(1);
    expect(ctx.mail.outbox[0]).toMatchObject({
      to: 'hs@example.com',
      subject: '이메일 주소를 인증해 주세요',
    });
  });

  it('rejects a password that is too short', async () => {
    const response = await request(ctx.app, 'POST', '/api/auth/sign-up/email', {
      body: { name: 'Ann', email: 'ann@example.com', password: 'short' },
    });
    expect(response.status).toBe(400);
  });
});

describe('sessions', () => {
  it('rejects API calls without a session in the standard error format', async () => {
    const response = await request(ctx.app, 'GET', '/api/v1/me');
    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
    });
  });

  it('signs in with email and password', async () => {
    await signUp(ctx.app, { name: 'Ann', email: 'ann@example.com' });
    const response = await request(ctx.app, 'POST', '/api/auth/sign-in/email', {
      body: { email: 'ann@example.com', password: 'correct-horse-battery' },
    });
    expect(response.status).toBe(200);

    const wrong = await request(ctx.app, 'POST', '/api/auth/sign-in/email', {
      body: { email: 'ann@example.com', password: 'wrong-password' },
    });
    expect(wrong.status).toBe(401);
  });
});

describe('password reset', () => {
  it('emails a reset link and accepts the new password', async () => {
    await signUp(ctx.app, { name: 'Ann', email: 'ann@example.com' });
    ctx.mail.outbox.length = 0;

    const requested = await request(ctx.app, 'POST', '/api/auth/request-password-reset', {
      body: { email: 'ann@example.com', redirectTo: '/reset-password' },
    });
    expect(requested.status).toBe(200);
    const mail = ctx.mail.outbox.at(-1);
    expect(mail?.subject).toBe('Reset your password');
    const token = /reset-password\?token=([^\s"]+)/.exec(mail?.text ?? '')?.[1];
    expect(token).toBeTruthy();

    const reset = await request(ctx.app, 'POST', '/api/auth/reset-password', {
      body: { token: decodeURIComponent(token!), newPassword: 'a-brand-new-password' },
    });
    expect(reset.status).toBe(200);

    const signIn = await request(ctx.app, 'POST', '/api/auth/sign-in/email', {
      body: { email: 'ann@example.com', password: 'a-brand-new-password' },
    });
    expect(signIn.status).toBe(200);
  });
});
