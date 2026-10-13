import { describe, expect, it } from 'vitest';
import { comparePositions, createBoardSchema } from './board.js';

describe('comparePositions', () => {
  it('uses byte order, not locale order', () => {
    // In many locale collations "a" sorts before "B"; in byte order it doesn't.
    const items = [
      { id: '1', position: 'a0' },
      { id: '2', position: 'Zz' },
      { id: '3', position: 'a0V' },
    ];
    expect(items.sort(comparePositions).map((item) => item.position)).toEqual(['Zz', 'a0', 'a0V']);
  });

  it('breaks ties by id', () => {
    const items = [
      { id: 'b', position: 'a1' },
      { id: 'a', position: 'a1' },
    ];
    expect(items.sort(comparePositions).map((item) => item.id)).toEqual(['a', 'b']);
  });
});

describe('createBoardSchema', () => {
  it('applies defaults', () => {
    expect(createBoardSchema.parse({ name: ' Roadmap ' })).toEqual({
      name: 'Roadmap',
      visibility: 'WORKSPACE',
      background: 'blue',
    });
  });
});
