import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
let cat: { cookie: string; userId: string };
let workspaceId: string;
let boardId: string;

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
  cat = await signUp(ctx.app, { name: 'Cat', email: 'cat@example.com' });
  workspaceId = (await createWorkspace(ctx.app, ann.cookie)).id;
  boardId = (await ok('POST', `/api/v1/workspaces/${workspaceId}/boards`, { name: 'Roadmap' }))[
    'id'
  ] as string;
  ctx.mail.outbox.length = 0;
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

function tokenOf(url: unknown) {
  return String(url).split('/invite/')[1]!;
}

describe('workspace invitations', () => {
  it('invites by email; only that address can accept, once', async () => {
    const { items } = (await ok('POST', `/api/v1/workspaces/${workspaceId}/invitations`, {
      emails: ['Bob@Example.com'],
      role: 'MEMBER',
    })) as { items: Json[] };
    expect(items[0]).toMatchObject({ email: 'bob@example.com', role: 'MEMBER' });
    expect(ctx.mail.outbox.at(-1)).toMatchObject({ to: 'bob@example.com' });
    expect(ctx.mail.outbox.at(-1)!.subject).toContain('Team');
    const token = tokenOf(items[0]!['url']);

    // Anyone can preview; only Bob can accept.
    const preview = await request(ctx.app, 'GET', `/api/v1/invitations/${token}`);
    expect(preview.body).toMatchObject({
      kind: 'workspace',
      workspaceName: 'Team',
      invitedByName: 'Ann',
    });
    const byCat = await call('POST', `/api/v1/invitations/${token}/accept`, undefined, cat.cookie);
    expect(byCat.status).toBe(403);
    expect(byCat.body).toMatchObject({ error: { code: 'INVITATION_EMAIL_MISMATCH' } });

    const accepted = await ok('POST', `/api/v1/invitations/${token}/accept`, undefined, bob.cookie);
    expect(accepted).toEqual({ workspaceId, boardId: null });
    const workspace = await ok('GET', `/api/v1/workspaces/${workspaceId}`, undefined, bob.cookie);
    expect(workspace['role']).toBe('MEMBER');

    const again = await call('POST', `/api/v1/invitations/${token}/accept`, undefined, bob.cookie);
    expect(again.status).toBe(404);
  });

  it('shares a link that works for anyone until it is replaced or revoked', async () => {
    const link = await ok('POST', `/api/v1/workspaces/${workspaceId}/invitation-link`, {
      role: 'VIEWER',
    });
    expect(link['email']).toBeNull();
    await ok('POST', `/api/v1/invitations/${tokenOf(link['url'])}/accept`, undefined, bob.cookie);
    await ok('POST', `/api/v1/invitations/${tokenOf(link['url'])}/accept`, undefined, cat.cookie);
    const members = await ok('GET', `/api/v1/workspaces/${workspaceId}/members`);
    expect((members['items'] as { role: string }[]).map((member) => member.role)).toEqual([
      'ADMIN',
      'VIEWER',
      'VIEWER',
    ]);

    const replaced = await ok('POST', `/api/v1/workspaces/${workspaceId}/invitation-link`, {});
    expect((await call('GET', `/api/v1/invitations/${tokenOf(link['url'])}`)).status).toBe(404);
    await ok('DELETE', `/api/v1/invitations/${replaced['id']}`);
    expect((await call('GET', `/api/v1/invitations/${tokenOf(replaced['url'])}`)).status).toBe(404);
  });

  it('never lowers a role someone already has', async () => {
    const link = await ok('POST', `/api/v1/workspaces/${workspaceId}/invitation-link`, {
      role: 'VIEWER',
    });
    await ok('POST', `/api/v1/invitations/${tokenOf(link['url'])}/accept`);
    const workspace = await ok('GET', `/api/v1/workspaces/${workspaceId}`);
    expect(workspace['role']).toBe('ADMIN');
  });

  it('lets only admins invite and see invitations', async () => {
    const link = await ok('POST', `/api/v1/workspaces/${workspaceId}/invitation-link`, {});
    await ok('POST', `/api/v1/invitations/${tokenOf(link['url'])}/accept`, undefined, bob.cookie);
    expect(
      (await call('GET', `/api/v1/workspaces/${workspaceId}/invitations`, undefined, bob.cookie))
        .status,
    ).toBe(403);
    const invite = await call(
      'POST',
      `/api/v1/workspaces/${workspaceId}/invitations`,
      { emails: ['x@example.com'] },
      bob.cookie,
    );
    expect(invite.status).toBe(403);
    expect(
      (await call('GET', `/api/v1/workspaces/${workspaceId}/invitations`, undefined, cat.cookie))
        .status,
    ).toBe(404);
  });

  it('rejects malformed and unknown tokens alike', async () => {
    expect((await call('GET', '/api/v1/invitations/short')).status).toBe(404);
    expect((await call('GET', `/api/v1/invitations/${'a'.repeat(32)}`)).status).toBe(404);
  });
});

