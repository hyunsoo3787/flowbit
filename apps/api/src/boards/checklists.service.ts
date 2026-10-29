import { Injectable } from '@nestjs/common';
import type {
  Checklist as ChecklistDto,
  ChecklistItem as ChecklistItemDto,
  CreateChecklistInput,
  CreateChecklistItemInput,
  MoveChecklistItemInput,
  UpdateChecklistInput,
  UpdateChecklistItemInput,
} from '@flowbit/shared';
import { AppError } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { BoardMembersService } from './board-members.service.js';
import {
  CHECKLIST_INCLUDE,
  refreshCardCounters,
  toChecklistDto,
  toChecklistItemDto,
} from './card-content.js';
import { CardsService } from './cards.service.js';
import { checklistItemPosition, checklistPosition, lockCard, POSITION_ORDER } from './ordering.js';

const END = Number.MAX_SAFE_INTEGER;

@Injectable()
export class ChecklistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cards: CardsService,
    private readonly boardMembers: BoardMembersService,
    private readonly realtime: RealtimeService,
  ) {}

  async list(userId: string, cardId: string): Promise<ChecklistDto[]> {
    await this.cards.requireCard(userId, cardId, () => true);
    const checklists = await this.prisma.checklist.findMany({
      where: { cardId },
      orderBy: [...POSITION_ORDER],
      include: CHECKLIST_INCLUDE,
    });
    return checklists.map(toChecklistDto);
  }

  async create(
    userId: string,
    cardId: string,
    input: CreateChecklistInput,
    clientMutationId: string | null,
  ): Promise<ChecklistDto> {
    const card = await this.cards.requireEditable(userId, cardId);
    const checklist = await this.prisma.$transaction(async (tx) => {
      await lockCard(tx, cardId);
      const { position } = await checklistPosition(tx, cardId, END);
      const created = await tx.checklist.create({
        data: { cardId, title: input.title, position },
        include: CHECKLIST_INCLUDE,
      });
      await tx.activity.create({
        data: {
          boardId: card.boardId,
          cardId,
          actorId: userId,
          type: 'checklist.created',
          payload: { checklistId: created.id, title: created.title },
        },
      });
      return created;
    });
    this.publish(card, userId, clientMutationId, false);
    return toChecklistDto(checklist);
  }

  async update(
    userId: string,
    checklistId: string,
    input: UpdateChecklistInput,
    clientMutationId: string | null,
  ): Promise<ChecklistDto> {
    const { card } = await this.requireChecklist(userId, checklistId);
    const checklist = await this.prisma.checklist.update({
      where: { id: checklistId },
      data: { title: input.title },
      include: CHECKLIST_INCLUDE,
    });
    this.publish(card, userId, clientMutationId, false);
    return toChecklistDto(checklist);
  }

  async remove(userId: string, checklistId: string, clientMutationId: string | null) {
    const { card, checklist } = await this.requireChecklist(userId, checklistId);
    await this.prisma.$transaction(async (tx) => {
      await lockCard(tx, card.id);
      await tx.checklist.delete({ where: { id: checklistId } });
      await refreshCardCounters(tx, card.id);
      await tx.activity.create({
        data: {
          boardId: card.boardId,
          cardId: card.id,
          actorId: userId,
          type: 'checklist.deleted',
          payload: { checklistId, title: checklist.title },
        },
      });
    });
    this.publish(card, userId, clientMutationId, true);
  }

  async createItem(
    userId: string,
    checklistId: string,
    input: CreateChecklistItemInput,
    clientMutationId: string | null,
  ): Promise<ChecklistItemDto> {
    const { card } = await this.requireChecklist(userId, checklistId);
    const item = await this.prisma.$transaction(async (tx) => {
      await lockCard(tx, card.id);
      const { position } = await checklistItemPosition(tx, checklistId, END);
      const created = await tx.checklistItem.create({
        data: { checklistId, text: input.text, position },
      });
      await refreshCardCounters(tx, card.id);
      return created;
    });
    this.publish(card, userId, clientMutationId, true);
    return toChecklistItemDto(item);
  }

  async updateItem(
    userId: string,
    itemId: string,
    input: UpdateChecklistItemInput,
    clientMutationId: string | null,
  ): Promise<ChecklistItemDto> {
    const { card, item: existing } = await this.requireItem(userId, itemId);
    if (input.assigneeId && !(await this.boardMembers.roleOf(card.boardId, input.assigneeId))) {
      throw AppError.notFound('MEMBER_NOT_FOUND');
    }
    const { completed, dueAt, ...fields } = input;
    const completionChanged =
      completed !== undefined && completed !== (existing.completedAt !== null);

    const item = await this.prisma.$transaction(async (tx) => {
      await lockCard(tx, card.id);
      const updated = await tx.checklistItem.update({
        where: { id: itemId },
        data: {
          ...fields,
          ...(dueAt === undefined ? {} : { dueAt: dueAt ? new Date(dueAt) : null }),
          ...(completionChanged ? { completedAt: completed ? new Date() : null } : {}),
        },
      });
      if (completionChanged) {
        await refreshCardCounters(tx, card.id);
        await tx.activity.create({
          data: {
            boardId: card.boardId,
            cardId: card.id,
            actorId: userId,
            type: completed ? 'checklist.item.completed' : 'checklist.item.reopened',
            payload: { itemId, text: updated.text },
          },
        });
      }
      return updated;
    });
    this.publish(card, userId, clientMutationId, completionChanged);
    return toChecklistItemDto(item);
  }

  async moveItem(
    userId: string,
    itemId: string,
    input: MoveChecklistItemInput,
    clientMutationId: string | null,
  ): Promise<ChecklistItemDto> {
    const { card, item: existing } = await this.requireItem(userId, itemId);
    const toChecklistId = input.toChecklistId ?? existing.checklistId;
    if (toChecklistId !== existing.checklistId) {
      const target = await this.prisma.checklist.findUnique({ where: { id: toChecklistId } });
      if (!target || target.cardId !== card.id) throw AppError.notFound('CHECKLIST_NOT_FOUND');
    }
    const item = await this.prisma.$transaction(async (tx) => {
      await lockCard(tx, card.id);
      const { position } = await checklistItemPosition(tx, toChecklistId, input.toIndex, itemId);
      return tx.checklistItem.update({
        where: { id: itemId },
        data: { checklistId: toChecklistId, position },
      });
    });
    this.publish(card, userId, clientMutationId, false);
    return toChecklistItemDto(item);
  }

  async removeItem(userId: string, itemId: string, clientMutationId: string | null) {
    const { card } = await this.requireItem(userId, itemId);
    await this.prisma.$transaction(async (tx) => {
      await lockCard(tx, card.id);
      await tx.checklistItem.delete({ where: { id: itemId } });
      await refreshCardCounters(tx, card.id);
    });
    this.publish(card, userId, clientMutationId, true);
  }

  private async requireChecklist(userId: string, checklistId: string) {
    const checklist = await this.prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!checklist) throw AppError.notFound('CHECKLIST_NOT_FOUND');
    const card = await this.cards
      .requireEditable(userId, checklist.cardId)
      .catch((error: unknown) => rethrowAs(error, 'CHECKLIST_NOT_FOUND'));
    return { card, checklist };
  }

  private async requireItem(userId: string, itemId: string) {
    const item = await this.prisma.checklistItem.findUnique({
      where: { id: itemId },
      include: { checklist: { select: { cardId: true } } },
    });
    if (!item) throw AppError.notFound('CHECKLIST_ITEM_NOT_FOUND');
    const card = await this.cards
      .requireEditable(userId, item.checklist.cardId)
      .catch((error: unknown) => rethrowAs(error, 'CHECKLIST_ITEM_NOT_FOUND'));
    return { card, item };
  }

  /** Tells viewers to refetch the card's checklists, and broadcasts new counts. */
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
      part: 'checklists',
    });
    // Counts aren't applied optimistically, so the caller's tab needs this too:
    // no mutation id, or it would be ignored as an echo.
    if (countsChanged) void this.cards.republish(card.id, actorId, null);
  }
}

/** A missing card means the checklist (item) is gone or invisible to the caller. */
function rethrowAs(
  error: unknown,
  code: 'CHECKLIST_NOT_FOUND' | 'CHECKLIST_ITEM_NOT_FOUND',
): never {
  if (error instanceof AppError && error.code === 'CARD_NOT_FOUND') throw AppError.notFound(code);
  throw error;
}
