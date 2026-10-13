import type { BoardDetail, Card, List } from '@flowbit/shared';
import { describe, expect, it } from 'vitest';
import {
  applyEvent,
  cardsInList,
  positionAtIndex,
  removeList,
  upsertCard,
  upsertList,
} from './board-cache';

const now = '2026-10-13T00:00:00.000Z';
const board: BoardDetail = {
  id: 'b1',
  workspaceId: 'w1',
  name: 'Board',
  visibility: 'WORKSPACE',
  background: 'blue',
  role: 'ADMIN',
  version: 1,
  createdAt: now,
  updatedAt: now,
  lists: [],
  cards: [],
};

const list = (id: string, position: string, extra: Partial<List> = {}): List => ({
  id,
  boardId: 'b1',
  name: id,
  position,
  version: 1,
  createdAt: now,
  updatedAt: now,
  ...extra,
});

const card = (id: string, listId: string, position: string, extra: Partial<Card> = {}): Card => ({
  id,
  boardId: 'b1',
  listId,
  title: id,
  description: '',
  position,
  version: 1,
  createdAt: now,
  updatedAt: now,
  ...extra,
});

describe('board cache', () => {
  it('keeps lists and cards sorted by position', () => {
    let state = upsertList(board, list('l2', 'a1'));
    state = upsertList(state, list('l1', 'a0'));
    state = upsertCard(state, card('c2', 'l1', 'a1'));
    state = upsertCard(state, card('c1', 'l1', 'a0'));
    expect(state.lists.map((l) => l.id)).toEqual(['l1', 'l2']);
    expect(cardsInList(state, 'l1').map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('ignores updates older than the cached version', () => {
    let state = upsertCard(board, card('c1', 'l1', 'a0', { title: 'new', version: 3 }));
    state = upsertCard(state, card('c1', 'l1', 'a0', { title: 'old', version: 2 }));
    expect(state.cards[0]?.title).toBe('new');
  });

  it('drops items that moved to another board', () => {
    let state = upsertCard(board, card('c1', 'l1', 'a0'));
    state = upsertCard(state, card('c1', 'l9', 'a0', { boardId: 'b2', version: 2 }));
    expect(state.cards).toEqual([]);
  });

  it('removes the cards of a deleted list', () => {
    let state = upsertList(board, list('l1', 'a0'));
    state = upsertCard(state, card('c1', 'l1', 'a0'));
    state = removeList(state, 'l1');
    expect(state).toMatchObject({ lists: [], cards: [] });
  });

  it('applies real-time events', () => {
    const base = { boardId: 'b1', actorId: 'u1', clientMutationId: null };
    let state = applyEvent(board, { ...base, type: 'list.upserted', list: list('l1', 'a0') });
    state = applyEvent(state, { ...base, type: 'card.upserted', card: card('c1', 'l1', 'a0') });
    state = applyEvent(state, { ...base, type: 'card.deleted', cardId: 'c1' });
    state = applyEvent(state, {
      ...base,
      type: 'board.updated',
      board: { ...board, name: 'Renamed', version: 2 },
    });
    expect(state).toMatchObject({
      name: 'Renamed',
      lists: [{ id: 'l1' }],
      cards: [],
      role: 'ADMIN',
    });
  });
});

describe('positionAtIndex', () => {
  it('places items before, between and after siblings', () => {
    const siblings = [{ position: 'a0' }, { position: 'a1' }];
    expect(positionAtIndex(siblings, 0) < 'a0').toBe(true);
    const middle = positionAtIndex(siblings, 1);
    expect(middle > 'a0' && middle < 'a1').toBe(true);
    expect(positionAtIndex(siblings, 5) > 'a1').toBe(true);
  });

  it('still returns a usable key when neighbours share a position', () => {
    expect(positionAtIndex([{ position: 'a0' }, { position: 'a0' }], 1) > 'a0').toBe(true);
  });
});
