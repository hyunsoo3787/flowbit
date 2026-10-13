import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  type AcceptedInvitation,
  type BoardRole,
  DEFAULT_LOCALE,
  INVITATION_EMAIL_DAYS,
  INVITATION_LINK_DAYS,
  type Invitation as InvitationDto,
  type InvitationPreview,
  isLocale,
  type WorkspaceRole,
} from '@flowbit/shared';
import { BoardAccessService } from '../boards/board-access.service.js';
import { canManageBoard } from '../boards/board-policy.js';
import { toUserSummary, USER_SUMMARY_SELECT } from '../boards/mappers.js';
import { AppError } from '../common/app-error.js';
import { ENV, type Env } from '../config/env.js';
import type { Invitation, Prisma, User } from '../generated/prisma/client.js';
import { MailService } from '../mail/mail.service.js';
import { mailTemplates } from '../mail/templates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { canManageWorkspace } from '../workspaces/workspace-policy.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import { MembersService } from './members.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The invitation's target: a workspace, or one board in it. */
type Scope =
  | { kind: 'workspace'; workspaceId: string; name: string }
  | { kind: 'board'; workspaceId: string; boardId: string; name: string };

const INCLUDE = { invitedBy: { select: USER_SUMMARY_SELECT } } as const;

/** Unexpired, unrevoked, and (for email invitations) unused. */
function pendingWhere(now = new Date()) {
  return {
    revokedAt: null,
    acceptedAt: null,
    expiresAt: { gt: now },
  } satisfies Prisma.InvitationWhereInput;
}

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService,
    private readonly access: BoardAccessService,
    private readonly members: MembersService,
    private readonly mail: MailService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // -------------------------------------------------------------------------
  // Creating and managing (scope admins)
  // -------------------------------------------------------------------------

  async workspaceScope(userId: string, workspaceId: string): Promise<Scope> {
    const role = await this.workspaces.getRole(userId, workspaceId);
    if (!role) throw AppError.notFound('WORKSPACE_NOT_FOUND');
    if (!canManageWorkspace(role)) throw AppError.forbidden();
    const workspace = await this.prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    return { kind: 'workspace', workspaceId, name: workspace.name };
  }

  async boardScope(userId: string, boardId: string): Promise<Scope> {
    const { board } = await this.access.require(userId, boardId, canManageBoard);
    return { kind: 'board', workspaceId: board.workspaceId, boardId, name: board.name };
  }

  async list(scope: Scope): Promise<InvitationDto[]> {
    const invitations = await this.prisma.invitation.findMany({
      where: { ...this.scopeWhere(scope), ...pendingWhere() },
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return invitations.map((invitation) => this.toDto(invitation));
  }

  /** Invites people by email. Inviting an address again replaces its pending invitation. */
  async inviteByEmail(
    inviter: { id: string; name: string },
    scope: Scope,
    emails: string[],
    role: WorkspaceRole | BoardRole,
  ): Promise<InvitationDto[]> {
    const unique = [...new Set(emails.map((email) => email.trim().toLowerCase()))];
    const expiresAt = new Date(Date.now() + INVITATION_EMAIL_DAYS * DAY_MS);
    const created = await this.prisma.$transaction(async (tx) => {
      await tx.invitation.updateMany({
        where: { ...this.scopeWhere(scope), email: { in: unique }, ...pendingWhere() },
        data: { revokedAt: new Date() },
      });
      const invitations = [];
      for (const email of unique) {
        invitations.push(
          await tx.invitation.create({
            data: {
              ...this.scopeData(scope, role),
              email,
              token: newToken(),
              invitedById: inviter.id,
              expiresAt,
            },
            include: INCLUDE,
          }),
        );
      }
      return invitations;
    });

    const recipients = await this.prisma.user.findMany({
      where: { email: { in: unique, mode: 'insensitive' } },
      select: { email: true, locale: true },
    });
    const inviterLocale = await this.localeOf(inviter.id);
    for (const invitation of created) {
      const recipient = recipients.find((user) => user.email.toLowerCase() === invitation.email);
      const locale = recipient && isLocale(recipient.locale) ? recipient.locale : inviterLocale;
      await this.mail.send(
        invitation.email!,
        mailTemplates.invitation(
          locale,
          inviter.name,
          scope.name,
          INVITATION_EMAIL_DAYS,
          this.url(invitation.token),
        ),
      );
    }
    return created.map((invitation) => this.toDto(invitation));
  }

  /** Creates the scope's shareable link, replacing the previous one. */
  async createLink(
    inviterId: string,
    scope: Scope,
    role: WorkspaceRole | BoardRole,
  ): Promise<InvitationDto> {
    const expiresAt = new Date(Date.now() + INVITATION_LINK_DAYS * DAY_MS);
    const invitation = await this.prisma.$transaction(async (tx) => {
      await tx.invitation.updateMany({
        where: { ...this.scopeWhere(scope), email: null, ...pendingWhere() },
        data: { revokedAt: new Date() },
      });
      return tx.invitation.create({
        data: {
          ...this.scopeData(scope, role),
          email: null,
          token: newToken(),
          invitedById: inviterId,
          expiresAt,
        },
        include: INCLUDE,
      });
    });
    return this.toDto(invitation);
  }

  async revoke(userId: string, invitationId: string) {
    const invitation = await this.prisma.invitation.findUnique({ where: { id: invitationId } });
    if (!invitation) throw AppError.notFound('INVITATION_NOT_FOUND');
    if (invitation.boardId) await this.boardScope(userId, invitation.boardId);
    else await this.workspaceScope(userId, invitation.workspaceId);
    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { revokedAt: invitation.revokedAt ?? new Date() },
    });
  }

  // -------------------------------------------------------------------------
  // Accepting (the invited person)
  // -------------------------------------------------------------------------

  async preview(token: string): Promise<InvitationPreview> {
    const invitation = await this.findPending(token);
    return {
      kind: invitation.boardId ? 'board' : 'workspace',
      workspaceName: invitation.workspace.name,
      boardName: invitation.board?.name ?? null,
      invitedByName: invitation.invitedBy?.name ?? null,
      email: invitation.email,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  async accept(user: Pick<User, 'id' | 'email'>, token: string): Promise<AcceptedInvitation> {
    const invitation = await this.findPending(token);
    if (invitation.email && invitation.email !== user.email.toLowerCase()) {
      throw new AppError(
        'INVITATION_EMAIL_MISMATCH',
        403,
        'This invitation is for another email address',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (invitation.boardId) {
        await this.members.addBoardMember(
          tx,
          invitation.boardId,
          user.id,
          invitation.boardRole ?? 'MEMBER',
        );
      } else {
        await this.members.addWorkspaceMember(
          tx,
          invitation.workspaceId,
          user.id,
          invitation.workspaceRole ?? 'MEMBER',
        );
      }
      // Email invitations are used once; links stay valid for others.
      if (invitation.email) {
        await tx.invitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date() },
        });
      }
    });

    if (invitation.boardId) {
      await this.members.afterBoardChange(invitation.boardId, user.id, user.id, null);
    } else {
      await this.members.afterWorkspaceChange(invitation.workspaceId, user.id, user.id);
    }
    const workspaceRole = await this.workspaces.getRole(user.id, invitation.workspaceId);
    return {
      workspaceId: workspaceRole ? invitation.workspaceId : null,
      boardId: invitation.boardId,
    };
  }

  /** Whether someone with this email holds a pending email invitation (for closed sign-up). */
  async hasPendingInvitationFor(email: string): Promise<boolean> {
    const count = await this.prisma.invitation.count({
      where: { email: email.toLowerCase(), ...pendingWhere() },
    });
    return count > 0;
  }

  private async findPending(token: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { token, ...pendingWhere() },
      include: {
        ...INCLUDE,
        workspace: { select: { name: true } },
        board: { select: { name: true } },
      },
    });
    if (!invitation) throw AppError.notFound('INVITATION_NOT_FOUND');
    return invitation;
  }

  // -------------------------------------------------------------------------

  private scopeWhere(scope: Scope): Prisma.InvitationWhereInput {
    return scope.kind === 'board'
      ? { boardId: scope.boardId }
      : { workspaceId: scope.workspaceId, boardId: null };
  }

  private scopeData(scope: Scope, role: WorkspaceRole | BoardRole) {
    return scope.kind === 'board'
      ? { workspaceId: scope.workspaceId, boardId: scope.boardId, boardRole: role as BoardRole }
      : { workspaceId: scope.workspaceId, workspaceRole: role as WorkspaceRole };
  }

  private url(token: string) {
    return `${this.env.PUBLIC_URL}/invite/${token}`;
  }

  private async localeOf(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { locale: true },
    });
    return user && isLocale(user.locale) ? user.locale : DEFAULT_LOCALE;
  }

  private toDto(
    invitation: Invitation & { invitedBy: Pick<User, 'id' | 'name' | 'email' | 'image'> | null },
  ): InvitationDto {
    return {
      id: invitation.id,
      workspaceId: invitation.workspaceId,
      boardId: invitation.boardId,
      email: invitation.email,
      role: (invitation.boardId ? invitation.boardRole : invitation.workspaceRole) ?? 'MEMBER',
      url: this.url(invitation.token),
      invitedBy: invitation.invitedBy ? toUserSummary(invitation.invitedBy) : null,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
    };
  }
}

function newToken() {
  return randomBytes(24).toString('base64url');
}
