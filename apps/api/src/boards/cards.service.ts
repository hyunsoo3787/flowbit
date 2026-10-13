import { Injectable } from '@nestjs/common';
import type {
  Card as CardDto,
  CreateCardInput,
  MoveCardInput,
  UpdateCardInput,
} from '@flowbit/shared';
import { AppError } from '../common/app-error.js';
import type { Card } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { BoardAccessService } from './board-access.service.js';
import { canEditContent } from './board-policy.js';
import { toCardDto } from './mappers.js';
import { cardPosition, lockList } from './ordering.js';

const END = Number.MAX_SAFE_INTEGER;

@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
    private readonly realtime: RealtimeService,
  ) {}

  async create(
    userId: string,
    listId: string,
    input: CreateCardInput,
    clientMutationId: string | null,
  ): Promise<CardDto> {
    const list = await this.prisma.list.findUnique({ where: { id: listId } });
    if (!list) throw AppError.notFound('LIST_NOT_FOUND');

    const { card, rebalanced } = await this.prisma.$transaction(async (tx) => {
      await this.access.require(userId, list.boardId, canEditContent, {
        client: tx,
        notFound: 'LIST_NOT_FOUND',
      });
      await lockList(tx, listId);
      const { position, rebalanced } = await cardPosition(tx, listId, input.toIndex ?? END);
      const card = await tx.card.create({
        data: { boardId: list.boardId, listId, title: input.title, position, createdById: userId },
      });
      await tx.activity.create({
        data: {
          boardId: list.boardId,
          cardId: card.id,
          actorId: userId,
          type: 'card.created',
          payload: { listId, title: card.title },
        },
      });
      return { card, rebalanced };
    });
    await this.publishCards(rebalanced, userId, clientMutationId);
    this.publishCard(card, userId, clientMutationId);
    return toCardDto(card);
  }

  async get(userId: string, cardId: string): Promise<CardDto> {
    const card = await this.prisma.card.findUnique({ where: { id: cardId } });
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
    const card = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.card.update({
        where: { id: cardId },
        data: { ...input, version: { increment: 1 } },
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

    const { card, rebalanced } = await this.prisma.$transaction(async (tx) => {
      await this.access.require(userId, target.boardId, canEditContent, {
        client: tx,
        notFound: 'LIST_NOT_FOUND',
      });
      await lockList(tx, target.id);
      const { position, rebalanced } = await cardPosition(tx, target.id, input.toIndex, cardId);
      const card = await tx.card.update({
        where: { id: cardId },
        data: { listId: target.id, boardId: target.boardId, position, version: { increment: 1 } },
      });
      await tx.activity.create({
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
      return { card, rebalanced };
    });

    await this.publishCards(rebalanced, userId, clientMutationId);
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

  private async requireEditable(userId: string, cardId: string) {
    const card = await this.prisma.card.findUnique({ where: { id: cardId } });
    if (!card) throw AppError.notFound('CARD_NOT_FOUND');
    await this.access.require(userId, card.boardId, canEditContent, { notFound: 'CARD_NOT_FOUND' });
    return card;
  }

  private publishCard(card: Card, actorId: string, clientMutationId: string | null) {
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
    const cards = await this.prisma.card.findMany({ where: { id: { in: ids } } });
    for (const card of cards) this.publishCard(card, actorId, clientMutationId);
  }
}
