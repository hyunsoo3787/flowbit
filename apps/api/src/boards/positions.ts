import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

export interface Positioned {
  id: string;
  position: string;
}

/**
 * The fractional-index key (D-015) for inserting at `toIndex` among `siblings`,
 * which must be sorted and must not contain the item being placed.
 *
 * Returns `rebalance` instead when two neighbours share a position (possible
 * after concurrent inserts into the same gap): the caller must then rewrite the
 * siblings' positions with `rebalancedPositions` first.
 */
export function positionAt(
  siblings: readonly Positioned[],
  toIndex: number,
): { key: string } | { rebalance: true } {
  const index = Math.min(Math.max(toIndex, 0), siblings.length);
  const before = siblings[index - 1]?.position ?? null;
  const after = siblings[index]?.position ?? null;
  if (before !== null && after !== null && before >= after) return { rebalance: true };
  return { key: generateKeyBetween(before, after) };
}

/** Fresh, evenly spread keys for `count` items, keeping their order. */
export function rebalancedPositions(count: number): string[] {
  return generateNKeysBetween(null, null, count);
}
