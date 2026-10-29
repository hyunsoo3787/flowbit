import { Injectable } from '@nestjs/common';
import type { BoardMember, BoardRole } from '@flowbit/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { effectiveBoardRole } from './board-policy.js';
import { toUserSummary, USER_SUMMARY_SELECT } from './mappers.js';

type Client = Prisma.TransactionClient | PrismaService;

/** Everyone with access to a board, and their effective roles. */
@Injectable()
export class BoardMembersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(boardId: string, client: Client = this.prisma): Promise<BoardMember[]> {
    const board = await client.board.findUnique({
      where: { id: boardId },
      select: {
        visibility: true,
        members: { select: { role: true, user: { select: USER_SUMMARY_SELECT } } },
        workspace: {
          select: {
            members: { select: { role: true, user: { select: USER_SUMMARY_SELECT } } },
            organization: {
              select: {
                members: {
                  where: { role: { in: ['OWNER', 'ADMIN'] } },
                  select: { role: true, user: { select: USER_SUMMARY_SELECT } },
                },
              },
            },
          },
        },
      },
    });
    if (!board) return [];

    type Entry = {
      user: Prisma.UserGetPayload<{ select: typeof USER_SUMMARY_SELECT }>;
      organizationRole: 'OWNER' | 'ADMIN' | 'MEMBER' | null;
      workspaceRole: 'ADMIN' | 'MEMBER' | 'VIEWER' | null;
      boardRole: BoardRole | null;
    };
    const people = new Map<string, Entry>();
    const entry = (user: Entry['user']) => {
      let found = people.get(user.id);
      if (!found) {
        found = { user, organizationRole: null, workspaceRole: null, boardRole: null };
        people.set(user.id, found);
      }
      return found;
    };
    for (const member of board.workspace.organization.members) {
      entry(member.user).organizationRole = member.role;
    }
    for (const member of board.workspace.members) entry(member.user).workspaceRole = member.role;
    for (const member of board.members) entry(member.user).boardRole = member.role;

    const members: BoardMember[] = [];
    for (const person of people.values()) {
      const role = effectiveBoardRole({ ...person, visibility: board.visibility });
      if (role) {
        members.push({ user: toUserSummary(person.user), role, boardRole: person.boardRole });
      }
    }
    return members.sort(
      (a, b) => a.user.name.localeCompare(b.user.name) || (a.user.id < b.user.id ? -1 : 1),
    );
  }

  async roleOf(boardId: string, userId: string, client: Client = this.prisma) {
    const members = await this.list(boardId, client);
    return members.find((member) => member.user.id === userId)?.role ?? null;
  }
}
