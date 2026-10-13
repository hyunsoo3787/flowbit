import type { TFunction } from 'i18next';
import { ApiError } from '@/api/client';

/** An error code that has a localized message under `errors.*`. */
function knownErrorKey(t: TFunction, code: string | undefined) {
  if (!code) return null;
  const key = `errors.${code}`;
  return t(key as never, { defaultValue: '' }) ? key : null;
}

/**
 * Turns any error (API, Better Auth, network) into a message for the user.
 * The server's own message is never shown: it is English and meant for developers.
 */
export function errorMessage(t: TFunction, error: unknown): string {
  if (error instanceof ApiError) {
    return t((knownErrorKey(t, error.code) ?? 'errors.generic') as never);
  }
  if (typeof error === 'object' && error !== null) {
    const { code, status } = error as { code?: string; status?: number };
    if (status === 429) return t('errors.RATE_LIMITED');
    const key = knownErrorKey(t, code);
    if (key) return t(key as never);
  }
  if (error instanceof TypeError) return t('errors.network');
  return t('errors.generic');
}
