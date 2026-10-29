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
let workspaceId: string;
let boardId: string;
let listId: string;
let cardId: string;

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
  workspaceId = (await createWorkspace(ctx.app, ann.cookie)).id;
  boardId = (await ok('POST', `/api/v1/workspaces/${workspaceId}/boards`, { name: 'Roadmap' }))
    .id as string;
  listId = (await ok('POST', `/api/v1/boards/${boardId}/lists`, { name: 'To do' })).id as string;
  cardId = (await ok('POST', `/api/v1/lists/${listId}/cards`, { title: 'Ship it' })).id as string;
});

async function call(method: Method, url: string, body?: unknown, cookie = ann.cookie) {
  return request(ctx.app, method, url, { cookie, body });
}

/** Calls the API and expects a 2xx response. */
async function ok(method: Method, url: string, body?: unknown, cookie = ann.cookie) {
  const response = await call(method, url, body, cookie);
  if (response.status >= 300) {
    throw new Error(`${method} ${url} → ${response.status} ${JSON.stringify(response.body)}`);
  }
  return (response.body ?? {}) as Json;
}

async function card() {
  const board = await ok('GET', `/api/v1/boards/${boardId}`);
  return (board['cards'] as Json[]).find((item) => item['id'] === cardId)!;
}

/** Bob joins the workspace as a member directly, as if invited. */
async function addBob(role = 'MEMBER') {
  await ctx.prisma.workspaceMember.create({
    data: { workspaceId, userId: bob.userId, role: role as 'MEMBER' },
  });
}

describe('labels', () => {
  it('gives a new board six default labels', async () => {
    const board = await ok('GET', `/api/v1/boards/${boardId}`);
    expect((board['labels'] as Json[]).map((label) => label['color'])).toEqual([
      'green',
      'yellow',
      'orange',
      'red',
      'purple',
      'blue',
    ]);
  });

  it('creates, renames, applies and deletes labels', async () => {
    const label = await ok('POST', `/api/v1/boards/${boardId}/labels`, {
      name: 'Bug',
      color: 'red',
    });
    expect(label).toMatchObject({ name: 'Bug', color: 'red', boardId });

    const renamed = await ok('PATCH', `/api/v1/labels/${label['id']}`, { name: 'Defect' });
    expect(renamed).toMatchObject({ name: 'Defect', version: 2 });

    const labeled = await ok('PUT', `/api/v1/cards/${cardId}/labels/${label['id']}`);
    expect(labeled['labelIds']).toEqual([label['id']]);
    // Applying again changes nothing.
    const again = await ok('PUT', `/api/v1/cards/${cardId}/labels/${label['id']}`);
    expect(again['version']).toBe(labeled['version']);

    await ok('DELETE', `/api/v1/labels/${label['id']}`);
    expect((await card())['labelIds']).toEqual([]);
  });

  it('rejects labels from another board and invalid colors', async () => {
    const other = await ok('POST', `/api/v1/workspaces/${workspaceId}/boards`, { name: 'Other' });
    const label = await ok('POST', `/api/v1/boards/${other['id']}/labels`, { color: 'blue' });
    const response = await call('PUT', `/api/v1/cards/${cardId}/labels/${label['id']}`);
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: { code: 'LABEL_NOT_FOUND' } });

    const invalid = await call('POST', `/api/v1/boards/${boardId}/labels`, { color: 'teal' });
    expect(invalid.status).toBe(400);
  });

  it('takes a board’s labels off a card that moves to another board', async () => {
    const label = await ok('POST', `/api/v1/boards/${boardId}/labels`, { color: 'red' });
    await ok('PUT', `/api/v1/cards/${cardId}/labels/${label['id']}`);
    const other = await ok('POST', `/api/v1/workspaces/${workspaceId}/boards`, { name: 'Other' });
    const otherList = await ok('POST', `/api/v1/boards/${other['id']}/lists`, { name: 'Inbox' });
    const moved = await ok('POST', `/api/v1/cards/${cardId}/move`, {
      toListId: otherList['id'],
      toIndex: 0,
    });
    expect(moved['labelIds']).toEqual([]);
  });

  it('does not let observers manage labels', async () => {
    await addBob('VIEWER');
    const response = await call(
      'POST',
      `/api/v1/boards/${boardId}/labels`,
      { color: 'red' },
      bob.cookie,
    );
    expect(response.status).toBe(403);
  });
});

describe('assignees, dates and covers', () => {
  it('assigns and unassigns people with access to the board', async () => {
    await addBob();
    const assigned = await ok('PUT', `/api/v1/cards/${cardId}/assignees/${bob.userId}`);
    expect(assigned['assigneeIds']).toEqual([bob.userId]);
    const unassigned = await ok('DELETE', `/api/v1/cards/${cardId}/assignees/${bob.userId}`);
    expect(unassigned['assigneeIds']).toEqual([]);
  });

  it('refuses to assign someone without access', async () => {
    const response = await call('PUT', `/api/v1/cards/${cardId}/assignees/${bob.userId}`);
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: { code: 'MEMBER_NOT_FOUND' } });
  });

  it('sets dates, completes the due date and sets a cover', async () => {
    const dueAt = '2026-11-01T09:00:00.000Z';
    const updated = await ok('PATCH', `/api/v1/cards/${cardId}`, {
      startAt: '2026-10-20T09:00:00.000Z',
      dueAt,
      coverColor: 'green',
    });
    expect(updated).toMatchObject({ dueAt, coverColor: 'green', dueCompletedAt: null });

    const done = await ok('PATCH', `/api/v1/cards/${cardId}`, { dueComplete: true });
    expect(done['dueCompletedAt']).toEqual(expect.any(String));
    const reopened = await ok('PATCH', `/api/v1/cards/${cardId}`, { dueComplete: false });
    expect(reopened['dueCompletedAt']).toBeNull();

    const cleared = await ok('PATCH', `/api/v1/cards/${cardId}`, { dueAt: null, coverColor: null });
    expect(cleared).toMatchObject({ dueAt: null, coverColor: null });
  });

  it('lists everyone with access as board members', async () => {
    await addBob('VIEWER');
    const board = await ok('GET', `/api/v1/boards/${boardId}`);
    const members = board['members'] as { user: Json; role: string; boardRole: string | null }[];
    expect(members.map((member) => [member.user['name'], member.role, member.boardRole])).toEqual([
      ['Ann', 'ADMIN', 'ADMIN'],
      ['Bob', 'OBSERVER', null],
    ]);
  });
});

