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
