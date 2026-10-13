import type { AddressInfo } from 'node:net';
import {
  type BoardEvent,
  CLIENT_MUTATION_ID_HEADER,
  type ClientToServerEvents,
  REALTIME_PATH,
  type ServerToClientEvents,
} from '@flowbit/shared';
import { io, type Socket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestContext,
  createWorkspace,
  ORIGIN,
  request,
  resetDatabase,
  signUp,
  type TestContext,
} from './helpers.js';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let ctx: TestContext;
let url: string;
const sockets: ClientSocket[] = [];

beforeAll(async () => {
  ctx = await createTestContext();
  await ctx.app.listen({ port: 0, host: '127.0.0.1' });
  const { port } = ctx.app.getHttpServer().address() as AddressInfo;
  url = `http://127.0.0.1:${port}`;
});
afterAll(async () => {
  await ctx.app.close();
});
beforeEach(async () => {
  await resetDatabase(ctx.prisma);
});
afterEach(() => {
  for (const socket of sockets.splice(0)) socket.disconnect();
});

function connect(cookie: string | null, origin: string = ORIGIN) {
  const socket: ClientSocket = io(url, {
    path: REALTIME_PATH,
    transports: ['websocket'],
    reconnection: false,
    extraHeaders: { origin, ...(cookie ? { cookie } : {}) },
  });
  sockets.push(socket);
  return socket;
}

function connected(socket: ClientSocket) {
  return new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
}

function join(socket: ClientSocket, boardId: string) {
  return new Promise<{ ok: boolean }>((resolve) => socket.emit('board:join', boardId, resolve));
}

/** Collects board events on a socket. */
function collect(socket: ClientSocket) {
  const events: BoardEvent[] = [];
  socket.on('board:event', (event) => events.push(event));
  return events;
}

