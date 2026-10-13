import { Injectable } from '@nestjs/common';
import type {
  Board as BoardDto,
  BoardDetail,
  createBoardSchema,
  UpdateBoardInput,
} from '@flowbit/shared';
import type { z } from 'zod';
import { AppError } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import { BoardAccessService, roleOnBoard, withBoardMemberships } from './board-access.service.js';
import { canCreateBoardIn, canManageBoard } from './board-policy.js';
import { toBoardDto, toBoardEventDto, toCardDto, toListDto } from './mappers.js';
import { POSITION_ORDER } from './ordering.js';

@Injectable()
export class BoardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
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
      await tx.activity.create({
        data: { boardId: created.id, actorId: userId, type: 'board.created', payload: { name } },
      });
      return created;
    });
    return toBoardDto(board, 'ADMIN');
  }

  async getDetail(userId: string, boardId: string): Promise<BoardDetail> {
    const { board, role } = await this.access.require(userId, boardId, () => true);
    const [lists, cards] = await Promise.all([
      this.prisma.list.findMany({ where: { boardId }, orderBy: [...POSITION_ORDER] }),
      this.prisma.card.findMany({ where: { boardId }, orderBy: [...POSITION_ORDER] }),
    ]);
    return { ...toBoardDto(board, role), lists: lists.map(toListDto), cards: cards.map(toCardDto) };
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