describe('checklists', () => {
  it('builds a checklist and keeps the card’s badge counts', async () => {
    const checklist = await ok('POST', `/api/v1/cards/${cardId}/checklists`, { title: 'Launch' });
    const first = await ok('POST', `/api/v1/checklists/${checklist['id']}/items`, { text: 'Docs' });
    const second = await ok('POST', `/api/v1/checklists/${checklist['id']}/items`, {
      text: 'Tests',
    });
    await ok('PATCH', `/api/v1/checklist-items/${first['id']}`, { completed: true });
    expect((await card())['badges']).toEqual({
      comments: 0,
      checklistItems: 2,
      checklistItemsDone: 1,
    });

    await ok('POST', `/api/v1/checklist-items/${second['id']}/move`, { toIndex: 0 });
    const lists = await ok('GET', `/api/v1/cards/${cardId}/checklists`);
    const items = (lists['items'] as { items: Json[] }[])[0]!.items;
    expect(items.map((item) => item['text'])).toEqual(['Tests', 'Docs']);
    expect(items[1]!['completedAt']).toEqual(expect.any(String));

    await ok('DELETE', `/api/v1/checklist-items/${first['id']}`);
    expect((await card())['badges']).toMatchObject({ checklistItems: 1, checklistItemsDone: 0 });
    await ok('DELETE', `/api/v1/checklists/${checklist['id']}`);
    expect((await card())['badges']).toMatchObject({ checklistItems: 0 });
  });

  it('assigns an item and gives it a due date', async () => {
    await addBob();
    const checklist = await ok('POST', `/api/v1/cards/${cardId}/checklists`, { title: 'Launch' });
    const item = await ok('POST', `/api/v1/checklists/${checklist['id']}/items`, { text: 'Docs' });
    const updated = await ok('PATCH', `/api/v1/checklist-items/${item['id']}`, {
      assigneeId: bob.userId,
      dueAt: '2026-11-01T00:00:00.000Z',
    });
    expect(updated).toMatchObject({ assigneeId: bob.userId, dueAt: '2026-11-01T00:00:00.000Z' });
  });

  it('hides checklists of boards the caller cannot see', async () => {
    const checklist = await ok('POST', `/api/v1/cards/${cardId}/checklists`, { title: 'Launch' });
    const response = await call('GET', `/api/v1/cards/${cardId}/checklists`, undefined, bob.cookie);
    expect(response.status).toBe(404);
    const rename = await call(
      'PATCH',
      `/api/v1/checklists/${checklist['id']}`,
      { title: 'x' },
      bob.cookie,
    );
    expect(rename.status).toBe(404);
    expect(rename.body).toMatchObject({ error: { code: 'CHECKLIST_NOT_FOUND' } });
  });
});

describe('comments', () => {
  it('adds, edits, pages through and deletes comments', async () => {
    await addBob();
    const comment = await ok('POST', `/api/v1/cards/${cardId}/comments`, {
      body: `Thanks <@${bob.userId}>!`,
    });
    expect(comment).toMatchObject({ author: { name: 'Ann' }, editedAt: null });
    expect((await card())['badges']).toMatchObject({ comments: 1 });

    const edited = await ok('PATCH', `/api/v1/comments/${comment['id']}`, { body: 'Thanks!' });
    expect(edited['editedAt']).toEqual(expect.any(String));

    // Only the author edits.
    const byBob = await call(
      'PATCH',
      `/api/v1/comments/${comment['id']}`,
      { body: 'x' },
      bob.cookie,
    );
    expect(byBob.status).toBe(403);
    // Bob, a member, can't delete Ann's comment either; Ann can.
    expect(
      (await call('DELETE', `/api/v1/comments/${comment['id']}`, undefined, bob.cookie)).status,
    ).toBe(403);

    for (let i = 0; i < 55; i++) {
      await ok('POST', `/api/v1/cards/${cardId}/comments`, { body: `#${i}` });
    }
    const first = await ok('GET', `/api/v1/cards/${cardId}/comments`);
    expect((first['items'] as Json[])[0]!['body']).toBe('#54');
    expect(first['items']).toHaveLength(50);
    const second = await ok(
      'GET',
      `/api/v1/cards/${cardId}/comments?before=${first['nextCursor']}`,
    );
    expect(second['items']).toHaveLength(6);
    expect(second['nextCursor']).toBeNull();

    await ok('DELETE', `/api/v1/comments/${comment['id']}`);
    expect((await card())['badges']).toMatchObject({ comments: 55 });
  });

  it('lets observers read but not write comments', async () => {
    await ok('POST', `/api/v1/cards/${cardId}/comments`, { body: 'Hi' });
    await addBob('VIEWER');
    const list = await call('GET', `/api/v1/cards/${cardId}/comments`, undefined, bob.cookie);
    expect(list.status).toBe(200);
    const post = await call('POST', `/api/v1/cards/${cardId}/comments`, { body: 'Hi' }, bob.cookie);
    expect(post.status).toBe(403);
  });
});
