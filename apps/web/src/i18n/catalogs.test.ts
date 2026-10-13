import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '@flowbit/shared';
import en from './locales/en.json';
import ko from './locales/ko.json';

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('message catalogs', () => {
  it('have the same keys in every language', () => {
    expect(keys(ko).sort()).toEqual(keys(en).sort());
  });

  it('translate every API error code', () => {
    for (const code of ERROR_CODES) {
      expect(en.errors, code).toHaveProperty(code);
    }
  });
});
