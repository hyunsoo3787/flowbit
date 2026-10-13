/**
 * Accepts only same-origin, absolute paths as a post-sign-in destination,
 * so a crafted link can't send users to another site.
 */
export function safeRedirect(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return undefined;
  return value;
}
