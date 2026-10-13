import { describe, expect, it } from 'vitest';
import { positionAt, rebalancedPositions } from './positions.js';

const items = (...positions: string[]) =>
  positions.map((position, i) => ({ id: `${i}`, position }));

function keyAt(siblings: ReturnType<typeof items>, index: number) {
  const result = positionAt(siblings, index);
  if (!('key' in result)) throw new Error('expected a key');
  return result.key;
}

describe('positionAt', () => {
  it('creates a first key in an empty container', () => {
    expect(keyAt([], 0)).toBe('a0');
  });

  it('places items at the start, between, and at the end', () => {
    const siblings = items('a0', 'a1');
    expect(keyAt(siblings, 0) < 'a0').toBe(true);
    const middle = keyAt(siblings, 1);
    expect(middle > 'a0' && middle < 'a1').toBe(true);
    expect(keyAt(siblings, 2) > 'a1').toBe(true);
  });

  it('clamps out-of-range indexes to the end', () => {
    expect(keyAt(items('a0'), 99) > 'a0').toBe(true);
  });

  it('asks for a rebalance when neighbours share a position', () => {
    expect(positionAt(items('a0', 'a0'), 1)).toEqual({ rebalance: true });
  });

  it('keeps ordering stable over many inserts at the same spot', () => {
    let siblings = items('a0', 'a1');
    for (let i = 0; i < 200; i++) {
      const key = keyAt(siblings, 1);
      siblings = [siblings[0]!, { id: `n${i}`, position: key }, ...siblings.slice(1)];
    }
    const positions = siblings.map((s) => s.position);
    expect([...positions].sort()).toEqual(positions);
  });
});

describe('rebalancedPositions', () => {
  it('returns increasing keys', () => {
    const keys = rebalancedPositions(5);
    expect(keys).toHaveLength(5);
    expect([...keys].sort()).toEqual(keys);
  });
});