describe('workspace members', () => {
  beforeEach(async () => {
    const link = await ok('POST', `/api/v1/workspaces/${workspaceId}/invitation-link`, {});
    await ok('POST', `/api/v1/invitations/${tokenOf(link['url'])}/accept`, undefined, bob.cookie);
  });

  it('changes roles but keeps one admin', async () => {
    await ok('PATCH', `/api/v1/workspaces/${workspaceId}/members/${bob.userId}`, { role: 'ADMIN' });
    await ok('PATCH', `/api/v1/workspaces/${workspaceId}/members/${ann.userId}`, {
      role: 'MEMBER',
    });
    const last = await call(
      'PATCH',
      `/api/v1/workspaces/${workspaceId}/members/${bob.userId}`,
      { role: 'MEMBER' },
      bob.cookie,
    );
    expect(last.status).toBe(409);
    expect(last.body).toMatchObject({ error: { code: 'LAST_ADMIN' } });
  });

  it('lets members leave, and removes them from the workspace’s boards and cards', async () => {
    const listId = (await ok('POST', `/api/v1/boards/${boardId}/lists`, { name: 'To do' }))['id'];
    const card = await ok('POST', `/api/v1/lists/${listId}/cards`, { title: 'Ship' });
    await ok('PUT', `/api/v1/cards/${card['id']}/assignees/${bob.userId}`);

    await ok(
      'DELETE',
      `/api/v1/workspaces/${workspaceId}/members/${bob.userId}`,
      undefined,
      bob.cookie,
    );
    expect((await call('GET', `/api/v1/boards/${boardId}`, undefined, bob.cookie)).status).toBe(
      404,
    );
    const board = await ok('GET', `/api/v1/boards/${boardId}`);
    expect((board['cards'] as Json[])[0]!['assigneeIds']).toEqual([]);
  });

  it('does not let members remove others', async () => {
    const response = await call(
      'DELETE',
      `/api/v1/workspaces/${workspaceId}/members/${ann.userId}`,
      undefined,
      bob.cookie,
    );
    expect(response.status).toBe(403);
  });
});

describe('board members', () => {
  it('invites someone to one board only, and lists it as shared with them', async () => {
    await ok('PATCH', `/api/v1/boards/${boardId}`, { visibility: 'PRIVATE' });
    const link = await ok('POST', `/api/v1/boards/${boardId}/invitation-link`, {
      role: 'OBSERVER',
    });
    const accepted = await ok(
      'POST',
      `/api/v1/invitations/${tokenOf(link['url'])}/accept`,
      undefined,
      cat.cookie,
    );
    expect(accepted).toEqual({ workspaceId: null, boardId });

    const board = await ok('GET', `/api/v1/boards/${boardId}`, undefined, cat.cookie);
    expect(board['role']).toBe('OBSERVER');
    expect(
      (await call('GET', `/api/v1/workspaces/${workspaceId}`, undefined, cat.cookie)).status,
    ).toBe(404);
    const shared = await ok('GET', '/api/v1/me/shared-boards', undefined, cat.cookie);
    expect((shared['items'] as Json[]).map((item) => item['id'])).toEqual([boardId]);
    expect((await ok('GET', '/api/v1/me/shared-boards'))['items']).toEqual([]);
  });

  it('adds workspace members to a private board and removes them again', async () => {
    const link = await ok('POST', `/api/v1/workspaces/${workspaceId}/invitation-link`, {});
    await ok('POST', `/api/v1/invitations/${tokenOf(link['url'])}/accept`, undefined, bob.cookie);
    await ok('PATCH', `/api/v1/boards/${boardId}`, { visibility: 'PRIVATE' });
    expect((await call('GET', `/api/v1/boards/${boardId}`, undefined, bob.cookie)).status).toBe(
      404,
    );

    const added = await ok('PUT', `/api/v1/boards/${boardId}/members/${bob.userId}`, {
      role: 'MEMBER',
    });
    expect(
      (added['items'] as { user: Json; role: string }[]).map((m) => [m.user['name'], m.role]),
    ).toEqual([
      ['Ann', 'ADMIN'],
      ['Bob', 'MEMBER'],
    ]);
    expect((await call('GET', `/api/v1/boards/${boardId}`, undefined, bob.cookie)).status).toBe(
      200,
    );

    await ok('DELETE', `/api/v1/boards/${boardId}/members/${bob.userId}`);
    expect((await call('GET', `/api/v1/boards/${boardId}`, undefined, bob.cookie)).status).toBe(
      404,
    );
  });

  it('only adds people who already belong to the workspace', async () => {
    const response = await call('PUT', `/api/v1/boards/${boardId}/members/${cat.userId}`, {
      role: 'MEMBER',
    });
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: { code: 'MEMBER_NOT_FOUND' } });
  });

  it('keeps an admin on the board', async () => {
    await ok('PATCH', `/api/v1/boards/${boardId}`, { visibility: 'PRIVATE' });
    // Ann's personal organization makes her an admin of every board in it.
    const response = await call('DELETE', `/api/v1/boards/${boardId}/members/${ann.userId}`);
    expect(response.status).toBe(200);
    const board = await ok('GET', `/api/v1/boards/${boardId}`);
    expect(board['role']).toBe('ADMIN');
  });
});
