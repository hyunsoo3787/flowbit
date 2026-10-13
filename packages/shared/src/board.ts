import { z } from 'zod';
import { boardMemberSchema } from './members.js';
import { boardRoleSchema } from './roles.js';

// ---------------------------------------------------------------------------
// Boards
// ---------------------------------------------------------------------------

export const BOARD_NAME_MAX_LENGTH = 100;

export const BOARD_VISIBILITIES = ['PRIVATE', 'WORKSPACE'] as const;
export type BoardVisibility = (typeof BOARD_VISIBILITIES)[number];
export const boardVisibilitySchema = z.enum(BOARD_VISIBILITIES);

/** A board background color: any `#rrggbb` hex value. */
export const boardBackgroundSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Expected a #rrggbb color');
export type BoardBackground = string;

/** Light preset colors offered first in the picker; any other color can be chosen too. */
export const BOARD_BACKGROUND_PRESETS = [
  { key: 'blue', color: '#93c5fd' },
  { key: 'sky', color: '#7dd3fc' },
  { key: 'teal', color: '#5eead4' },
  { key: 'green', color: '#86efac' },
  { key: 'lime', color: '#bef264' },
  { key: 'yellow', color: '#fde047' },
  { key: 'orange', color: '#fdba74' },
  { key: 'red', color: '#fca5a5' },
  { key: 'pink', color: '#f9a8d4' },
  { key: 'purple', color: '#c4b5fd' },
  { key: 'gray', color: '#cbd5e1' },
  { key: 'stone', color: '#d6d3d1' },
] as const;
export type BoardBackgroundPreset = (typeof BOARD_BACKGROUND_PRESETS)[number]['key'];
export const DEFAULT_BOARD_BACKGROUND = '#93c5fd';

function channel(value: number) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a `#rrggbb` color, from 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

/**
 * Whether text on this background should be dark or light: whichever of
 * near-black (#0f172a) and white has the higher WCAG contrast ratio.
 */
export function textToneFor(hex: string): 'dark' | 'light' {
  const l = relativeLuminance(hex);
  const darkText = relativeLuminance('#0f172a');
  const contrastWithDark = (l + 0.05) / (darkText + 0.05);
  const contrastWithWhite = 1.05 / (l + 0.05);
  return contrastWithDark >= contrastWithWhite ? 'dark' : 'light';
}

export const createBoardSchema = z.object({
  name: z.string().trim().min(1).max(BOARD_NAME_MAX_LENGTH),
  visibility: boardVisibilitySchema.default('WORKSPACE'),
  background: boardBackgroundSchema.default(DEFAULT_BOARD_BACKGROUND),
});
export type CreateBoardInput = z.input<typeof createBoardSchema>;

export const updateBoardSchema = z
  .object({
    name: z.string().trim().min(1).max(BOARD_NAME_MAX_LENGTH),
    visibility: boardVisibilitySchema,
    background: boardBackgroundSchema,
  })
  .partial();
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;

export const boardSchema = z.object({
  id: z.uuid(),
  workspaceId: z.uuid(),
  name: z.string(),
  visibility: boardVisibilitySchema,
  background: boardBackgroundSchema,
  /** The caller's effective role on this board. */
  role: boardRoleSchema,
  version: z.int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Board = z.infer<typeof boardSchema>;

export const boardListSchema = z.object({ items: z.array(boardSchema) });
export type BoardList = z.infer<typeof boardListSchema>;

// ---------------------------------------------------------------------------
// Lists and cards. `position` is a fractional-index key (D-015): sort by
// plain string comparison, never by locale-aware comparison.
// ---------------------------------------------------------------------------

export const LIST_NAME_MAX_LENGTH = 200;
export const CARD_TITLE_MAX_LENGTH = 500;
export const CARD_DESCRIPTION_MAX_LENGTH = 50_000;

/** Target index among the destination's items, after removing the moved item. */
const toIndexSchema = z.int().min(0);

export const listSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  name: z.string(),
  position: z.string(),
  version: z.int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type List = z.infer<typeof listSchema>;

export const createListSchema = z.object({
  name: z.string().trim().min(1).max(LIST_NAME_MAX_LENGTH),
  /** Defaults to the end of the board. */
  toIndex: toIndexSchema.optional(),
});
export type CreateListInput = z.infer<typeof createListSchema>;

export const updateListSchema = z.object({
  name: z.string().trim().min(1).max(LIST_NAME_MAX_LENGTH),
});
export type UpdateListInput = z.infer<typeof updateListSchema>;

export const moveListSchema = z.object({
  /** Defaults to the list's current board. */
  toBoardId: z.uuid().optional(),
  toIndex: toIndexSchema,
});
export type MoveListInput = z.infer<typeof moveListSchema>;

// ---------------------------------------------------------------------------
// Labels. Colors are keys of a fixed palette, so they look right in light and
// dark mode; the web app maps each key to its shades.
// ---------------------------------------------------------------------------

export const LABEL_COLORS = [
  'green',
  'yellow',
  'orange',
  'red',
  'purple',
  'blue',
  'sky',
  'lime',
  'pink',
  'gray',
] as const;
export type LabelColor = (typeof LABEL_COLORS)[number];
export const labelColorSchema = z.enum(LABEL_COLORS);

/** Every new board starts with one unnamed label in each of these colors. */
export const DEFAULT_LABEL_COLORS: readonly LabelColor[] = LABEL_COLORS.slice(0, 6);

export const LABEL_NAME_MAX_LENGTH = 50;

export const labelSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  name: z.string(),
  color: labelColorSchema,
  version: z.int(),
});
export type Label = z.infer<typeof labelSchema>;

