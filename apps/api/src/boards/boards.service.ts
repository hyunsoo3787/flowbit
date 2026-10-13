import { Injectable } from '@nestjs/common';
import {
  type Board as BoardDto,
  type BoardDetail,
  type createBoardSchema,
  DEFAULT_LABEL_COLORS,
  type UpdateBoardInput,
} from '@flowbit/shared';
import type { z } from 'zod';
import { AppError } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import { BoardAccessService, roleOnBoard, withBoardMemberships } from './board-access.service.js';
import { BoardMembersService } from './board-members.service.js';
import { canCreateBoardIn, canManageBoard } from './board-policy.js';
import {
  CARD_INCLUDE,
  toBoardDto,
  toBoardEventDto,
  toCardDto,
  toLabelDto,
  toListDto,
} from './mappers.js';
import { POSITION_ORDER } from './ordering.js';

@Injectable()
export class BoardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
    private readonly boardMembers: BoardMembersService,
    private readonly workspaces: WorkspacesService,
    private readonly realtime: RealtimeService,
  ) {}

  async listForWorkspace(userId: string, workspaceId: string): Promise<BoardDto[]> {
    if (!(await this.workspaces.getRole(userId, workspaceId))) {
      throw AppError.notFound('WORKSPACE_NOT_FOUND');
    }
    const boards = await this.prisma.board.findMany({
      where: { workspaceId },
      include: withBoardMemberships(userId),
      orderBy: { createdAt: 'asc' },
    });
    return boards.flatMap((board) => {
      const role = roleOnBoard(board);
      return role ? [toBoardDto(board, role)] : [];
    });
  }

  /**
   * Boards someone was invited to directly, in workspaces they don't belong
   * to. They have no workspace page to find them on.
   */
  async listShared(userId: string): Promise<BoardDto[]> {
    const boards = await this.prisma.board.findMany({
      where: {
        members: { some: { userId } },
        workspace: {
          members: { none: { userId } },
          organization: { members: { none: { userId, role: { in: ['OWNER', 'ADMIN'] } } } },
        },
      },
      include: withBoardMemberships(userId),
      orderBy: { createdAt: 'asc' },
    });
    return boards.flatMap((board) => {
      const role = roleOnBoard(board);
      return role ? [toBoardDto(board, role)] : [];
    });
  }

  async create(
    userId: string,
    workspaceId: string,
    input: z.output<typeof createBoardSchema>,
  ): Promise<BoardDto> {
    const workspaceRole = await this.workspaces.getRole(userId, workspaceId);
    if (!workspaceRole) throw AppError.notFound('WORKSPACE_NOT_FOUND');
    if (!canCreateBoardIn(workspaceRole)) throw AppError.forbidden();

    const { name, visibility } = input;
    const background = input.background.toLowerCase();
    const board = await this.prisma.$transaction(async (tx) => {
      const created = await tx.board.create({
        data: {
          workspaceId,
          name,
          visibility,
          background,
          createdById: userId,
          members: { create: { userId, role: 'ADMIN' } },
        },
      });
      // Distinct timestamps keep the default labels in palette order.
      const now = Date.now();
      await tx.label.createMany({
        data: DEFAULT_LABEL_COLORS.map((color, i) => ({
          boardId: created.id,
          color,
          createdAt: new Date(now + i),
        })),
      });
      await tx.activity.create({
        data: { boardId: created.id, actorId: userId, type: 'board.created', payload: { name } },
      });
      return created;
    });
    return toBoardDto(board, 'ADMIN');
  }

  async getDetail(userId: string, boardId: string): Promise<BoardDetail> {
    const { board, role } = await this.access.require(userId, boardId, () => true);
    const [lists, cards, labels, members, watches] = await Promise.all([
      this.prisma.list.findMany({ where: { boardId }, orderBy: [...POSITION_ORDER] }),
      this.prisma.card.findMany({
        where: { boardId },
        orderBy: [...POSITION_ORDER],
        include: CARD_INCLUDE,
      }),
      this.prisma.label.findMany({
        where: { boardId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      this.boardMembers.list(boardId),
      this.prisma.watch.findMany({
        where: { userId, OR: [{ boardId }, { card: { boardId } }] },
        select: { boardId: true, cardId: true },
      }),
    ]);
    return {
      ...toBoardDto(board, role),
      lists: lists.map(toListDto),
      cards: cards.map(toCardDto),
      labels: labels.map(toLabelDto),
      members,
      watching: watches.some((watch) => watch.boardId === boardId),
      watchedCardIds: watches.flatMap((watch) => (watch.cardId ? [watch.cardId] : [])),
    };
  }

  async update(
    userId: string,
    boardId: string,
    input: UpdateBoardInput,
    clientMutationId: string | null,
  ): Promise<BoardDto> {
    const { board: before, role } = await this.access.require(userId, boardId, canManageBoard);
    const board = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.board.update({
        where: { id: boardId },
        data: {
          ...input,
          ...(input.background ? { background: input.background.toLowerCase() } : {}),
          version: { increment: 1 },
        },
      });
      await tx.activity.create({
        data: {
          boardId,
          actorId: userId,
          type: 'board.updated',
          payload: { fields: Object.keys(input) },
        },
      });
      return updated;
    });

    this.realtime.publish({
      type: 'board.updated',
      boardId,
      actorId: userId,
      clientMutationId,
      board: toBoardEventDto(board),
    });
    if (input.visibility && input.visibility !== before.visibility) {
      await this.realtime.evict(boardId, async (viewerId) =>
        Boolean(await this.access.getRole(viewerId, boardId)),
      );
      this.realtime.publish({
        type: 'members.updated',
        boardId,
        actorId: userId,
        clientMutationId,
        members: await this.boardMembers.list(boardId),
      });
    }
    return toBoardDto(board, role);
  }

  async remove(userId: string, boardId: string, clientMutationId: string | null): Promise<void> {
    await this.access.require(userId, boardId, canManageBoard);
    await this.prisma.board.delete({ where: { id: boardId } });
    this.realtime.publish({ type: 'board.deleted', boardId, actorId: userId, clientMutationId });
    this.realtime.closeRoom(boardId);
  }
}
