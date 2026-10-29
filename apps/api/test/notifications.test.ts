import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DomainEvents } from '../src/events/domain-events.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
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
let todoId: string;
let doneId: string;
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
  cat = await signUp(ctx.app, { name: 'Cat', email: 'cat@example.com' });
  workspaceId = (await createWorkspace(ctx.app, ann.cookie)).id;
  for (const user of [bob, cat]) {
    await ctx.prisma.workspaceMember.create({
      data: { workspaceId, userId: user.userId, role: 'MEMBER' },
    });
  }
  boardId = (await ok('POST', `/api/v1/workspaces/${workspaceId}/boards`, { name: 'Roadmap' }))[
    'id'
  ] as string;
  todoId = (await ok('POST', `/api/v1/boards/${boardId}/lists`, { name: 'To do' }))['id'] as string;
  doneId = (await ok('POST', `/api/v1/boards/${boardId}/lists`, { name: 'Done' }))['id'] as string;
  cardId = (await ok('POST', `/api/v1/lists/${todoId}/cards`, { title: 'Ship it' }))[
    'id'
  ] as string;
  await settled();
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

/** Notifications are created after the request, from domain events. */
const settled = () => ctx.app.get(DomainEvents).settled();

async function inbox(cookie: string) {
  await settled();
  return (await ok('GET', '/api/v1/me/notifications', undefined, cookie)) as {
    items: Json[];
    unreadCount: number;
  };
}

describe('notifications', () => {
  it('notifies a mentioned person, and emails them', async () => {
    await ok('POST', `/api/v1/cards/${cardId}/comments`, { body: `Over to you <@${bob.userId}>` });
    const { items, unreadCount } = await inbox(bob.cookie);
    expect(unreadCount).toBe(1);
    expect(items[0]).toMatchObject({
      type: 'MENTIONED',
      actor: { name: 'Ann' },
      board: { name: 'Roadmap' },
      card: { title: 'Ship it' },
      payload: { excerpt: 'Over to you @Bob' },
      readAt: null,
    });
    expect(ctx.mail.outbox.at(-1)).toMatchObject({
      to: 'bob@example.com',
      subject: 'Ann mentioned you on “Ship it”',
    });
    // Nobody is notified about their own comment.
    expect((await inbox(ann.cookie)).items).toEqual([]);
  });

  it('tells assignees and watchers about comments, once each', async () => {
    await ok('PUT', `/api/v1/cards/${cardId}/assignees/${bob.userId}`);
    await ok('PUT', `/api/v1/cards/${cardId}/watch`, undefined, cat.cookie);
    await ok('POST', `/api/v1/cards/${cardId}/comments`, { body: `Done, <@${bob.userId}>?` });
    expect((await inbox(bob.cookie)).items.map((item) => item['type'])).toEqual([
      'MENTIONED',
      'ASSIGNED',
    ]);
    expect((await inbox(cat.cookie)).items.map((item) => item['type'])).toEqual(['COMMENTED']);
  });

  it('notifies about assignments and moves, but not about your own actions', async () => {
    await ok('PUT', `/api/v1/cards/${cardId}/assignees/${ann.userId}`);
    await ok('PUT', `/api/v1/cards/${cardId}/assignees/${bob.userId}`);
    await ok('POST', `/api/v1/cards/${cardId}/move`, { toListId: doneId, toIndex: 0 });
    const bobs = (await inbox(bob.cookie)).items;
    expect(bobs.map((item) => item['type'])).toEqual(['CARD_MOVED', 'ASSIGNED']);
    expect(bobs[0]!['payload']).toEqual({ fromList: 'To do', toList: 'Done' });
    expect((await inbox(ann.cookie)).items).toEqual([]);
  });

  it('tells board watchers about new cards', async () => {
    await ok('PUT', `/api/v1/boards/${boardId}/watch`, undefined, cat.cookie);
    await ok('POST', `/api/v1/lists/${todoId}/cards`, { title: 'New one' });
    const { items } = await inbox(cat.cookie);
    expect(items[0]).toMatchObject({ type: 'CARD_CREATED', payload: { list: 'To do' } });
    const board = await ok('GET', `/api/v1/boards/${boardId}`, undefined, cat.cookie);
    expect(board).toMatchObject({ watching: true, watchedCardIds: [] });
  });

  it('respects email preferences but always notifies in the app', async () => {
    const prefs = await ok(
      'PATCH',
      '/api/v1/me/notification-preferences',
      { emailMentions: false },
      bob.cookie,
    );
    expect(prefs).toEqual({
      emailMentions: false,
      emailAssignments: true,
      emailWatching: true,
      emailDueSoon: true,
    });
    await ok('POST', `/api/v1/cards/${cardId}/comments`, { body: `<@${bob.userId}>` });
    expect((await inbox(bob.cookie)).unreadCount).toBe(1);
    expect(ctx.mail.outbox).toEqual([]);
  });

  it('marks notifications read, one or all, only for their owner', async () => {
    await ok('PUT', `/api/v1/cards/${cardId}/assignees/${bob.userId}`);
    await ok('POST', `/api/v1/cards/${cardId}/comments`, { body: `<@${bob.userId}>` });
    const { items } = await inbox(bob.cookie);
    const first = items[0]!['id'];
    expect((await call('POST', `/api/v1/me/notifications/${first}/read`)).status).toBe(404);
    const read = await ok('POST', `/api/v1/me/notifications/${first}/read`, undefined, bob.cookie);
    expect(read['readAt']).toEqual(expect.any(String));
    expect((await inbox(bob.cookie)).unreadCount).toBe(1);
    const unread = await ok('GET', '/api/v1/me/notifications?unread=true', undefined, bob.cookie);
    expect((unread['items'] as Json[]).map((item) => item['type'])).toEqual(['ASSIGNED']);
    await ok('POST', '/api/v1/me/notifications/read', undefined, bob.cookie);
    expect((await inbox(bob.cookie)).unreadCount).toBe(0);
  });

  it('reminds assignees once per due date', async () => {
    await ok('PUT', `/api/v1/cards/${cardId}/assignees/${bob.userId}`);
    const dueAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    await ok('PATCH', `/api/v1/cards/${cardId}`, { dueAt });
    const service = ctx.app.get(NotificationsService);
    await service.remindDueSoon();
    await service.remindDueSoon();
    const dueSoon = (await inbox(bob.cookie)).items.filter((item) => item['type'] === 'DUE_SOON');
    expect(dueSoon).toHaveLength(1);
    expect(dueSoon[0]!['payload']).toEqual({ dueAt });

    // A new due date gets a new reminder; a completed one doesn't.
    await ok('PATCH', `/api/v1/cards/${cardId}`, {
      dueAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    });
    await service.remindDueSoon();
    await ok('PATCH', `/api/v1/cards/${cardId}`, {
      dueAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      dueComplete: true,
    });
    await service.remindDueSoon();
    expect(
      (await inbox(bob.cookie)).items.filter((item) => item['type'] === 'DUE_SOON'),
    ).toHaveLength(2);
  });

  it('does not notify people who lost access', async () => {
    await ok('PUT', `/api/v1/cards/${cardId}/watch`, undefined, cat.cookie);
    await ok('PATCH', `/api/v1/boards/${boardId}`, { visibility: 'PRIVATE' });
    await ok('POST', `/api/v1/cards/${cardId}/comments`, { body: 'Secret' });
    expect((await inbox(cat.cookie)).items).toEqual([]);
  });
});

