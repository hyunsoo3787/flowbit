import { z } from 'zod';
import { userSummarySchema } from './members.js';

// Checklists and comments are loaded with the card dialog, not with the board.

export const CHECKLIST_TITLE_MAX_LENGTH = 200;
export const CHECKLIST_ITEM_TEXT_MAX_LENGTH = 1000;
export const COMMENT_BODY_MAX_LENGTH = 10_000;

const toIndexSchema = z.int().min(0);

export const checklistItemSchema = z.object({
  id: z.uuid(),
  checklistId: z.uuid(),
  text: z.string(),
  position: z.string(),
  completedAt: z.iso.datetime().nullable(),
  assigneeId: z.uuid().nullable(),
  dueAt: z.iso.datetime().nullable(),
});
export type ChecklistItem = z.infer<typeof checklistItemSchema>;

export const checklistSchema = z.object({
  id: z.uuid(),
  cardId: z.uuid(),
  title: z.string(),
  position: z.string(),
  items: z.array(checklistItemSchema),
});
export type Checklist = z.infer<typeof checklistSchema>;

export const checklistListSchema = z.object({ items: z.array(checklistSchema) });
export type ChecklistList = z.infer<typeof checklistListSchema>;

export const createChecklistSchema = z.object({
  title: z.string().trim().min(1).max(CHECKLIST_TITLE_MAX_LENGTH),
});
export type CreateChecklistInput = z.infer<typeof createChecklistSchema>;

export const updateChecklistSchema = createChecklistSchema;
export type UpdateChecklistInput = z.infer<typeof updateChecklistSchema>;

export const createChecklistItemSchema = z.object({
  text: z.string().trim().min(1).max(CHECKLIST_ITEM_TEXT_MAX_LENGTH),
});
export type CreateChecklistItemInput = z.infer<typeof createChecklistItemSchema>;

export const updateChecklistItemSchema = z
  .object({
    text: z.string().trim().min(1).max(CHECKLIST_ITEM_TEXT_MAX_LENGTH),
    completed: z.boolean(),
    assigneeId: z.uuid().nullable(),
    dueAt: z.iso.datetime().nullable(),
  })
  .partial();
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>;

export const moveChecklistItemSchema = z.object({
  /** Defaults to the item's current checklist; must be on the same card. */
  toChecklistId: z.uuid().optional(),
  toIndex: toIndexSchema,
});
export type MoveChecklistItemInput = z.infer<typeof moveChecklistItemSchema>;

export const commentSchema = z.object({
  id: z.uuid(),
  cardId: z.uuid(),
  /** Null when the author's account was deleted. */
  author: userSummarySchema.nullable(),
  /** Markdown; mentions are written as <@userId>. */
  body: z.string(),
  editedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type Comment = z.infer<typeof commentSchema>;

export const commentPageSchema = z.object({
  items: z.array(commentSchema),
  /** Pass as `before` to load older comments; null when there are none. */
  nextCursor: z.uuid().nullable(),
});
export type CommentPage = z.infer<typeof commentPageSchema>;

export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(COMMENT_BODY_MAX_LENGTH),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = createCommentSchema;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

const MENTION = /<@([0-9a-f-]{36})>/g;

/** User ids mentioned in a comment body, without duplicates. */
export function mentionedUserIds(body: string): string[] {
  return [...new Set([...body.matchAll(MENTION)].map((match) => match[1]!))];
}
