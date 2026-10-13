import { describe, expect, it } from 'vitest';
import { safeRedirect } from './redirect';

describe('safeRedirect', () => {
  it('accepts same-origin paths', () => {
    expect(safeRedirect('/w/123?tab=boards')).toBe('/w/123?tab=boards');
  });

  it('rejects anything that could leave the site', () => {
    for (const value of ['https://evil.example', '//evil.example', '/\\evil.example', 'w/1', 42]) {
      expect(safeRedirect(value)).toBeUndefined();
    }
  });
});
