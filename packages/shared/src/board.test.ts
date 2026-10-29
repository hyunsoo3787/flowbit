import { describe, expect, it } from 'vitest';
import {
  BOARD_BACKGROUND_PRESETS,
  comparePositions,
  createBoardSchema,
  textToneFor,
  updateBoardSchema,
} from './board.js';

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
      background: '#93c5fd',
    });
  });

  it('accepts any #rrggbb color and rejects other values', () => {
    expect(updateBoardSchema.safeParse({ background: '#1A2b3C' }).success).toBe(true);
    for (const background of ['blue', '#abc', '#12345g', '93c5fd']) {
      expect(updateBoardSchema.safeParse({ background }).success, background).toBe(false);
    }
  });
});

describe('textToneFor', () => {
  it('picks dark text on light colors and light text on dark colors', () => {
    expect(textToneFor('#ffffff')).toBe('dark');
    expect(textToneFor('#fde047')).toBe('dark');
    expect(textToneFor('#000000')).toBe('light');
    expect(textToneFor('#1e3a8a')).toBe('light');
  });

  it('uses dark text on every preset, which are all light', () => {
    for (const preset of BOARD_BACKGROUND_PRESETS) {
      expect(textToneFor(preset.color), preset.key).toBe('dark');
    }
  });
});
