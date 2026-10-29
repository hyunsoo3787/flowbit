import {
  type Board,
  type BoardDetail,
  type BoardEvent,
  type Card,
  comparePositions,
  type Label,
  type List,
} from '@flowbit/shared';
import { generateKeyBetween } from 'fractional-indexing';

// Pure functions that apply changes to a cached board. Server responses,
// optimistic updates and real-time events all go through them.

/** Replaces or adds an item, unless the cached copy is newer. */
function upsert<T extends { id: string; version: number }>(items: T[], item: T): T[] {
  const index = items.findIndex((existing) => existing.id === item.id);
  if (index === -1) return [...items, item];
  if (items[index]!.version > item.version) return items;
  return items.map((existing, i) => (i === index ? item : existing));
}

export function upsertList(board: BoardDetail, list: List): BoardDetail {
  if (list.boardId !== board.id) return removeList(board, list.id);
  return { ...board, lists: upsert(board.lists, list).sort(comparePositions) };
}

export function removeList(board: BoardDetail, listId: string): BoardDetail {
  return {
    ...board,
    lists: board.lists.filter((list) => list.id !== listId),
    cards: board.cards.filter((card) => card.listId !== listId),
  };
}

export function upsertCard(board: BoardDetail, card: Card): BoardDetail {
  if (card.boardId !== board.id) return removeCard(board, card.id);
  return { ...board, cards: upsert(board.cards, card).sort(comparePositions) };
}

export function removeCard(board: BoardDetail, cardId: string): BoardDetail {
  return { ...board, cards: board.cards.filter((card) => card.id !== cardId) };
}

export function upsertLabel(board: BoardDetail, label: Label): BoardDetail {
  if (label.boardId !== board.id) return board;
  return { ...board, labels: upsert(board.labels, label) };
}

/** Removes a label from the board and from every card that had it. */
export function removeLabel(board: BoardDetail, labelId: string): BoardDetail {
  return {
    ...board,
    labels: board.labels.filter((label) => label.id !== labelId),
    cards: board.cards.map((card) =>
      card.labelIds.includes(labelId)
        ? { ...card, labelIds: card.labelIds.filter((id) => id !== labelId) }
        : card,
    ),
  };
}

/** Applies changed board fields, keeping the caller's role, lists and cards. */
export function updateBoardFields(board: BoardDetail, update: Omit<Board, 'role'>): BoardDetail {
  if (board.version > update.version) return board;
  const { name, visibility, background, version, updatedAt } = update;
  return { ...board, name, visibility, background, version, updatedAt };
}

/**
 * Applies a real-time event. `board.deleted` and `card.content` (which
 * concerns data loaded with the card dialog) are handled by the caller.
 */
export function applyEvent(board: BoardDetail, event: BoardEvent): BoardDetail {
  switch (event.type) {
    case 'board.updated':
      return updateBoardFields(board, event.board);
    case 'list.upserted':
      return upsertList(board, event.list);
    case 'list.deleted':
      return removeList(board, event.listId);
    case 'card.upserted':
      return upsertCard(board, event.card);
    case 'card.deleted':
      return removeCard(board, event.cardId);
    case 'label.upserted':
      return upsertLabel(board, event.label);
    case 'label.deleted':
      return removeLabel(board, event.labelId);
    case 'members.updated':
      return { ...board, members: event.members };
    case 'board.deleted':
    case 'card.content':
      return board;
  }
}

export function cardsInList(board: BoardDetail, listId: string): Card[] {
  return board.cards.filter((card) => card.listId === listId);
}

/**
 * A position between two neighbours, for optimistic updates. The server
 * computes the authoritative position; this only has to sort correctly until
 * the response arrives.
 */
export function positionBetween(before: string | null, after: string | null): string {
  try {
    return generateKeyBetween(before, after);
  } catch {
    return generateKeyBetween(before, null);
  }
}

/** Optimistically places an item at `toIndex` among `siblings` (sorted, without the item). */
export function positionAtIndex(siblings: { position: string }[], toIndex: number): string {
  const index = Math.min(Math.max(toIndex, 0), siblings.length);
  return positionBetween(siblings[index - 1]?.position ?? null, siblings[index]?.position ?? null);
}
