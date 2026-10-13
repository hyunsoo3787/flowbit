import { isLocale, type Locale, resolveLocale } from '@flowbit/shared';

/** Parses an Accept-Language header into language tags, highest quality first. */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      return { tag: tag.trim(), quality: q ? Number(q.slice(2)) : 1 };
    })
    .filter(({ tag, quality }) => tag && tag !== '*' && Number.isFinite(quality) && quality > 0)
    .sort((a, b) => b.quality - a.quality)
    .map(({ tag }) => tag);
}

/** The locale to store for a new user: an explicit choice wins over the browser's preference. */
export function localeForNewUser(
  requested: unknown,
  acceptLanguage: string | null | undefined,
): Locale {
  if (isLocale(requested)) return requested;
  return resolveLocale(parseAcceptLanguage(acceptLanguage));
}
