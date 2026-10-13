import { Injectable } from '@nestjs/common';
import type { BoardRole, ErrorCode } from '@flowbit/shared';
import { AppError } from '../common/app-error.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { effectiveBoardRole } from './board-policy.js';

/** Loads a board together with the caller's memberships, which decide their role. */
export function withBoardMemberships(userId: string) {
  return {
    members: { where: { userId }, select: { role: true } },
    workspace: {
      select: {
        members: { where: { userId }, select: { role: true } },
        organization: { select: { members: { where: { userId }, select: { role: true } } } },
      },
    },
  } satisfies Prisma.BoardInclude;
}

export type BoardWithMemberships = Prisma.BoardGetPayload<{
  include: ReturnType<typeof withBoardMemberships>;
}>;

export function roleOnBoard(board: BoardWithMemberships): BoardRole | null {
  return effectiveBoardRole({
    organizationRole: board.workspace.organization.members[0]?.role ?? null,
    workspaceRole: board.workspace.members[0]?.role ?? null,
    boardRole: board.members[0]?.role ?? null,
    visibility: board.visibility,
  });
}

type Client = Prisma.TransactionClient | PrismaService;

/** Resolves board access. Anything the caller can't see is reported as not found. */
@Injectable()
export class BoardAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getRole(userId: string, boardId: string, client: Client = this.prisma) {
    const board = await client.board.findUnique({
      where: { id: boardId },
      include: withBoardMemberships(userId),
    });
    return board ? roleOnBoard(board) : null;
  }

  /**
   * Returns the board and the caller's role, or throws: `notFound` without
   * access, FORBIDDEN when the role doesn't pass `allowed`.
   */
  async require(
    userId: string,
    boardId: string,
    allowed: (role: BoardRole) => boolean,
    {
      client = this.prisma,
      notFound = 'BOARD_NOT_FOUND',
    }: { client?: Client; notFound?: ErrorCode } = {},
  ) {
    const board = await client.board.findUnique({
      where: { id: boardId },
      include: withBoardMemberships(userId),
    });
    const role = board ? roleOnBoard(board) : null;
    if (!board || !role) throw AppError.notFound(notFound);
    if (!allowed(role)) throw AppError.forbidden();
    return { board, role };
  }
}
