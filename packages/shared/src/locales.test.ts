import { describe, expect, it } from 'vitest';
import { isLocale, resolveLocale } from './locales.js';

describe('resolveLocale', () => {
  it('picks the first supported base language', () => {
    expect(resolveLocale(['fr-FR', 'ko-KR', 'en-US'])).toBe('ko');
  });

  it('falls back to English', () => {
    expect(resolveLocale(['fr', 'de'])).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
  });
});

describe('isLocale', () => {
  it('accepts only supported locales', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('ko')).toBe(true);
    expect(isLocale('ja')).toBe(false);
    expect(isLocale(1)).toBe(false);
  });
});
