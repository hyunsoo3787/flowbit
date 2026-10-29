import { Injectable } from '@nestjs/common';
import type {
  BoardMember,
  BoardRole,
  WorkspaceMember as WorkspaceMemberDto,
  WorkspaceRole,
} from '@flowbit/shared';
import { BoardAccessService } from '../boards/board-access.service.js';
import { BoardMembersService } from '../boards/board-members.service.js';
import { canManageBoard } from '../boards/board-policy.js';
import { CARD_INCLUDE, toCardDto, toUserSummary, USER_SUMMARY_SELECT } from '../boards/mappers.js';
import { AppError } from '../common/app-error.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { canManageWorkspace } from '../workspaces/workspace-policy.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';

const RANK = { VIEWER: 1, OBSERVER: 1, MEMBER: 2, ADMIN: 3 } as const;

/** The higher of two roles, for memberships that are granted again. */
export function higherRole<T extends WorkspaceRole | BoardRole>(current: T | null, next: T): T {
  return current && RANK[current] >= RANK[next] ? current : next;
}

/** Workspace and board memberships: who is in, with which role. */
@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService,
    private readonly access: BoardAccessService,
    private readonly boardMembers: BoardMembersService,
    private readonly realtime: RealtimeService,
  ) {}

  // -------------------------------------------------------------------------
  // Workspaces
  // -------------------------------------------------------------------------

  async listWorkspaceMembers(userId: string, workspaceId: string): Promise<WorkspaceMemberDto[]> {
    if (!(await this.workspaces.getRole(userId, workspaceId))) {
      throw AppError.notFound('WORKSPACE_NOT_FOUND');
    }
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: USER_SUMMARY_SELECT } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return members.map((member) => ({
      user: toUserSummary(member.user),
      role: member.role,
      joinedAt: member.createdAt.toISOString(),
    }));
  }

  async updateWorkspaceMember(
    userId: string,
    workspaceId: string,
    memberId: string,
    role: WorkspaceRole,
  ): Promise<WorkspaceMemberDto> {
    await this.requireWorkspaceAdmin(userId, workspaceId);
    const member = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: memberId } },
      });
      if (!existing) throw AppError.notFound('MEMBER_NOT_FOUND');
      const updated = await tx.workspaceMember.update({
        where: { id: existing.id },
        data: { role },
        include: { user: { select: USER_SUMMARY_SELECT } },
      });
      await this.ensureWorkspaceAdmin(tx, workspaceId);
      return updated;
    });
    await this.afterWorkspaceChange(workspaceId, userId, memberId);
    return {
      user: toUserSummary(member.user),
      role: member.role,
      joinedAt: member.createdAt.toISOString(),
    };
  }

  /** Admins remove anyone; everyone may leave. Leaving also drops the workspace's boards. */
  async removeWorkspaceMember(userId: string, workspaceId: string, memberId: string) {
    const role = await this.workspaces.getRole(userId, workspaceId);
    if (!role) throw AppError.notFound('WORKSPACE_NOT_FOUND');
    if (memberId !== userId && !canManageWorkspace(role)) throw AppError.forbidden();
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.workspaceMember.deleteMany({
        where: { workspaceId, userId: memberId },
      });
      if (count === 0) throw AppError.notFound('MEMBER_NOT_FOUND');
      await tx.boardMember.deleteMany({ where: { userId: memberId, board: { workspaceId } } });
      await this.ensureWorkspaceAdmin(tx, workspaceId);
    });
    await this.afterWorkspaceChange(workspaceId, userId, memberId);
  }

  /** Adds someone to a workspace, keeping a higher role they already have. */
  async addWorkspaceMember(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    memberId: string,
    role: WorkspaceRole,
  ) {
    const existing = await tx.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: memberId } },
    });
    if (existing) {
      await tx.workspaceMember.update({
        where: { id: existing.id },
        data: { role: higherRole(existing.role, role) },
      });
    } else {
      await tx.workspaceMember.create({ data: { workspaceId, userId: memberId, role } });
    }
  }

  // -------------------------------------------------------------------------
  // Boards
  // -------------------------------------------------------------------------

  async listBoardMembers(userId: string, boardId: string): Promise<BoardMember[]> {
    await this.access.require(userId, boardId, () => true);
    return this.boardMembers.list(boardId);
  }

  /**
   * Gives someone an explicit role on a board. They must already belong to
   * the workspace or the board; everyone else is invited.
   */
  async setBoardMember(
    userId: string,
    boardId: string,
    memberId: string,
    role: BoardRole,
    clientMutationId: string | null,
  ): Promise<BoardMember[]> {
    const { board } = await this.access.require(userId, boardId, canManageBoard);
    await this.prisma.$transaction(async (tx) => {
      const [workspaceMember, boardMember] = await Promise.all([
        tx.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId: board.workspaceId, userId: memberId } },
        }),
        tx.boardMember.findUnique({ where: { boardId_userId: { boardId, userId: memberId } } }),
      ]);
      if (!workspaceMember && !boardMember) throw AppError.notFound('MEMBER_NOT_FOUND');
      await tx.boardMember.upsert({
        where: { boardId_userId: { boardId, userId: memberId } },
        create: { boardId, userId: memberId, role },
        update: { role },
      });
      await this.ensureBoardAdmin(tx, boardId);
    });
    return this.afterBoardChange(boardId, userId, memberId, clientMutationId);
  }

  /** Admins remove anyone's explicit membership; everyone may leave. */
  async removeBoardMember(
    userId: string,
    boardId: string,
    memberId: string,
    clientMutationId: string | null,
  ): Promise<BoardMember[]> {
    const { role } = await this.access.require(userId, boardId, () => true);
    if (memberId !== userId && !canManageBoard(role)) throw AppError.forbidden();
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.boardMember.deleteMany({ where: { boardId, userId: memberId } });
      if (count === 0) throw AppError.notFound('MEMBER_NOT_FOUND');
      await this.ensureBoardAdmin(tx, boardId);
    });
    return this.afterBoardChange(boardId, userId, memberId, clientMutationId);
  }

  async addBoardMember(
    tx: Prisma.TransactionClient,
    boardId: string,
    memberId: string,
    role: BoardRole,
  ) {
    const existing = await tx.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId: memberId } },
    });
    await tx.boardMember.upsert({
      where: { boardId_userId: { boardId, userId: memberId } },
      create: { boardId, userId: memberId, role },
      update: { role: higherRole(existing?.role ?? null, role) },
    });
  }

  // -------------------------------------------------------------------------
  // After membership changes
  // -------------------------------------------------------------------------

  /** Tells viewers of every board in the workspace who now has access. */
  async afterWorkspaceChange(workspaceId: string, actorId: string, changedUserId: string) {
    const boards = await this.prisma.board.findMany({
      where: { workspaceId },
      select: { id: true },
    });
    for (const board of boards) await this.afterBoardChange(board.id, actorId, changedUserId, null);
  }

  /**
   * Broadcasts the board's new member list, unassigns someone who lost access
   * from its cards, and removes their open connections from the board's room.
   */
  async afterBoardChange(
    boardId: string,
    actorId: string,
    changedUserId: string,
    clientMutationId: string | null,
  ): Promise<BoardMember[]> {
    const members = await this.boardMembers.list(boardId);
    if (!members.some((member) => member.user.id === changedUserId)) {
      const assignments = await this.prisma.cardAssignee.findMany({
        where: { userId: changedUserId, card: { boardId } },
        select: { cardId: true },
      });
      if (assignments.length > 0) {
        await this.prisma.$transaction([
          this.prisma.cardAssignee.deleteMany({
            where: { userId: changedUserId, card: { boardId } },
          }),
          this.prisma.card.updateMany({
            where: { id: { in: assignments.map((a) => a.cardId) } },
            data: { version: { increment: 1 } },
          }),
        ]);
        const cards = await this.prisma.card.findMany({
          where: { id: { in: assignments.map((a) => a.cardId) } },
          include: CARD_INCLUDE,
        });
        for (const card of cards) {
          this.realtime.publish({
            type: 'card.upserted',
            boardId,
            actorId,
            clientMutationId,
            card: toCardDto(card),
          });
        }
      }
      await this.realtime.evict(boardId, async (viewerId) =>
        Boolean(await this.access.getRole(viewerId, boardId)),
      );
    }
    this.realtime.publish({ type: 'members.updated', boardId, actorId, clientMutationId, members });
    return members;
  }

  private async requireWorkspaceAdmin(userId: string, workspaceId: string) {
    const role = await this.workspaces.getRole(userId, workspaceId);
    if (!role) throw AppError.notFound('WORKSPACE_NOT_FOUND');
    if (!canManageWorkspace(role)) throw AppError.forbidden();
  }

  /** A workspace keeps at least one admin member, so it can always be managed. */
  private async ensureWorkspaceAdmin(tx: Prisma.TransactionClient, workspaceId: string) {
    const admins = await tx.workspaceMember.count({ where: { workspaceId, role: 'ADMIN' } });
    if (admins === 0) throw AppError.conflict('LAST_ADMIN');
  }

  /** A board keeps at least one person with the effective admin role. */
  private async ensureBoardAdmin(tx: Prisma.TransactionClient, boardId: string) {
    const members = await this.boardMembers.list(boardId, tx);
    if (!members.some((member) => member.role === 'ADMIN')) throw AppError.conflict('LAST_ADMIN');
  }
}
