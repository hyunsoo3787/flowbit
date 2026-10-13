import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestContext,
  createWorkspace,
  request,
  resetDatabase,
  signUp,
  type TestContext,
} from './helpers.js';

let ctx: TestContext;
let ann: { cookie: string; userId: string };
let bob: { cookie: string; userId: string };
let workspaceId: string;

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
});

type Json = Record<string, unknown>;

async function call(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  body?: unknown,
  cookie = ann.cookie,
) {
  return request(ctx.app, method, url, { cookie, body });
}

async function createBoard(body: Json = { name: 'Roadmap' }, cookie = ann.cookie) {
  const response = await call('POST', `/api/v1/workspaces/${workspaceId}/boards`, body, cookie);
  expect(response.status).toBe(201);
  return response.body as { id: string };
}

async function createList(boardId: string, name: string, extra: Json = {}) {
  const response = await call('POST', `/api/v1/boards/${boardId}/lists`, { name, ...extra });
  expect(response.status).toBe(201);
  return response.body as { id: string; position: string };
}

async function createCard(listId: string, title: string, extra: Json = {}) {
  const response = await call('POST', `/api/v1/lists/${listId}/cards`, { title, ...extra });
  expect(response.status).toBe(201);
  return response.body as { id: string; position: string; listId: string; boardId: string };
}

async function detail(boardId: string) {
  const response = await call('GET', `/api/v1/boards/${boardId}`);
  expect(response.status).toBe(200);
  return response.body as {
    lists: { id: string; name: string }[];
    cards: { id: string; title: string; listId: string }[];
  };
}

const names = (items: { name: string }[]) => items.map((item) => item.name);
const titlesIn = (cards: { title: string; listId: string }[], listId: string) =>
  cards.filter((card) => card.listId === listId).map((card) => card.title);

async function addBobToWorkspace(role: 'ADMIN' | 'MEMBER' | 'VIEWER') {
  await ctx.prisma.workspaceMember.create({ data: { workspaceId, userId: bob.userId, role } });
}

describe('boards', () => {
  it('creates a board with defaults and makes the creator board admin', async () => {
    const board = await createBoard({ name: '  Launch  ' });
    expect(board).toMatchObject({
      name: 'Launch',
      workspaceId,
      visibility: 'WORKSPACE',
      background: 'blue',
      role: 'ADMIN',
      version: 1,
    });
    expect(await detail(board.id)).toMatchObject({ lists: [], cards: [] });

    const list = await call('GET', `/api/v1/workspaces/${workspaceId}/boards`);
    expect(list.body).toMatchObject({ items: [{ id: board.id, role: 'ADMIN' }] });
  });

  it('validates input', async () => {
    const response = await call('POST', `/api/v1/workspaces/${workspaceId}/boards`, {
      name: 'x',
      background: 'neon',
    });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
  });

  it('updates and deletes a board', async () => {
    const board = await createBoard();
    const updated = await call('PATCH', `/api/v1/boards/${board.id}`, {
      name: 'Renamed',
      background: 'green',
    });
    expect(updated.body).toMatchObject({ name: 'Renamed', background: 'green', version: 2 });

    expect((await call('DELETE', `/api/v1/boards/${board.id}`)).status).toBe(204);
    expect((await call('GET', `/api/v1/boards/${board.id}`)).status).toBe(404);
  });

  it('records activity in the same transaction as each change', async () => {
    const board = await createBoard();
    const list = await createList(board.id, 'Todo');
    await createCard(list.id, 'Write docs');
    const types = await ctx.prisma.activity.findMany({
      where: { boardId: board.id },
      orderBy: { createdAt: 'asc' },
      select: { type: true },
    });
    expect(types.map((activity) => activity.type)).toEqual([
      'board.created',
      'list.created',
      'card.created',
    ]);
  });
});

