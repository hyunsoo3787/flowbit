import { Injectable } from '@nestjs/common';
import type {
  Comment as CommentDto,
  CommentPage,
  CreateCommentInput,
  UpdateCommentInput,
} from '@flowbit/shared';
import { mentionedUserIds } from '@flowbit/shared';
import { AppError } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { canEditContent } from './board-policy.js';
import { refreshCardCounters, toCommentDto } from './card-content.js';
import { CardsService } from './cards.service.js';
import { USER_SUMMARY_SELECT } from './mappers.js';
import { lockCard } from './ordering.js';

const PAGE_SIZE = 50;
const AUTHOR = { author: { select: USER_SUMMARY_SELECT } } as const;

/** Comments on a card. Observers read them; members and admins write them. */
@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cards: CardsService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Newest first. Comment ids are UUIDv7, so they sort by creation time. */
  async list(userId: string, cardId: string, before?: string): Promise<CommentPage> {
    await this.cards.requireCard(userId, cardId, () => true);
    const comments = await this.prisma.comment.findMany({
      where: { cardId, ...(before ? { id: { lt: before } } : {}) },
      orderBy: { id: 'desc' },
      take: PAGE_SIZE + 1,
      include: AUTHOR,
    });
    const page = comments.slice(0, PAGE_SIZE);
    return {
      items: page.map(toCommentDto),
      nextCursor: comments.length > PAGE_SIZE ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async create(
    userId: string,
    cardId: string,
    input: CreateCommentInput,
    clientMutationId: string | null,
  ): Promise<CommentDto> {
    const card = await this.cards.requireCard(userId, cardId, canEditContent);
    const comment = await this.prisma.$transaction(async (tx) => {
      await lockCard(tx, cardId);
      const created = await tx.comment.create({
        data: { cardId, authorId: userId, body: input.body },
        include: AUTHOR,
      });
      await refreshCardCounters(tx, cardId);
      await tx.activity.create({
        data: {
          boardId: card.boardId,
          cardId,
          actorId: userId,
          type: 'comment.created',
          payload: { commentId: created.id, mentions: mentionedUserIds(created.body) },
        },
      });
      return created;
    });
    this.publish(card, userId, clientMutationId, true);
    return toCommentDto(comment);
  }

  /** Only the author edits a comment. */
  async update(
    userId: string,
    commentId: string,
    input: UpdateCommentInput,
    clientMutationId: string | null,
  ): Promise<CommentDto> {
    const { comment: existing, card } = await this.requireComment(userId, commentId);
    if (existing.authorId !== userId) throw AppError.forbidden();
    const comment = await this.prisma.comment.update({
      where: { id: commentId },
      data: { body: input.body, editedAt: new Date() },
      include: AUTHOR,
    });
    this.publish(card, userId, clientMutationId, false);
    return toCommentDto(comment);
  }

  /** The author, or a board admin for moderation, deletes a comment. */
  async remove(userId: string, commentId: string, clientMutationId: string | null) {
    const { comment, card } = await this.requireComment(userId, commentId);
    if (comment.authorId !== userId && card.role !== 'ADMIN') throw AppError.forbidden();
    await this.prisma.$transaction(async (tx) => {
      await lockCard(tx, card.id);
      await tx.comment.delete({ where: { id: commentId } });
      await refreshCardCounters(tx, card.id);
    });
    this.publish(card, userId, clientMutationId, true);
  }

  private async requireComment(userId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw AppError.notFound('COMMENT_NOT_FOUND');
    const card = await this.cards
      .requireCard(userId, comment.cardId, canEditContent)
      .catch((error: unknown) => {
        if (error instanceof AppError && error.code === 'CARD_NOT_FOUND') {
          throw AppError.notFound('COMMENT_NOT_FOUND');
        }
        throw error;
      });
    return { comment, card };
  }

  private publish(
    card: { id: string; boardId: string },
    actorId: string,
    clientMutationId: string | null,
    countsChanged: boolean,
  ) {
    this.realtime.publish({
      type: 'card.content',
      boardId: card.boardId,
      actorId,
      clientMutationId,
      cardId: card.id,
      part: 'comments',
    });
    // Counts aren't applied optimistically, so the caller's tab needs this too:
    // no mutation id, or it would be ignored as an echo.
    if (countsChanged) void this.cards.republish(card.id, actorId, null);
  }
}
