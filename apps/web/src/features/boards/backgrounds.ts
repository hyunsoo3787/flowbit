import { textToneFor } from '@flowbit/shared';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

/**
 * Styles for a surface painted in a board's color. Text switches between dark
 * and white for contrast. In dark mode the color is darkened, so a light pick
 * doesn't glare, and text is always white there. Children can use
 * `bg-current/10` for chips and hover states that suit either text color.
 */
export function boardSurface(color: string): { style: CSSProperties; className: string } {
  return {
    style: { '--board-bg': color } as CSSProperties,
    className: cn(
      'bg-(--board-bg) dark:bg-[color-mix(in_oklab,var(--board-bg)_35%,black)]',
      textToneFor(color) === 'dark' ? 'text-slate-900 dark:text-white' : 'text-white',
    ),
  };
}
