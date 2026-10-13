import { z } from 'zod';

export const SUPPORTED_LOCALES = ['en', 'ko'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const localeSchema = z.enum(SUPPORTED_LOCALES);

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Picks the best supported locale from a list of BCP 47 tags, e.g. `navigator.languages`. */
export function resolveLocale(candidates: readonly string[] | undefined): Locale {
  for (const tag of candidates ?? []) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
