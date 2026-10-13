import type { BoardBackground } from '@flowbit/shared';

/**
 * Tailwind classes for each named board background, light and dark. The
 * shades are dark enough for the white text drawn on them.
 */
export const BACKGROUND_CLASSES: Record<BoardBackground, string> = {
  blue: 'bg-blue-700 dark:bg-blue-950',
  green: 'bg-emerald-700 dark:bg-emerald-950',
  orange: 'bg-orange-700 dark:bg-orange-950',
  red: 'bg-rose-700 dark:bg-rose-950',
  purple: 'bg-violet-700 dark:bg-violet-950',
  pink: 'bg-pink-700 dark:bg-pink-950',
  teal: 'bg-teal-700 dark:bg-teal-950',
  slate: 'bg-slate-700 dark:bg-slate-900',
};
