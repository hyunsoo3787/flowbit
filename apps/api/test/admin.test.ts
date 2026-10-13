import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SetupService } from '../src/admin/setup.service.js';
import {
  createTestContext,
  createWorkspace,
  type Method,
  request,
  resetDatabase,
  signUp,
  type TestContext,
} from './helpers.js';

let ctx: TestContext;
let ann: { cookie: string; userId: string };
let bob: { cookie: string; userId: string };

type Json = Record<string, unknown>;

beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx.app.close();
});
beforeEach(async () => {
  await resetDatabase(ctx.prisma);
  ann = await signUp(ctx.app, { name: 'Ann', email: 'ann@example.com' });
  bob = await signUp(ctx.app, { name: 'Bob', email: 'bob@example.com' });
});

async function call(method: Method, url: string, body?: unknown, cookie = ann.cookie) {
  return request(ctx.app, method, url, { cookie, body });
}

async function ok(method: Method, url: string, body?: unknown, cookie = ann.cookie) {
  const response = await call(method, url, body, cookie);
  if (response.status >= 300) {
    throw new Error(`${method} ${url} → ${response.status} ${JSON.stringify(response.body)}`);
  }
  return (response.body ?? {}) as Json;
}

async function makeAdmin(userId: string) {
  await ctx.prisma.user.update({ where: { id: userId }, data: { isAdmin: true } });
}

async function signIn(email: string, password = 'correct-horse-battery') {
  return request(ctx.app, 'POST', '/api/auth/sign-in/email', { body: { email, password } });
}

describe('setup', () => {
  it('makes the signed-in caller the first administrator, once', async () => {
    expect((await call('GET', '/api/v1/setup')).body).toEqual({ required: true });
    const token = await ctx.app.get(SetupService).ensureToken();
    expect(token).toEqual(expect.any(String));

    const wrong = await call('POST', '/api/v1/setup', { token: 'nope' });
    expect(wrong.status).toBe(404);
    expect(wrong.body).toMatchObject({ error: { code: 'SETUP_NOT_AVAILABLE' } });

    await ok('POST', '/api/v1/setup', { token });
    expect((await ok('GET', '/api/v1/me'))['isAdmin']).toBe(true);
    expect((await call('GET', '/api/v1/setup')).body).toEqual({ required: false });
    expect((await call('POST', '/api/v1/setup', { token }, bob.cookie)).status).toBe(404);
  });

  it('creates a new administrator account and signs it in', async () => {
    const token = await ctx.app.get(SetupService).ensureToken();
    const response = await request(ctx.app, 'POST', '/api/v1/setup', {
      body: {
        token,
        account: { name: 'Root', email: 'Root@Example.com', password: 'correct-horse-battery' },
      },
    });
    expect(response.status).toBe(200);
    const cookie = response.cookies.map(({ name, value }) => `${name}=${value}`).join('; ');
    const me = await ok('GET', '/api/v1/me', undefined, cookie);
    expect(me).toMatchObject({ email: 'root@example.com', isAdmin: true, emailVerified: true });
  });

  it('creates only one administrator when the token is used twice at once', async () => {
    const token = await ctx.app.get(SetupService).ensureToken();
    const results = await Promise.all(
      [ann, bob].map((user) => call('POST', '/api/v1/setup', { token }, user.cookie)),
    );
    expect(results.map((result) => result.status).sort()).toEqual([200, 404]);
    expect(await ctx.prisma.user.count({ where: { isAdmin: true } })).toBe(1);
  });

  it('keeps the token when creating the account fails', async () => {
    const token = await ctx.app.get(SetupService).ensureToken();
    const taken = await request(ctx.app, 'POST', '/api/v1/setup', {
      body: {
        token,
        account: { name: 'Ann', email: 'ann@example.com', password: 'correct-horse-battery' },
      },
    });
    expect(taken.status).toBe(409);
    expect((await call('POST', '/api/v1/setup', { token })).status).toBe(200);
  });

  it('works even when sign-up is closed', async () => {
    await ctx.prisma.instanceSetting.create({ data: { key: 'signUpEnabled', value: false } });
    const token = await ctx.app.get(SetupService).ensureToken();
    const response = await request(ctx.app, 'POST', '/api/v1/setup', {
      body: {
        token,
        account: { name: 'Root', email: 'root@example.com', password: 'correct-horse-battery' },
      },
    });
    expect(response.status).toBe(200);
  });
});