describe('board permissions', () => {
  it('hides boards entirely from people outside the workspace', async () => {
    const board = await createBoard();
    const list = await createList(board.id, 'Todo');
    const card = await createCard(list.id, 'Secret');

    const attempts: [string, 'GET' | 'POST' | 'PATCH' | 'DELETE', string, unknown?][] = [
      ['BOARD_NOT_FOUND', 'GET', `/api/v1/boards/${board.id}`],
      ['BOARD_NOT_FOUND', 'PATCH', `/api/v1/boards/${board.id}`, { name: 'x' }],
      ['BOARD_NOT_FOUND', 'POST', `/api/v1/boards/${board.id}/lists`, { name: 'x' }],
      ['LIST_NOT_FOUND', 'PATCH', `/api/v1/lists/${list.id}`, { name: 'x' }],
      ['LIST_NOT_FOUND', 'POST', `/api/v1/lists/${list.id}/cards`, { title: 'x' }],
      ['CARD_NOT_FOUND', 'GET', `/api/v1/cards/${card.id}`],
      ['CARD_NOT_FOUND', 'DELETE', `/api/v1/cards/${card.id}`],
      ['WORKSPACE_NOT_FOUND', 'GET', `/api/v1/workspaces/${workspaceId}/boards`],
    ];
    for (const [code, method, url, body] of attempts) {
      const response = await call(method, url, body, bob.cookie);
      expect(response.status, `${method} ${url}`).toBe(404);
      expect(response.body).toMatchObject({ error: { code } });
    }
  });

  it('lets workspace viewers read boards but not change them', async () => {
    const board = await createBoard();
    const list = await createList(board.id, 'Todo');
    await addBobToWorkspace('VIEWER');

    const fetched = await call('GET', `/api/v1/boards/${board.id}`, undefined, bob.cookie);
    expect(fetched.body).toMatchObject({ role: 'OBSERVER' });

    for (const [method, url, body] of [
      ['POST', `/api/v1/lists/${list.id}/cards`, { title: 'x' }],
      ['POST', `/api/v1/boards/${board.id}/lists`, { name: 'x' }],
      ['POST', `/api/v1/workspaces/${workspaceId}/boards`, { name: 'x' }],
    ] as const) {
      expect((await call(method, url, body, bob.cookie)).status, url).toBe(403);
    }
  });

  it('lets workspace members edit content but not manage the board', async () => {
    const board = await createBoard();
    const list = await createList(board.id, 'Todo');
    await addBobToWorkspace('MEMBER');

    const card = await call('POST', `/api/v1/lists/${list.id}/cards`, { title: 'Hi' }, bob.cookie);
    expect(card.status).toBe(201);
    const rename = await call('PATCH', `/api/v1/boards/${board.id}`, { name: 'x' }, bob.cookie);
    expect(rename.status).toBe(403);
  });

  it('shows private boards only to their members and organization admins', async () => {
    const board = await createBoard({ name: 'Private', visibility: 'PRIVATE' });
    await addBobToWorkspace('ADMIN');

    const hidden = await call(
      'GET',
      `/api/v1/workspaces/${workspaceId}/boards`,
      undefined,
      bob.cookie,
    );
    expect(hidden.body).toEqual({ items: [] });
    expect((await call('GET', `/api/v1/boards/${board.id}`, undefined, bob.cookie)).status).toBe(
      404,
    );

    const organizationId = (
      await ctx.prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })
    ).organizationId;
    await ctx.prisma.organizationMember.create({
      data: { organizationId, userId: bob.userId, role: 'ADMIN' },
    });
    const visible = await call('GET', `/api/v1/boards/${board.id}`, undefined, bob.cookie);
    expect(visible.body).toMatchObject({ role: 'ADMIN' });
  });
});

describe('lists', () => {
  it('appends by default, inserts at an index, and reorders', async () => {
    const board = await createBoard();
    await createList(board.id, 'A');
    await createList(board.id, 'C');
    await createList(board.id, 'B', { toIndex: 1 });
    expect(names((await detail(board.id)).lists)).toEqual(['A', 'B', 'C']);

    const lists = (await detail(board.id)).lists;
    const moved = await call('POST', `/api/v1/lists/${lists[2]!.id}/move`, { toIndex: 0 });
    expect(moved.status).toBe(200);
    expect(names((await detail(board.id)).lists)).toEqual(['C', 'A', 'B']);
  });

  it('renames and deletes a list, deleting its cards', async () => {
    const board = await createBoard();
    const list = await createList(board.id, 'Todo');
    await createCard(list.id, 'One');

    const renamed = await call('PATCH', `/api/v1/lists/${list.id}`, { name: 'Doing' });
    expect(renamed.body).toMatchObject({ name: 'Doing', version: 2 });

    expect((await call('DELETE', `/api/v1/lists/${list.id}`)).status).toBe(204);
    expect(await detail(board.id)).toMatchObject({ lists: [], cards: [] });
  });

  it('moves a list with its cards to another board', async () => {
    const from = await createBoard({ name: 'From' });
    const to = await createBoard({ name: 'To' });
    const list = await createList(from.id, 'Backlog');
    const card = await createCard(list.id, 'Task');

    const moved = await call('POST', `/api/v1/lists/${list.id}/move`, {
      toBoardId: to.id,
      toIndex: 0,
    });
    expect(moved.body).toMatchObject({ boardId: to.id });
    expect((await detail(from.id)).lists).toEqual([]);
    expect((await detail(to.id)).cards).toMatchObject([{ id: card.id, boardId: to.id }]);
  });

  it("refuses to move a list to a board the caller can't edit", async () => {
    const list = await createList((await createBoard()).id, 'Mine');
    const bobWorkspace = await createWorkspace(ctx.app, bob.cookie, 'Bob');
    const bobBoard = await call(
      'POST',
      `/api/v1/workspaces/${bobWorkspace.id}/boards`,
      { name: 'Bob board' },
      bob.cookie,
    );
    const response = await call('POST', `/api/v1/lists/${list.id}/move`, {
      toBoardId: (bobBoard.body as { id: string }).id,
      toIndex: 0,
    });
    expect(response.status).toBe(404);
  });
});

