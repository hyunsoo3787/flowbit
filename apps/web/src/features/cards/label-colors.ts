import type { LabelColor } from '@flowbit/shared';

/**
 * Label and cover colors, as Tailwind classes that work in light and dark
 * mode. `chip` is a solid label, `soft` a tinted background for covers.
 */
export const LABEL_STYLES: Record<LabelColor, { chip: string; cover: string; swatch: string }> = {
  green: { chip: 'bg-green-600 text-white', cover: 'bg-green-500', swatch: 'bg-green-600' },
  yellow: {
    chip: 'bg-yellow-400 text-yellow-950',
    cover: 'bg-yellow-400',
    swatch: 'bg-yellow-400',
  },
  orange: { chip: 'bg-orange-500 text-white', cover: 'bg-orange-500', swatch: 'bg-orange-500' },
  red: { chip: 'bg-red-600 text-white', cover: 'bg-red-500', swatch: 'bg-red-600' },
  purple: { chip: 'bg-purple-600 text-white', cover: 'bg-purple-500', swatch: 'bg-purple-600' },
  blue: { chip: 'bg-blue-600 text-white', cover: 'bg-blue-500', swatch: 'bg-blue-600' },
  sky: { chip: 'bg-sky-500 text-white', cover: 'bg-sky-400', swatch: 'bg-sky-500' },
  lime: { chip: 'bg-lime-500 text-lime-950', cover: 'bg-lime-400', swatch: 'bg-lime-500' },
  pink: { chip: 'bg-pink-500 text-white', cover: 'bg-pink-400', swatch: 'bg-pink-500' },
  gray: { chip: 'bg-slate-500 text-white', cover: 'bg-slate-400', swatch: 'bg-slate-500' },
};