describe('admin API', () => {
  beforeEach(async () => {
    await makeAdmin(ann.userId);
  });

  it('is only for administrators', async () => {
    expect((await call('GET', '/api/v1/admin/stats', undefined, bob.cookie)).status).toBe(403);
    expect((await request(ctx.app, 'GET', '/api/v1/admin/stats')).status).toBe(401);
  });

  it('shows statistics but no content', async () => {
    await createWorkspace(ctx.app, bob.cookie);
    expect(await ok('GET', '/api/v1/admin/stats')).toMatchObject({
      users: 2,
      admins: 1,
      organizations: 2,
      workspaces: 1,
    });
    // The admin role grants no access to anyone's workspaces.
    const workspaces = await ok('GET', '/api/v1/workspaces');
    expect(workspaces['items']).toEqual([]);
  });

  it('lists and searches accounts', async () => {
    const page = await ok('GET', '/api/v1/admin/users');
    expect((page['items'] as Json[]).map((user) => user['email'])).toEqual([
      'bob@example.com',
      'ann@example.com',
    ]);
    expect((page['items'] as Json[])[1]).toMatchObject({
      isAdmin: true,
      signInMethods: ['credential'],
      organizations: 1,
    });
    const search = await ok('GET', '/api/v1/admin/users?query=BOB');
    expect((search['items'] as Json[]).map((user) => user['name'])).toEqual(['Bob']);
  });

  it('suspends an account, ending its sessions, and reactivates it', async () => {
    const suspended = await ok('POST', `/api/v1/admin/users/${bob.userId}/suspend`);
    expect(suspended['suspendedAt']).toEqual(expect.any(String));
    expect((await call('GET', '/api/v1/me', undefined, bob.cookie)).status).toBe(401);
    const signInAttempt = await signIn('bob@example.com');
    expect(signInAttempt.status).toBe(403);
    expect(signInAttempt.body).toMatchObject({ code: 'ACCOUNT_SUSPENDED' });

    await ok('POST', `/api/v1/admin/users/${bob.userId}/reactivate`);
    expect((await signIn('bob@example.com')).status).toBe(200);
  });

  it('never leaves the instance without an administrator', async () => {
    expect((await call('POST', `/api/v1/admin/users/${ann.userId}/suspend`)).status).toBe(400);
    const revoke = await call('DELETE', `/api/v1/admin/users/${ann.userId}/admin`);
    expect(revoke.status).toBe(409);
    expect(revoke.body).toMatchObject({ error: { code: 'LAST_ADMIN' } });

    await ok('PUT', `/api/v1/admin/users/${bob.userId}/admin`);
    await ok('DELETE', `/api/v1/admin/users/${ann.userId}/admin`);
    expect((await ok('GET', '/api/v1/me'))['isAdmin']).toBe(false);
  });

  it('issues a one-time password reset link', async () => {
    const link = await ok('POST', `/api/v1/admin/users/${bob.userId}/password-reset-link`);
    const token = new URL(String(link['url'])).searchParams.get('token')!;
    const reset = await request(ctx.app, 'POST', '/api/auth/reset-password', {
      body: { token, newPassword: 'a-brand-new-password' },
    });
    expect(reset.status).toBe(200);
    expect((await signIn('bob@example.com', 'a-brand-new-password')).status).toBe(200);
    // Used once.
    const again = await request(ctx.app, 'POST', '/api/auth/reset-password', {
      body: { token, newPassword: 'another-new-password' },
    });
    expect(again.status).toBe(400);

    const log = await ok('GET', '/api/v1/admin/actions');
    expect((log['items'] as Json[])[0]).toMatchObject({
      type: 'user.password_reset_link',
      actor: { email: 'ann@example.com' },
      target: { email: 'bob@example.com' },
    });
  });

  it('closes sign-up, except for invited addresses', async () => {
    await ok('PATCH', '/api/v1/admin/settings', { signUpEnabled: false });
    expect((await call('GET', '/api/v1/auth/config')).body).toMatchObject({ signUpEnabled: false });
    await expect(signUp(ctx.app, { name: 'Eve', email: 'eve@example.com' })).rejects.toThrow('403');

    const workspace = await createWorkspace(ctx.app, ann.cookie);
    await ok('POST', `/api/v1/workspaces/${workspace.id}/invitations`, {
      emails: ['dan@example.com'],
    });
    await expect(signUp(ctx.app, { name: 'Dan', email: 'dan@example.com' })).resolves.toBeTruthy();
  });

  it('deletes an account but keeps workspaces other people use', async () => {
    const shared = await createWorkspace(ctx.app, bob.cookie, 'Shared');
    const solo = await createWorkspace(ctx.app, bob.cookie, 'Solo');
    const link = await ok(
      'POST',
      `/api/v1/workspaces/${shared.id}/invitation-link`,
      { role: 'MEMBER' },
      bob.cookie,
    );
    const token = String(link['url']).split('/invite/')[1];
    await ok('POST', `/api/v1/invitations/${token}/accept`);

    await ok('DELETE', `/api/v1/admin/users/${bob.userId}`);
    expect(await ctx.prisma.user.count()).toBe(1);
    const workspace = await ok('GET', `/api/v1/workspaces/${shared.id}`);
    expect(workspace['role']).toBe('ADMIN');
    expect(await ctx.prisma.workspace.findUnique({ where: { id: solo.id } })).toBeNull();
    const log = await ok('GET', '/api/v1/admin/actions');
    expect((log['items'] as Json[])[0]).toMatchObject({
      type: 'user.deleted',
      target: null,
      targetEmail: 'bob@example.com',
    });
  });
});