export const createLabelSchema = z.object({
  name: z.string().trim().max(LABEL_NAME_MAX_LENGTH).default(''),
  color: labelColorSchema,
});
export type CreateLabelInput = z.input<typeof createLabelSchema>;

export const updateLabelSchema = z
  .object({
    name: z.string().trim().max(LABEL_NAME_MAX_LENGTH),
    color: labelColorSchema,
  })
  .partial();
export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;

export const cardSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  listId: z.uuid(),
  title: z.string(),
  description: z.string(),
  position: z.string(),
  startAt: z.iso.datetime().nullable(),
  dueAt: z.iso.datetime().nullable(),
  /** When the due date was marked complete; null while open. */
  dueCompletedAt: z.iso.datetime().nullable(),
  coverColor: labelColorSchema.nullable(),
  assigneeIds: z.array(z.uuid()),
  labelIds: z.array(z.uuid()),
  /** Counts shown as badges on the board. */
  badges: z.object({
    comments: z.int(),
    checklistItems: z.int(),
    checklistItemsDone: z.int(),
  }),
  version: z.int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Card = z.infer<typeof cardSchema>;

export const createCardSchema = z.object({
  title: z.string().trim().min(1).max(CARD_TITLE_MAX_LENGTH),
  /** Defaults to the end of the list. */
  toIndex: toIndexSchema.optional(),
});
export type CreateCardInput = z.infer<typeof createCardSchema>;

export const updateCardSchema = z
  .object({
    title: z.string().trim().min(1).max(CARD_TITLE_MAX_LENGTH),
    description: z.string().max(CARD_DESCRIPTION_MAX_LENGTH),
    startAt: z.iso.datetime().nullable(),
    dueAt: z.iso.datetime().nullable(),
    /** Marks the due date complete (true) or open again (false). */
    dueComplete: z.boolean(),
    coverColor: labelColorSchema.nullable(),
  })
  .partial();
export type UpdateCardInput = z.infer<typeof updateCardSchema>;

export const moveCardSchema = z.object({
  /** May be a list on another board the caller can edit. */
  toListId: z.uuid(),
  toIndex: toIndexSchema,
});
export type MoveCardInput = z.infer<typeof moveCardSchema>;

/** A board with everything needed to render it. Cards are flat; group them by `listId`. */
export const boardDetailSchema = boardSchema.extend({
  lists: z.array(listSchema),
  cards: z.array(cardSchema),
  labels: z.array(labelSchema),
  /** Everyone with access to the board: candidates for assignments and mentions. */
  members: z.array(boardMemberSchema),
  /** Whether the caller watches the board, and which of its cards. */
  watching: z.boolean(),
  watchedCardIds: z.array(z.uuid()),
});
export type BoardDetail = z.infer<typeof boardDetailSchema>;

/** Compares fractional-index positions (byte order, matching the database's "C" collation). */
export function comparePositions(
  a: { position: string; id: string },
  b: { position: string; id: string },
) {
  if (a.position !== b.position) return a.position < b.position ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
