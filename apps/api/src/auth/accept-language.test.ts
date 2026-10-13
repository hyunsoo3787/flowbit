import { describe, expect, it } from 'vitest';
import { localeForNewUser, parseAcceptLanguage } from './accept-language.js';

describe('parseAcceptLanguage', () => {
  it('orders tags by quality', () => {
    expect(parseAcceptLanguage('en;q=0.5, ko-KR, fr;q=0.8')).toEqual(['ko-KR', 'fr', 'en']);
  });

  it('ignores wildcards, zero quality and empty input', () => {
    expect(parseAcceptLanguage('*, ko;q=0')).toEqual([]);
    expect(parseAcceptLanguage(undefined)).toEqual([]);
  });
});

describe('localeForNewUser', () => {
  it('prefers an explicitly requested locale', () => {
    expect(localeForNewUser('en', 'ko-KR')).toBe('en');
  });

  it('falls back to the browser language, then English', () => {
    expect(localeForNewUser(undefined, 'ko-KR,ko;q=0.9')).toBe('ko');
    expect(localeForNewUser('xx', 'de-DE')).toBe('en');
  });
});
