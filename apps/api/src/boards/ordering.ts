import type { Prisma } from '../generated/prisma/client.js';
import { type Positioned, positionAt, rebalancedPositions } from './positions.js';

export const POSITION_ORDER = [{ position: 'asc' }, { id: 'asc' }] as const;

/**
 * Locks the row that owns an ordered collection, so concurrent inserts into the
 * same board (lists) or list (cards) are serialized and get distinct keys.
 */
export async function lockBoard(tx: Prisma.TransactionClient, boardId: string) {
  await tx.$executeRaw`SELECT 1 FROM "boards" WHERE "id" = ${boardId}::uuid FOR UPDATE`;
}

export async function lockList(tx: Prisma.TransactionClient, listId: string) {
  await tx.$executeRaw`SELECT 1 FROM "lists" WHERE "id" = ${listId}::uuid FOR UPDATE`;
}

/**
 * The position for an item placed at `toIndex` among `siblings` (sorted, not
 * containing the item). If two siblings share a position, all siblings are
 * first given fresh positions through `rewrite`; their ids are returned so the
 * caller can broadcast the change.
 */
async function place(
  siblings: Positioned[],
  toIndex: number,
  rewrite: (id: string, position: string) => Promise<unknown>,
) {
  const first = positionAt(siblings, toIndex);
  if ('key' in first) return { position: first.key, rebalanced: [] as string[] };

  const keys = rebalancedPositions(siblings.length);
  for (const [i, sibling] of siblings.entries()) await rewrite(sibling.id, keys[i]!);
  const spread = siblings.map((sibling, i) => ({ id: sibling.id, position: keys[i]! }));
  const second = positionAt(spread, toIndex) as { key: string };
  return { position: second.key, rebalanced: spread.map((sibling) => sibling.id) };
}

export async function listPosition(
  tx: Prisma.TransactionClient,
  boardId: string,
  toIndex: number,
  excludeId?: string,
) {
  const siblings = await tx.list.findMany({
    where: { boardId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    orderBy: [...POSITION_ORDER],
    select: { id: true, position: true },
  });
  return place(siblings, toIndex, (id, position) =>
    tx.list.update({ where: { id }, data: { position, version: { increment: 1 } } }),
  );
}

export async function cardPosition(
  tx: Prisma.TransactionClient,
  listId: string,
  toIndex: number,
  excludeId?: string,
) {
  const siblings = await tx.card.findMany({
    where: { listId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    orderBy: [...POSITION_ORDER],
    select: { id: true, position: true },
  });
  return place(siblings, toIndex, (id, position) =>
    tx.card.update({ where: { id }, data: { position, version: { increment: 1 } } }),
  );
}

/** Locks a card, serializing changes to its checklists and their items. */
export async function lockCard(tx: Prisma.TransactionClient, cardId: string) {
  await tx.$executeRaw`SELECT 1 FROM "cards" WHERE "id" = ${cardId}::uuid FOR UPDATE`;
}

export async function checklistPosition(
  tx: Prisma.TransactionClient,
  cardId: string,
  toIndex: number,
) {
  const siblings = await tx.checklist.findMany({
    where: { cardId },
    orderBy: [...POSITION_ORDER],
    select: { id: true, position: true },
  });
  return place(siblings, toIndex, (id, position) =>
    tx.checklist.update({ where: { id }, data: { position } }),
  );
}

export async function checklistItemPosition(
  tx: Prisma.TransactionClient,
  checklistId: string,
  toIndex: number,
  excludeId?: string,
) {
  const siblings = await tx.checklistItem.findMany({
    where: { checklistId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    orderBy: [...POSITION_ORDER],
    select: { id: true, position: true },
  });
  return place(siblings, toIndex, (id, position) =>
    tx.checklistItem.update({ where: { id }, data: { position } }),
  );
}

/**
 * Labels belong to a board. When cards move to another board, the labels of
 * their old board are taken off them.
 */
export async function dropForeignLabels(
  tx: Prisma.TransactionClient,
  cardIds: string[],
  boardId: string,
) {
  if (cardIds.length === 0) return;
  await tx.cardLabel.deleteMany({
    where: { cardId: { in: cardIds }, label: { boardId: { not: boardId } } },
  });
}