describe('watching and activity', () => {
  it('watches and unwatches cards', async () => {
    expect(await ok('PUT', `/api/v1/cards/${cardId}/watch`, undefined, bob.cookie)).toEqual({
      watching: true,
    });
    expect(
      (await ok('GET', `/api/v1/boards/${boardId}`, undefined, bob.cookie))['watchedCardIds'],
    ).toEqual([cardId]);
    expect(await ok('DELETE', `/api/v1/cards/${cardId}/watch`, undefined, bob.cookie)).toEqual({
      watching: false,
    });
  });

  it('lists what happened on a board and on a card, newest first', async () => {
    await ok('PUT', `/api/v1/cards/${cardId}/assignees/${bob.userId}`);
    await ok('POST', `/api/v1/cards/${cardId}/move`, { toListId: doneId, toIndex: 0 });
    const board = await ok('GET', `/api/v1/boards/${boardId}/activity`);
    expect((board['items'] as Json[]).map((item) => item['type'])).toEqual([
      'card.moved',
      'card.assigned',
      'card.created',
      'list.created',
      'list.created',
      'board.created',
    ]);
    const card = await ok('GET', `/api/v1/cards/${cardId}/activity`);
    expect((card['items'] as Json[])[0]).toMatchObject({
      type: 'card.moved',
      actor: { name: 'Ann' },
      card: { id: cardId, title: 'Ship it' },
      payload: { fromListId: todoId, toListId: doneId },
    });
  });

  it('hides activity and watching from people without access', async () => {
    await ok('PATCH', `/api/v1/boards/${boardId}`, { visibility: 'PRIVATE' });
    expect(
      (await call('GET', `/api/v1/boards/${boardId}/activity`, undefined, cat.cookie)).status,
    ).toBe(404);
    expect((await call('PUT', `/api/v1/cards/${cardId}/watch`, undefined, cat.cookie)).status).toBe(
      404,
    );
  });
});
