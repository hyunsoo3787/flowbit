import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  type AdminAction as AdminActionDto,
  type AdminActionPage,
  type AdminActionType,
  type AdminUser,
  type AdminUserPage,
  ADMIN_ACTION_TYPES,
  DEFAULT_LOCALE,
  type InstanceSettings,
  type InstanceStats,
  isLocale,
  type PasswordResetLink,
  type UpdateInstanceSettingsInput,
} from '@flowbit/shared';
import { AUTH } from '../auth/auth.constants.js';
import type { Auth } from '../auth/create-auth.js';
import { AppError } from '../common/app-error.js';
import { ENV, type Env } from '../config/env.js';
import type { Prisma } from '../generated/prisma/client.js';
import { MailService } from '../mail/mail.service.js';
import { mailTemplates } from '../mail/templates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { isAdminFromConfig, isInstanceAdmin } from './admin-policy.js';
import { InstanceSettingsService } from './instance-settings.service.js';

const PAGE_SIZE = 50;
const RESET_LINK_SECONDS = 60 * 60;

const USER_INCLUDE = {
  accounts: { select: { providerId: true } },
  sessions: { select: { updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 1 },
  _count: { select: { organizationMemberships: true, workspaceMemberships: true } },
} satisfies Prisma.UserInclude;

type UserRow = Prisma.UserGetPayload<{ include: typeof USER_INCLUDE }>;

/** Instance administration (D-021): accounts and server settings, never content. */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: InstanceSettingsService,
    private readonly mail: MailService,
    @Inject(AUTH) private readonly auth: Auth,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Throws unless the caller is an instance administrator. */
  async requireAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !isInstanceAdmin(user, this.env)) throw AppError.forbidden();
    return user;
  }

  async stats(): Promise<InstanceStats> {
    const [users, suspendedUsers, organizations, workspaces, boards, cards] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { suspendedAt: { not: null } } }),
      this.prisma.organization.count(),
      this.prisma.workspace.count(),
      this.prisma.board.count(),
      this.prisma.card.count(),
    ]);
    return {
      users,
      suspendedUsers,
      admins: await this.countAdmins(),
      organizations,
      workspaces,
      boards,
      cards,
    };
  }

  /** Accounts by sign-up date, newest first; `query` matches name or email. */
  async listUsers(query: string | undefined, cursor: string | undefined): Promise<AdminUserPage> {
    const search = query?.trim();
    const users = await this.prisma.user.findMany({
      where: {
        ...(search
          ? {
              OR: [
                { email: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      orderBy: { id: 'desc' },
      take: PAGE_SIZE + 1,
      include: USER_INCLUDE,
    });
    const page = users.slice(0, PAGE_SIZE);
    return {
      items: page.map((user) => this.toAdminUser(user)),
      nextCursor: users.length > PAGE_SIZE ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async suspend(actorId: string, userId: string): Promise<AdminUser> {
    if (actorId === userId) throw AppError.badRequest('BAD_REQUEST', "You can't suspend yourself");
    const user = await this.prisma.$transaction(async (tx) => {
      const target = await this.findUser(tx, userId);
      if (target.suspendedAt) return target;
      await this.keepAnAdmin(tx, target.id);
      const updated = await tx.user.update({
        where: { id: userId },
        data: { suspendedAt: new Date() },
        include: USER_INCLUDE,
      });
      await tx.session.deleteMany({ where: { userId } });
      await this.log(tx, actorId, userId, 'user.suspended');
      return updated;
    });
    return this.toAdminUser(user);
  }

  async reactivate(actorId: string, userId: string): Promise<AdminUser> {
    const user = await this.prisma.$transaction(async (tx) => {
      const target = await this.findUser(tx, userId);
      if (!target.suspendedAt) return target;
      const updated = await tx.user.update({
        where: { id: userId },
        data: { suspendedAt: null },
        include: USER_INCLUDE,
      });
      await this.log(tx, actorId, userId, 'user.reactivated');
      return updated;
    });
    return this.toAdminUser(user);
  }

  /**
   * Deletes an account. Workspaces in its personal organization that others
   * still use are handed over to one of their admins instead of being deleted.
   */
  async deleteUser(actorId: string, userId: string) {
    if (actorId === userId) throw AppError.badRequest('BAD_REQUEST', "You can't delete yourself");
    await this.prisma.$transaction(async (tx) => {
      const target = await this.findUser(tx, userId);
      await this.keepAnAdmin(tx, target.id);
      await this.log(tx, actorId, userId, 'user.deleted', {
        email: target.email,
        name: target.name,
      });
      await this.handOverSharedWorkspaces(tx, userId);
      await tx.user.delete({ where: { id: userId } });
    });
  }

  /**
   * Creates a one-time password reset link to give to the user directly, for
   * servers without email (D-021). The administrator never sees the password.
   */
  async passwordResetLink(actorId: string, userId: string): Promise<PasswordResetLink> {
    const target = await this.findUser(this.prisma, userId);
    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + RESET_LINK_SECONDS * 1000);
    const context = await this.auth.$context;
    await context.internalAdapter.createVerificationValue({
      identifier: `reset-password:${token}`,
      value: target.id,
      expiresAt,
    });
    await this.log(this.prisma, actorId, userId, 'user.password_reset_link');
    if (this.mail.configured) {
      const locale = isLocale(target.locale) ? target.locale : DEFAULT_LOCALE;
      await this.mail.send(target.email, mailTemplates.passwordResetIssued(locale, target.name));
    }
    return {
      url: `${this.env.PUBLIC_URL}/reset-password?token=${encodeURIComponent(token)}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async setAdmin(actorId: string | null, userId: string, admin: boolean): Promise<AdminUser> {
    const user = await this.prisma.$transaction(async (tx) => {
      const target = await this.findUser(tx, userId);
      if (target.isAdmin === admin) return target;
      if (!admin) await this.keepAnAdmin(tx, target.id);
      const updated = await tx.user.update({
        where: { id: userId },
        data: { isAdmin: admin },
        include: USER_INCLUDE,
      });
      await this.log(tx, actorId, userId, admin ? 'admin.granted' : 'admin.revoked');
      return updated;
    });
    return this.toAdminUser(user);
  }

  async getSettings(): Promise<InstanceSettings> {
    return {
      signUpEnabled: await this.settings.signUpEnabled(),
      mailConfigured: this.mail.configured,
    };
  }

  async updateSettings(actorId: string, input: UpdateInstanceSettingsInput) {
    if (input.signUpEnabled !== undefined) {
      await this.settings.setSignUpEnabled(input.signUpEnabled);
      await this.log(this.prisma, actorId, null, 'settings.updated', {
        signUpEnabled: input.signUpEnabled,
      });
    }
    return this.getSettings();
  }

  async listActions(cursor: string | undefined): Promise<AdminActionPage> {
    const person = { select: { id: true, name: true, email: true } } as const;
    const actions = await this.prisma.adminAction.findMany({
      where: cursor ? { id: { lt: cursor } } : {},
      orderBy: { id: 'desc' },
      take: PAGE_SIZE + 1,
      include: { actor: person, targetUser: person },
    });
    const page = actions.slice(0, PAGE_SIZE);
    return {
      items: page.map((action): AdminActionDto => {
        const details = (action.payload ?? {}) as Record<string, unknown>;
        return {
          id: action.id,
          type: (ADMIN_ACTION_TYPES as readonly string[]).includes(action.type)
            ? (action.type as AdminActionType)
            : 'settings.updated',
          actor: action.actor,
          target: action.targetUser,
          targetEmail:
            action.targetUser?.email ??
            (typeof details['email'] === 'string' ? details['email'] : null),
          details,
          createdAt: action.createdAt.toISOString(),
        };
      }),
      nextCursor: actions.length > PAGE_SIZE ? (page.at(-1)?.id ?? null) : null,
    };
  }

  /** Administrators who can still act: flagged or configured, and not suspended. */
  async countAdmins(
    client: Prisma.TransactionClient | PrismaService = this.prisma,
    exceptId?: string,
  ) {
    const candidates = await client.user.findMany({
      where: {
        suspendedAt: null,
        ...(exceptId ? { id: { not: exceptId } } : {}),
        OR: [
          { isAdmin: true },
          ...(this.env.ADMIN_EMAILS.length > 0
            ? [{ email: { in: this.env.ADMIN_EMAILS, mode: 'insensitive' as const } }]
            : []),
        ],
      },
      select: { email: true, emailVerified: true, isAdmin: true, suspendedAt: true },
    });
    return candidates.filter((user) => isInstanceAdmin(user, this.env)).length;
  }

  async log(
    client: Prisma.TransactionClient | PrismaService,
    actorId: string | null,
    targetUserId: string | null,
    type: AdminActionType,
    payload: Prisma.InputJsonObject = {},
  ) {
    await client.adminAction.create({ data: { actorId, targetUserId, type, payload } });
  }

  // -------------------------------------------------------------------------

  private async findUser(client: Prisma.TransactionClient | PrismaService, userId: string) {
    const user = await client.user.findUnique({ where: { id: userId }, include: USER_INCLUDE });
    if (!user) throw AppError.notFound('USER_NOT_FOUND');
    return user;
  }

  /** Refuses a change that would leave the instance without an administrator. */
  private async keepAnAdmin(tx: Prisma.TransactionClient, losingId: string) {
    const target = await tx.user.findUniqueOrThrow({ where: { id: losingId } });
    if (!isInstanceAdmin(target, this.env)) return;
    if ((await this.countAdmins(tx, losingId)) === 0) throw AppError.conflict('LAST_ADMIN');
  }

  private async handOverSharedWorkspaces(tx: Prisma.TransactionClient, userId: string) {
    const organization = await tx.organization.findUnique({
      where: { personalOwnerId: userId },
      include: {
        workspaces: {
          include: {
            members: {
              where: { userId: { not: userId } },
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            },
          },
        },
      },
    });
    if (!organization) return;
    const shared = organization.workspaces.filter((workspace) => workspace.members.length > 0);
    if (shared.length === 0) return;

    // The organization stays, without a personal owner; its other workspaces go.
    await tx.workspace.deleteMany({
      where: { organizationId: organization.id, id: { notIn: shared.map((w) => w.id) } },
    });
    await tx.organization.update({
      where: { id: organization.id },
      data: { personalOwnerId: null },
    });
    for (const workspace of shared) {
      const heir =
        workspace.members.find((member) => member.role === 'ADMIN') ?? workspace.members[0]!;
      if (heir.role !== 'ADMIN') {
        await tx.workspaceMember.update({ where: { id: heir.id }, data: { role: 'ADMIN' } });
      }
      await tx.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: organization.id, userId: heir.userId } },
        create: { organizationId: organization.id, userId: heir.userId, role: 'MEMBER' },
        update: {},
      });
    }
  }

  private toAdminUser(user: UserRow): AdminUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      isAdmin: isInstanceAdmin(user, this.env),
      adminFromConfig: isAdminFromConfig(user, this.env),
      suspendedAt: user.suspendedAt?.toISOString() ?? null,
      signInMethods: [...new Set(user.accounts.map((account) => account.providerId))].sort(),
      organizations: user._count.organizationMemberships,
      workspaces: user._count.workspaceMemberships,
      lastActiveAt: user.sessions[0]?.updatedAt.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