describe('cards', () => {
  it('creates, reorders and moves cards between lists', async () => {
    const board = await createBoard();
    const todo = await createList(board.id, 'Todo');
    const done = await createList(board.id, 'Done');
    const one = await createCard(todo.id, 'One');
    await createCard(todo.id, 'Two');
    await createCard(todo.id, 'Three');

    await call('POST', `/api/v1/cards/${one.id}/move`, { toListId: todo.id, toIndex: 2 });
    expect(titlesIn((await detail(board.id)).cards, todo.id)).toEqual(['Two', 'Three', 'One']);

    const moved = await call('POST', `/api/v1/cards/${one.id}/move`, {
      toListId: done.id,
      toIndex: 0,
    });
    expect(moved.body).toMatchObject({ listId: done.id, version: 3 });
    const cards = (await detail(board.id)).cards;
    expect(titlesIn(cards, todo.id)).toEqual(['Two', 'Three']);
    expect(titlesIn(cards, done.id)).toEqual(['One']);
  });

  it('edits the title and Markdown description', async () => {
    const board = await createBoard();
    const card = await createCard((await createList(board.id, 'Todo')).id, 'Draft');
    const updated = await call('PATCH', `/api/v1/cards/${card.id}`, {
      title: 'Final',
      description: '## Notes\n- one',
    });
    expect(updated.body).toMatchObject({
      title: 'Final',
      description: '## Notes\n- one',
      version: 2,
    });
    expect((await call('GET', `/api/v1/cards/${card.id}`)).body).toMatchObject({ title: 'Final' });
  });

  it('moves a card to a list on another board', async () => {
    const card = await createCard((await createList((await createBoard()).id, 'A')).id, 'Travel');
    const other = await createBoard({ name: 'Other' });
    const target = await createList(other.id, 'B');

    const moved = await call('POST', `/api/v1/cards/${card.id}/move`, {
      toListId: target.id,
      toIndex: 0,
    });
    expect(moved.body).toMatchObject({ boardId: other.id, listId: target.id });
  });

  it('deletes a card', async () => {
    const board = await createBoard();
    const card = await createCard((await createList(board.id, 'Todo')).id, 'Gone');
    expect((await call('DELETE', `/api/v1/cards/${card.id}`)).status).toBe(204);
    expect((await call('GET', `/api/v1/cards/${card.id}`)).status).toBe(404);
  });
});

describe('ordering', () => {
  it('sorts positions in byte order in the database', async () => {
    const board = await createBoard();
    const first = await createList(board.id, 'lowercase');
    const second = await createList(board.id, 'uppercase');
    // A locale-aware collation would put "a0" before "Zz".
    await ctx.prisma.list.update({ where: { id: first.id }, data: { position: 'a0' } });
    await ctx.prisma.list.update({ where: { id: second.id }, data: { position: 'Zz' } });
    expect(names((await detail(board.id)).lists)).toEqual(['uppercase', 'lowercase']);
  });

  it('rebalances when concurrent inserts left two cards on the same position', async () => {
    const board = await createBoard();
    const list = await createList(board.id, 'Todo');
    const a = await createCard(list.id, 'A');
    const b = await createCard(list.id, 'B');
    await ctx.prisma.card.update({ where: { id: b.id }, data: { position: a.position } });

    await createCard(list.id, 'Between', { toIndex: 1 });
    const cards = await ctx.prisma.card.findMany({
      where: { listId: list.id },
      orderBy: { position: 'asc' },
    });
    expect(new Set(cards.map((card) => card.position)).size).toBe(3);
    expect(cards.map((card) => card.title)).toEqual(['A', 'Between', 'B']);
  });

  it('gives concurrent inserts distinct positions', async () => {
    const board = await createBoard();
    const list = await createList(board.id, 'Todo');
    await Promise.all(Array.from({ length: 8 }, (_, i) => createCard(list.id, `Card ${i}`)));
    const cards = await ctx.prisma.card.findMany({ where: { listId: list.id } });
    expect(new Set(cards.map((card) => card.position)).size).toBe(8);
  });
});
