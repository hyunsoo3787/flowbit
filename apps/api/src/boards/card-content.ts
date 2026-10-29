import type {
  Checklist as ChecklistDto,
  ChecklistItem as ChecklistItemDto,
  Comment as CommentDto,
} from '@flowbit/shared';
import type {
  Checklist,
  ChecklistItem,
  Comment,
  Prisma,
  User,
} from '../generated/prisma/client.js';
import { toUserSummary } from './mappers.js';
import { POSITION_ORDER } from './ordering.js';

export const CHECKLIST_INCLUDE = {
  items: { orderBy: [...POSITION_ORDER] },
} satisfies Prisma.ChecklistInclude;

export function toChecklistItemDto(item: ChecklistItem): ChecklistItemDto {
  return {
    id: item.id,
    checklistId: item.checklistId,
    text: item.text,
    position: item.position,
    completedAt: item.completedAt?.toISOString() ?? null,
    assigneeId: item.assigneeId,
    dueAt: item.dueAt?.toISOString() ?? null,
  };
}

export function toChecklistDto(checklist: Checklist & { items: ChecklistItem[] }): ChecklistDto {
  return {
    id: checklist.id,
    cardId: checklist.cardId,
    title: checklist.title,
    position: checklist.position,
    items: checklist.items.map(toChecklistItemDto),
  };
}

export function toCommentDto(
  comment: Comment & { author: Pick<User, 'id' | 'name' | 'email' | 'image'> | null },
): CommentDto {
  return {
    id: comment.id,
    cardId: comment.cardId,
    author: comment.author ? toUserSummary(comment.author) : null,
    body: comment.body,
    editedAt: comment.editedAt?.toISOString() ?? null,
    createdAt: comment.createdAt.toISOString(),
  };
}

/**
 * Recounts a card's checklist items and comments for its badges, bumping its
 * version so clients take the new counts.
 */
export async function refreshCardCounters(tx: Prisma.TransactionClient, cardId: string) {
  const [checklistTotal, checklistDone, commentCount] = await Promise.all([
    tx.checklistItem.count({ where: { checklist: { cardId } } }),
    tx.checklistItem.count({ where: { checklist: { cardId }, completedAt: { not: null } } }),
    tx.comment.count({ where: { cardId } }),
  ]);
  await tx.card.update({
    where: { id: cardId },
    data: { checklistTotal, checklistDone, commentCount, version: { increment: 1 } },
  });
}
