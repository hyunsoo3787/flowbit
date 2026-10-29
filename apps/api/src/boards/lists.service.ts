import { Injectable } from '@nestjs/common';
import type {
  CreateListInput,
  List as ListDto,
  MoveListInput,
  UpdateListInput,
} from '@flowbit/shared';
import { AppError } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { BoardAccessService } from './board-access.service.js';
import { canEditContent } from './board-policy.js';
import { CARD_INCLUDE, toCardDto, toListDto } from './mappers.js';
import { dropForeignLabels, listPosition, lockBoard } from './ordering.js';

const END = Number.MAX_SAFE_INTEGER;

@Injectable()
export class ListsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
    private readonly realtime: RealtimeService,
  ) {}

  async create(
    userId: string,
    boardId: string,
    input: CreateListInput,
    clientMutationId: string | null,
  ): Promise<ListDto> {
    const { list, rebalanced } = await this.prisma.$transaction(async (tx) => {
      await this.access.require(userId, boardId, canEditContent, { client: tx });
      await lockBoard(tx, boardId);
      const { position, rebalanced } = await listPosition(tx, boardId, input.toIndex ?? END);
      const list = await tx.list.create({ data: { boardId, name: input.name, position } });
      await tx.activity.create({
        data: {
          boardId,
          actorId: userId,
          type: 'list.created',
          payload: { listId: list.id, name: list.name },
        },
      });
      return { list, rebalanced };
    });
    await this.publishLists(rebalanced, userId, clientMutationId);
    this.publishList(list, userId, clientMutationId);
    return toListDto(list);
  }

  async update(
    userId: string,
    listId: string,
    input: UpdateListInput,
    clientMutationId: string | null,
  ): Promise<ListDto> {
    const existing = await this.requireEditable(userId, listId);
    const list = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.list.update({
        where: { id: listId },
        data: { name: input.name, version: { increment: 1 } },
      });
      await tx.activity.create({
        data: {
          boardId: existing.boardId,
          actorId: userId,
          type: 'list.updated',
          payload: { listId, name: input.name },
        },
      });
      return updated;
    });
    this.publishList(list, userId, clientMutationId);
    return toListDto(list);
  }

  async move(
    userId: string,
    listId: string,
    input: MoveListInput,
    clientMutationId: string | null,
  ): Promise<ListDto> {
    const existing = await this.requireEditable(userId, listId);
    const fromBoardId = existing.boardId;
    const toBoardId = input.toBoardId ?? fromBoardId;
    const crossBoard = toBoardId !== fromBoardId;

    const { list, rebalanced } = await this.prisma.$transaction(async (tx) => {
      await this.access.require(userId, toBoardId, canEditContent, { client: tx });
      await lockBoard(tx, toBoardId);
      const { position, rebalanced } = await listPosition(tx, toBoardId, input.toIndex, listId);
      const list = await tx.list.update({
        where: { id: listId },
        data: { boardId: toBoardId, position, version: { increment: 1 } },
      });
      if (crossBoard) {
        const cardIds = await tx.card.findMany({ where: { listId }, select: { id: true } });
        await dropForeignLabels(
          tx,
          cardIds.map((card) => card.id),
          toBoardId,
        );
        await tx.card.updateMany({
          where: { listId },
          data: { boardId: toBoardId, version: { increment: 1 } },
        });
      }
      await tx.activity.create({
        data: {
          boardId: toBoardId,
          actorId: userId,
          type: 'list.moved',
          payload: { listId, fromBoardId, toBoardId },
        },
      });
      return { list, rebalanced };
    });

    await this.publishLists(rebalanced, userId, clientMutationId);
    if (crossBoard) {
      this.realtime.publish({
        type: 'list.deleted',
        boardId: fromBoardId,
        actorId: userId,
        clientMutationId,
        listId,
      });
      this.publishList(list, userId, clientMutationId);
      const cards = await this.prisma.card.findMany({ where: { listId }, include: CARD_INCLUDE });
      for (const card of cards) {
        this.realtime.publish({
          type: 'card.upserted',
          boardId: toBoardId,
          actorId: userId,
          clientMutationId,
          card: toCardDto(card),
        });
      }
    } else {
      this.publishList(list, userId, clientMutationId);
    }
    return toListDto(list);
  }

  async remove(userId: string, listId: string, clientMutationId: string | null): Promise<void> {
    const existing = await this.requireEditable(userId, listId);
    await this.prisma.$transaction(async (tx) => {
      await tx.activity.create({
        data: {
          boardId: existing.boardId,
          actorId: userId,
          type: 'list.deleted',
          payload: { listId, name: existing.name },
        },
      });
      await tx.list.delete({ where: { id: listId } });
    });
    this.realtime.publish({
      type: 'list.deleted',
      boardId: existing.boardId,
      actorId: userId,
      clientMutationId,
      listId,
    });
  }

  private async requireEditable(userId: string, listId: string) {
    const list = await this.prisma.list.findUnique({ where: { id: listId } });
    if (!list) throw AppError.notFound('LIST_NOT_FOUND');
    await this.access.require(userId, list.boardId, canEditContent, { notFound: 'LIST_NOT_FOUND' });
    return list;
  }

  private publishList(
    list: Parameters<typeof toListDto>[0],
    actorId: string,
    clientMutationId: string | null,
  ) {
    this.realtime.publish({
      type: 'list.upserted',
      boardId: list.boardId,
      actorId,
      clientMutationId,
      list: toListDto(list),
    });
  }

  private async publishLists(ids: string[], actorId: string, clientMutationId: string | null) {
    if (ids.length === 0) return;
    const lists = await this.prisma.list.findMany({ where: { id: { in: ids } } });
    for (const list of lists) this.publishList(list, actorId, clientMutationId);
  }
}
