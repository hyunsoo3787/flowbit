import { Injectable } from '@nestjs/common';
import type {
  BoardRole,
  Card as CardDto,
  CreateCardInput,
  MoveCardInput,
  UpdateCardInput,
} from '@flowbit/shared';
import { AppError } from '../common/app-error.js';
import { DomainEvents } from '../events/domain-events.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { BoardAccessService } from './board-access.service.js';
import { BoardMembersService } from './board-members.service.js';
import { canEditContent } from './board-policy.js';
import { CARD_INCLUDE, type CardWithRelations, toCardDto } from './mappers.js';
import { cardPosition, dropForeignLabels, lockList } from './ordering.js';

const END = Number.MAX_SAFE_INTEGER;

@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
    private readonly boardMembers: BoardMembersService,
    private readonly realtime: RealtimeService,
    private readonly events: DomainEvents,
  ) {}

  async create(
    userId: string,
    listId: string,
    input: CreateCardInput,
    clientMutationId: string | null,
  ): Promise<CardDto> {
    const list = await this.prisma.list.findUnique({ where: { id: listId } });
    if (!list) throw AppError.notFound('LIST_NOT_FOUND');

    const { card, rebalanced, activityId } = await this.prisma.$transaction(async (tx) => {
      await this.access.require(userId, list.boardId, canEditContent, {
        client: tx,
        notFound: 'LIST_NOT_FOUND',
      });
      await lockList(tx, listId);
      const { position, rebalanced } = await cardPosition(tx, listId, input.toIndex ?? END);
      const card = await tx.card.create({
        data: { boardId: list.boardId, listId, title: input.title, position, createdById: userId },
        include: CARD_INCLUDE,
      });
      const activity = await tx.activity.create({
        data: {
          boardId: list.boardId,
          cardId: card.id,
          actorId: userId,
          type: 'card.created',
          payload: { listId, title: card.title },
        },
      });
      return { card, rebalanced, activityId: activity.id };
    });
    await this.publishCards(rebalanced, userId, clientMutationId);
    this.publishCard(card, userId, clientMutationId);
    this.events.emit({
      type: 'card.created',
      boardId: card.boardId,
      cardId: card.id,
      actorId: userId,
      activityId,
    });
    return toCardDto(card);
  }

  async get(userId: string, cardId: string): Promise<CardDto> {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      include: CARD_INCLUDE,
    });
    if (!card) throw AppError.notFound('CARD_NOT_FOUND');
    await this.access.require(userId, card.boardId, () => true, { notFound: 'CARD_NOT_FOUND' });
    return toCardDto(card);
  }

  async update(
    userId: string,
    cardId: string,
    input: UpdateCardInput,
    clientMutationId: string | null,
  ): Promise<CardDto> {
    const existing = await this.requireEditable(userId, cardId);
    const { dueComplete, startAt, dueAt, ...fields } = input;
    const card = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.card.update({
        where: { id: cardId },
        data: {
          ...fields,
          ...(startAt === undefined ? {} : { startAt: startAt ? new Date(startAt) : null }),
          ...(dueAt === undefined ? {} : { dueAt: dueAt ? new Date(dueAt) : null }),
          ...(dueComplete === undefined
            ? {}
            : { dueCompletedAt: dueComplete ? (existing.dueCompletedAt ?? new Date()) : null }),
          version: { increment: 1 },
        },
        include: CARD_INCLUDE,
      });
      await tx.activity.create({
        data: {
          boardId: existing.boardId,
          cardId,
          actorId: userId,
          type: 'card.updated',
          payload: { fields: Object.keys(input) },
        },
      });
      return updated;
    });
    this.publishCard(card, userId, clientMutationId);
    return toCardDto(card);
  }

  async move(
    userId: string,
    cardId: string,
    input: MoveCardInput,
    clientMutationId: string | null,
  ): Promise<CardDto> {
    const existing = await this.requireEditable(userId, cardId);
    const target = await this.prisma.list.findUnique({ where: { id: input.toListId } });
    if (!target) throw AppError.notFound('LIST_NOT_FOUND');

    const { card, rebalanced, activityId } = await this.prisma.$transaction(async (tx) => {
      await this.access.require(userId, target.boardId, canEditContent, {
        client: tx,
        notFound: 'LIST_NOT_FOUND',
      });
      await lockList(tx, target.id);
      const { position, rebalanced } = await cardPosition(tx, target.id, input.toIndex, cardId);
      if (target.boardId !== existing.boardId) {
        await dropForeignLabels(tx, [cardId], target.boardId);
      }
      const card = await tx.card.update({
        where: { id: cardId },
        data: { listId: target.id, boardId: target.boardId, position, version: { increment: 1 } },
        include: CARD_INCLUDE,
      });
      const activity = await tx.activity.create({
        data: {
          boardId: target.boardId,
          cardId,
          actorId: userId,
          type: 'card.moved',
          payload: {
            fromListId: existing.listId,
            toListId: target.id,
            fromBoardId: existing.boardId,
            toBoardId: target.boardId,
          },
        },
      });
      return { card, rebalanced, activityId: activity.id };
    });

    await this.publishCards(rebalanced, userId, clientMutationId);
    if (existing.listId !== card.listId) {
      this.events.emit({
        type: 'card.moved',
        boardId: card.boardId,
        cardId,
        actorId: userId,
        fromListId: existing.listId,
        toListId: card.listId,
        activityId,
      });
    }
    if (existing.boardId !== card.boardId) {
      this.realtime.publish({
        type: 'card.deleted',
        boardId: existing.boardId,
        actorId: userId,
        clientMutationId,
        cardId,
      });
    }
    this.publishCard(card, userId, clientMutationId);
    return toCardDto(card);
  }

  async remove(userId: string, cardId: string, clientMutationId: string | null): Promise<void> {
    const existing = await this.requireEditable(userId, cardId);
    await this.prisma.$transaction(async (tx) => {
      await tx.activity.create({
        data: {
          boardId: existing.boardId,
          actorId: userId,
          type: 'card.deleted',
          payload: { cardId, title: existing.title },
        },
      });
      await tx.card.delete({ where: { id: cardId } });
    });
    this.realtime.publish({
      type: 'card.deleted',
      boardId: existing.boardId,
      actorId: userId,
      clientMutationId,
      cardId,
    });
  }

  async setAssignee(
    userId: string,
    cardId: string,
    assigneeId: string,
    assigned: boolean,
    clientMutationId: string | null,
  ): Promise<CardDto> {
    const existing = await this.requireEditable(userId, cardId);
    if (assigned && !(await this.boardMembers.roleOf(existing.boardId, assigneeId))) {
      throw AppError.notFound('MEMBER_NOT_FOUND');
    }
    const result = await this.changeRelation(existing, userId, clientMutationId, async (tx) => {
      if (assigned) {
        const { count } = await tx.cardAssignee.createMany({
          data: [{ cardId, userId: assigneeId }],
          skipDuplicates: true,
        });
        return count > 0 ? { type: 'card.assigned', payload: { userId: assigneeId } } : null;
      }
      const { count } = await tx.cardAssignee.deleteMany({ where: { cardId, userId: assigneeId } });
      return count > 0 ? { type: 'card.unassigned', payload: { userId: assigneeId } } : null;
    });
    if (assigned && result.activityId) {
      this.events.emit({
        type: 'card.assigned',
        boardId: existing.boardId,
        cardId,
        actorId: userId,
        assigneeId,
        activityId: result.activityId,
      });
    }
    return result.card;
  }

  async setLabel(
    userId: string,
    cardId: string,
    labelId: string,
    applied: boolean,
    clientMutationId: string | null,
  ): Promise<CardDto> {
    const existing = await this.requireEditable(userId, cardId);
    const label = await this.prisma.label.findUnique({ where: { id: labelId } });
    if (!label || label.boardId !== existing.boardId) throw AppError.notFound('LABEL_NOT_FOUND');
    const result = await this.changeRelation(existing, userId, clientMutationId, async (tx) => {
      if (applied) {
        const { count } = await tx.cardLabel.createMany({
          data: [{ cardId, labelId }],
          skipDuplicates: true,
        });
        return count > 0 ? { type: 'card.labeled', payload: { labelId } } : null;
      }
      const { count } = await tx.cardLabel.deleteMany({ where: { cardId, labelId } });
      return count > 0 ? { type: 'card.unlabeled', payload: { labelId } } : null;
    });
    return result.card;
  }

  /**
   * Applies a change to a card's assignees or labels. When it changed anything,
   * bumps the card's version, records the activity and broadcasts the card.
   */
  private async changeRelation(
    existing: { id: string; boardId: string },
    userId: string,
    clientMutationId: string | null,
    change: (
      tx: Prisma.TransactionClient,
    ) => Promise<{ type: string; payload: Prisma.InputJsonObject } | null>,
  ): Promise<{ card: CardDto; activityId: string | null }> {
    const { card, activityId } = await this.prisma.$transaction(async (tx) => {
      const activity = await change(tx);
      if (!activity) {
        const card = await tx.card.findUniqueOrThrow({
          where: { id: existing.id },
          include: CARD_INCLUDE,
        });
        return { card, activityId: null };
      }
      const card = await tx.card.update({
        where: { id: existing.id },
        data: { version: { increment: 1 } },
        include: CARD_INCLUDE,
      });
      const created = await tx.activity.create({
        data: { boardId: existing.boardId, cardId: existing.id, actorId: userId, ...activity },
      });
      return { card, activityId: created.id };
    });
    if (activityId) this.publishCard(card, userId, clientMutationId);
    return { card: toCardDto(card), activityId };
  }

  /** Re-reads a card and broadcasts it, e.g. after its counters changed. */
  async republish(cardId: string, actorId: string, clientMutationId: string | null) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      include: CARD_INCLUDE,
    });
    if (card) this.publishCard(card, actorId, clientMutationId);
  }

  /** The card, if the caller may edit it. Used by the card's checklists and comments too. */
  async requireEditable(userId: string, cardId: string) {
    return this.requireCard(userId, cardId, canEditContent);
  }

  /** The card and the caller's role, if the caller can see it. */
  async requireCard(userId: string, cardId: string, allowed: (role: BoardRole) => boolean) {
    const card = await this.prisma.card.findUnique({ where: { id: cardId } });
    if (!card) throw AppError.notFound('CARD_NOT_FOUND');
    const { role } = await this.access.require(userId, card.boardId, allowed, {
      notFound: 'CARD_NOT_FOUND',
    });
    return Object.assign(card, { role });
  }

  publishCard(card: CardWithRelations, actorId: string, clientMutationId: string | null) {
    this.realtime.publish({
      type: 'card.upserted',
      boardId: card.boardId,
      actorId,
      clientMutationId,
      card: toCardDto(card),
    });
  }

  private async publishCards(ids: string[], actorId: string, clientMutationId: string | null) {
    if (ids.length === 0) return;
    const cards = await this.prisma.card.findMany({
      where: { id: { in: ids } },
      include: CARD_INCLUDE,
    });
    for (const card of cards) this.publishCard(card, actorId, clientMutationId);
  }
}