async function waitFor(check: () => boolean, timeout = 3000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error('Timed out waiting for condition');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function setUpBoard() {
  const ann = await signUp(ctx.app, { name: 'Ann', email: 'ann@example.com' });
  const workspace = await createWorkspace(ctx.app, ann.cookie);
  const board = await request(ctx.app, 'POST', `/api/v1/workspaces/${workspace.id}/boards`, {
    cookie: ann.cookie,
    body: { name: 'Live' },
  });
  const boardId = (board.body as { id: string }).id;
  const list = await request(ctx.app, 'POST', `/api/v1/boards/${boardId}/lists`, {
    cookie: ann.cookie,
    body: { name: 'Todo' },
  });
  return { ann, workspaceId: workspace.id, boardId, listId: (list.body as { id: string }).id };
}

describe('real-time board events', () => {
  it('broadcasts labels, card content and member changes', async () => {
    const { ann, workspaceId, boardId, listId } = await setUpBoard();
    const card = await request(ctx.app, 'POST', `/api/v1/lists/${listId}/cards`, {
      cookie: ann.cookie,
      body: { title: 'Hello' },
    });
    const cardId = (card.body as { id: string }).id;
    const viewer = connect(ann.cookie);
    await connected(viewer);
    await join(viewer, boardId);
    const events = collect(viewer);

    const label = await request(ctx.app, 'POST', `/api/v1/boards/${boardId}/labels`, {
      cookie: ann.cookie,
      body: { name: 'Bug', color: 'red' },
    });
    await waitFor(() => events.some((event) => event.type === 'label.upserted'));
    expect(events.at(-1)).toMatchObject({ type: 'label.upserted', label: { name: 'Bug' } });

    await request(ctx.app, 'POST', `/api/v1/cards/${cardId}/comments`, {
      cookie: ann.cookie,
      body: { body: 'Hi' },
      headers: { [CLIENT_MUTATION_ID_HEADER]: 'comment-1' },
    });
    await waitFor(() => events.some((event) => event.type === 'card.content'));
    await waitFor(() =>
      events.some((event) => event.type === 'card.upserted' && event.card.badges.comments === 1),
    );
    expect(events.find((event) => event.type === 'card.content')).toMatchObject({
      cardId,
      part: 'comments',
      clientMutationId: 'comment-1',
    });
    // The new count isn't applied optimistically, so it isn't marked as the caller's echo.
    expect(
      events.find((event) => event.type === 'card.upserted' && event.card.badges.comments === 1),
    ).toMatchObject({ clientMutationId: null });

    const bob = await signUp(ctx.app, { name: 'Bob', email: 'bob@example.com' });
    const link = await request(
      ctx.app,
      'POST',
      `/api/v1/workspaces/${workspaceId}/invitation-link`,
      {
        cookie: ann.cookie,
        body: {},
      },
    );
    const token = String((link.body as { url: string }).url).split('/invite/')[1];
    await request(ctx.app, 'POST', `/api/v1/invitations/${token}/accept`, { cookie: bob.cookie });
    await waitFor(() => events.some((event) => event.type === 'members.updated'));
    const members = events.find((event) => event.type === 'members.updated');
    expect(members?.type === 'members.updated' && members.members.map((m) => m.user.name)).toEqual([
      'Ann',
      'Bob',
    ]);

    await request(ctx.app, 'DELETE', `/api/v1/labels/${(label.body as { id: string }).id}`, {
      cookie: ann.cookie,
    });
    await waitFor(() => events.some((event) => event.type === 'label.deleted'));
  });

  it('broadcasts changes to every viewer, echoing the client mutation id', async () => {
    const { ann, boardId, listId } = await setUpBoard();
    const viewer = connect(ann.cookie);
    await connected(viewer);
    expect(await join(viewer, boardId)).toEqual({ ok: true });
    const events = collect(viewer);

    const created = await request(ctx.app, 'POST', `/api/v1/lists/${listId}/cards`, {
      cookie: ann.cookie,
      body: { title: 'Hello' },
      headers: { [CLIENT_MUTATION_ID_HEADER]: 'mutation-1' },
    });
    const cardId = (created.body as { id: string }).id;
    await waitFor(() => events.length === 1);
    expect(events[0]).toMatchObject({
      type: 'card.upserted',
      boardId,
      clientMutationId: 'mutation-1',
      actorId: ann.userId,
      card: { id: cardId, title: 'Hello', listId },
    });

    await request(ctx.app, 'DELETE', `/api/v1/cards/${cardId}`, { cookie: ann.cookie });
    await waitFor(() => events.length === 2);
    expect(events[1]).toMatchObject({ type: 'card.deleted', cardId, clientMutationId: null });
  });

  it('only lets people who can see the board join its room', async () => {
    const { boardId } = await setUpBoard();
    const bob = await signUp(ctx.app, { name: 'Bob', email: 'bob@example.com' });
    const outsider = connect(bob.cookie);
    await connected(outsider);
    expect(await join(outsider, boardId)).toEqual({ ok: false });
    expect(await join(outsider, 'not-a-uuid')).toEqual({ ok: false });
  });

  it('rejects connections without a session or from an untrusted origin', async () => {
    const { ann } = await setUpBoard();
    await expect(connected(connect(null))).rejects.toThrow('UNAUTHENTICATED');
    await expect(connected(connect(ann.cookie, 'https://evil.example'))).rejects.toThrow(
      'FORBIDDEN',
    );
  });

  it('stops sending events to people who lose access when a board becomes private', async () => {
    const { ann, workspaceId, boardId, listId } = await setUpBoard();
    const bob = await signUp(ctx.app, { name: 'Bob', email: 'bob@example.com' });
    await ctx.prisma.workspaceMember.create({
      data: { workspaceId, userId: bob.userId, role: 'MEMBER' },
    });

    const bobSocket = connect(bob.cookie);
    await connected(bobSocket);
    expect(await join(bobSocket, boardId)).toEqual({ ok: true });
    const bobEvents = collect(bobSocket);

    await request(ctx.app, 'PATCH', `/api/v1/boards/${boardId}`, {
      cookie: ann.cookie,
      body: { visibility: 'PRIVATE' },
    });
    await waitFor(() => bobEvents.some((event) => event.type === 'board.updated'));

    await request(ctx.app, 'POST', `/api/v1/lists/${listId}/cards`, {
      cookie: ann.cookie,
      body: { title: 'Private now' },
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(bobEvents.map((event) => event.type)).toEqual(['board.updated']);
  });

  it('announces a card that moves to another board on both boards', async () => {
    const { ann, workspaceId, boardId, listId } = await setUpBoard();
    const other = await request(ctx.app, 'POST', `/api/v1/workspaces/${workspaceId}/boards`, {
      cookie: ann.cookie,
      body: { name: 'Other' },
    });
    const otherId = (other.body as { id: string }).id;
    const otherList = await request(ctx.app, 'POST', `/api/v1/boards/${otherId}/lists`, {
      cookie: ann.cookie,
      body: { name: 'Inbox' },
    });
    const card = await request(ctx.app, 'POST', `/api/v1/lists/${listId}/cards`, {
      cookie: ann.cookie,
      body: { title: 'Traveller' },
    });

    const source = connect(ann.cookie);
    const target = connect(ann.cookie);
    await Promise.all([connected(source), connected(target)]);
    await join(source, boardId);
    await join(target, otherId);
    const sourceEvents = collect(source);
    const targetEvents = collect(target);

    await request(ctx.app, 'POST', `/api/v1/cards/${(card.body as { id: string }).id}/move`, {
      cookie: ann.cookie,
      body: { toListId: (otherList.body as { id: string }).id, toIndex: 0 },
    });
    await waitFor(() => sourceEvents.length === 1 && targetEvents.length === 1);
    expect(sourceEvents[0]).toMatchObject({ type: 'card.deleted', boardId });
    expect(targetEvents[0]).toMatchObject({ type: 'card.upserted', boardId: otherId });
  });
});

describe.skipIf(!process.env['TEST_VALKEY_URL'])(
  'across API replicas (needs TEST_VALKEY_URL)',
  () => {
    it('delivers an event published by one replica to a client of another', async () => {
      const { ann, boardId, listId } = await setUpBoard();
      const replica = await createTestContext();
      await replica.app.listen({ port: 0, host: '127.0.0.1' });
      try {
        const { port } = replica.app.getHttpServer().address() as AddressInfo;
        const socket: ClientSocket = io(`http://127.0.0.1:${port}`, {
          path: REALTIME_PATH,
          transports: ['websocket'],
          reconnection: false,
          extraHeaders: { origin: ORIGIN, cookie: ann.cookie },
        });
        sockets.push(socket);
        await connected(socket);
        expect(await join(socket, boardId)).toEqual({ ok: true });
        const events = collect(socket);

        // The change goes through the first replica; the client is on the second.
        await request(ctx.app, 'POST', `/api/v1/lists/${listId}/cards`, {
          cookie: ann.cookie,
          body: { title: 'Fan-out' },
        });
        await waitFor(() => events.length === 1);
        expect(events[0]).toMatchObject({ type: 'card.upserted', card: { title: 'Fan-out' } });
      } finally {
        await replica.app.close();
      }
    });
  },
);
