import { z } from 'zod';

// ---------------------------------------------------------------------------
// Boards
// ---------------------------------------------------------------------------

export const BOARD_NAME_MAX_LENGTH = 100;

export const BOARD_VISIBILITIES = ['PRIVATE', 'WORKSPACE'] as const;
export type BoardVisibility = (typeof BOARD_VISIBILITIES)[number];
export const boardVisibilitySchema = z.enum(BOARD_VISIBILITIES);

export const BOARD_ROLES = ['ADMIN', 'MEMBER', 'OBSERVER'] as const;
export type BoardRole = (typeof BOARD_ROLES)[number];
export const boardRoleSchema = z.enum(BOARD_ROLES);

/** Named background colors; the web app maps each to a theme-aware color. */
export const BOARD_BACKGROUNDS = [
  'blue',
  'green',
  'orange',
  'red',
  'purple',
  'pink',
  'teal',
  'slate',
] as const;
export type BoardBackground = (typeof BOARD_BACKGROUNDS)[number];
export const boardBackgroundSchema = z.enum(BOARD_BACKGROUNDS);

export const createBoardSchema = z.object({
  name: z.string().trim().min(1).max(BOARD_NAME_MAX_LENGTH),
  visibility: boardVisibilitySchema.default('WORKSPACE'),
  background: boardBackgroundSchema.default('blue'),
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

export const cardSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  listId: z.uuid(),
  title: z.string(),
  description: z.string(),
  position: z.string(),
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
