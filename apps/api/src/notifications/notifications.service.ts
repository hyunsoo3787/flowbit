import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  DEFAULT_LOCALE,
  EMAIL_PREFERENCE_FOR,
  isLocale,
  mentionedUserIds,
  type Notification as NotificationDto,
  type NotificationPage,
  type NotificationPreferences,
  type NotificationType,
  notificationTypeSchema,
  type UpdateNotificationPreferencesInput,
} from '@flowbit/shared';
import { BoardMembersService } from '../boards/board-members.service.js';
import { toUserSummary, USER_SUMMARY_SELECT } from '../boards/mappers.js';
import { AppError } from '../common/app-error.js';
import { ENV, type Env } from '../config/env.js';
import { type DomainEvent, DomainEvents } from '../events/domain-events.js';
import type { Prisma } from '../generated/prisma/client.js';
import { JobsService } from '../jobs/jobs.service.js';
import { MailService } from '../mail/mail.service.js';
import { mailTemplates } from '../mail/templates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';

const PAGE_SIZE = 30;
const EXCERPT_LENGTH = 200;
const DAY_MS = 24 * 60 * 60 * 1000;
export const EMAIL_JOB = 'notification.email';
export const DUE_SOON_TASK = 'notifications.due-soon';
const DUE_SOON_EVERY_MS = 5 * 60 * 1000;

const INCLUDE = {
  actor: { select: USER_SUMMARY_SELECT },
  board: { select: { id: true, name: true } },
  card: { select: { id: true, title: true } },
} satisfies Prisma.NotificationInclude;

type NotificationRow = Prisma.NotificationGetPayload<{ include: typeof INCLUDE }>;

const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailMentions: true,
  emailAssignments: true,
  emailWatching: true,
  emailDueSoon: true,
};

interface NewNotification {
  type: NotificationType;
  actorId: string | null;
  boardId: string;
  cardId: string | null;
  activityId?: string;
  payload?: Prisma.InputJsonObject;
}

/**
 * Turns what happens on boards into notifications (phase 4): in the app right
 * away over the user's socket room, and by email from a background job.
 */
@Injectable()
export class NotificationsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEvents,
    private readonly jobs: JobsService,
    private readonly realtime: RealtimeService,
    private readonly boardMembers: BoardMembersService,
    private readonly mail: MailService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit() {
    this.events.subscribe((event) => this.handle(event));
    this.jobs.register(EMAIL_JOB, (data: { notificationId: string }) =>
      this.sendEmail(data.notificationId),
    );
    this.jobs.every(DUE_SOON_TASK, DUE_SOON_EVERY_MS, () => this.remindDueSoon());
  }

  // -------------------------------------------------------------------------
  // Who hears about what
  // -------------------------------------------------------------------------

  private async handle(event: DomainEvent) {
    const base = {
      actorId: event.actorId,
      boardId: event.boardId,
      cardId: event.cardId,
      activityId: event.activityId,
    };
    switch (event.type) {
      case 'comment.created': {
        const members = await this.memberIds(event.boardId);
        const excerpt = await this.excerpt(event.body);
        const mentioned = mentionedUserIds(event.body).filter(
          (id) => id !== event.actorId && members.has(id),
        );
        await this.create(mentioned, { ...base, type: 'MENTIONED', payload: { excerpt } });
        const audience = await this.cardAudience(event.cardId, event.boardId);
        const others = [...audience].filter(
          (id) => id !== event.actorId && !mentioned.includes(id) && members.has(id),
        );
        await this.create(others, { ...base, type: 'COMMENTED', payload: { excerpt } });
        return;
      }
      case 'card.assigned': {
        if (event.assigneeId === event.actorId) return;
        await this.create([event.assigneeId], { ...base, type: 'ASSIGNED' });
        return;
      }
      case 'card.moved': {
        const [members, audience, lists] = await Promise.all([
          this.memberIds(event.boardId),
          this.cardAudience(event.cardId, event.boardId),
          this.prisma.list.findMany({
            where: { id: { in: [event.fromListId, event.toListId] } },
            select: { id: true, name: true },
          }),
        ]);
        const name = (id: string) => lists.find((list) => list.id === id)?.name ?? null;
        const recipients = [...audience].filter((id) => id !== event.actorId && members.has(id));
        await this.create(recipients, {
          ...base,
          type: 'CARD_MOVED',
          payload: { fromList: name(event.fromListId), toList: name(event.toListId) },
        });
        return;
      }
      case 'card.created': {
        const [members, watchers, card] = await Promise.all([
          this.memberIds(event.boardId),
          this.prisma.watch.findMany({
            where: { boardId: event.boardId },
            select: { userId: true },
          }),
          this.prisma.card.findUnique({
            where: { id: event.cardId },
            select: { list: { select: { name: true } } },
          }),
        ]);
        const recipients = watchers
          .map((watch) => watch.userId)
          .filter((id) => id !== event.actorId && members.has(id));
        await this.create(recipients, {
          ...base,
          type: 'CARD_CREATED',
          payload: { list: card?.list.name ?? null },
        });
        return;
      }
    }
  }

  /** People following a card: its assignees and the watchers of the card and its board. */
  private async cardAudience(cardId: string, boardId: string) {
    const [assignees, watches] = await Promise.all([
      this.prisma.cardAssignee.findMany({ where: { cardId }, select: { userId: true } }),
      this.prisma.watch.findMany({
        where: { OR: [{ cardId }, { boardId }] },
        select: { userId: true },
      }),
    ]);
    return new Set([...assignees, ...watches].map((row) => row.userId));
  }

  private async memberIds(boardId: string) {
    const members = await this.boardMembers.list(boardId);
    return new Set(members.map((member) => member.user.id));
  }

  /** A comment as plain text for previews: mentions as @Name, shortened. */
  private async excerpt(body: string) {
    const ids = mentionedUserIds(body);
    const users = ids.length
      ? await this.prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        })
      : [];
    const text = body
      .replace(/<@([0-9a-f-]{36})>/g, (raw, id: string) => {
        const user = users.find((candidate) => candidate.id === id);
        return user ? `@${user.name}` : raw;
      })
      .replace(/\s+/g, ' ')
      .trim();
    return text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH - 1)}…` : text;
  }

  private async create(userIds: string[], input: NewNotification) {
    for (const userId of new Set(userIds)) {
      const row = await this.prisma.notification.create({
        data: {
          userId,
          type: input.type,
          actorId: input.actorId,
          boardId: input.boardId,
          cardId: input.cardId,
          activityId: input.activityId ?? null,
          payload: input.payload ?? {},
        },
        include: INCLUDE,
      });
      this.realtime.notify(userId, this.toDto(row));
      await this.jobs.enqueue(EMAIL_JOB, { notificationId: row.id });
    }
  }

  // -------------------------------------------------------------------------
  // Due dates
  // -------------------------------------------------------------------------

  /**
   * Reminds assignees and watchers of cards due within a day, once per due
   * date (changing the due date allows a new reminder). Runs every few minutes.
   */
  async remindDueSoon(now = new Date()) {
    const cards = await this.prisma.card.findMany({
      where: {
        dueCompletedAt: null,
        dueAt: { gt: now, lte: new Date(now.getTime() + DAY_MS) },
      },
      select: {
        id: true,
        boardId: true,
        dueAt: true,
        dueReminderAt: true,
        assignees: { select: { userId: true } },
        watches: { select: { userId: true } },
      },
    });
    for (const card of cards) {
      if (card.dueReminderAt && card.dueReminderAt.getTime() === card.dueAt!.getTime()) continue;
      // Claim the reminder first, so two runs can't both send it.
      const { count } = await this.prisma.card.updateMany({
        where: {
          id: card.id,
          OR: [{ dueReminderAt: null }, { dueReminderAt: { not: card.dueAt! } }],
        },
        data: { dueReminderAt: card.dueAt },
      });
      if (count === 0) continue;
      const members = await this.memberIds(card.boardId);
      const recipients = [...card.assignees, ...card.watches]
        .map((row) => row.userId)
        .filter((id) => members.has(id));
      await this.create(recipients, {
        type: 'DUE_SOON',
        actorId: null,
        boardId: card.boardId,
        cardId: card.id,
        payload: { dueAt: card.dueAt!.toISOString() },
      });
    }
  }

  // -------------------------------------------------------------------------
  // Email
  // -------------------------------------------------------------------------

  private async sendEmail(notificationId: string) {
    const row = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: { ...INCLUDE, user: true },
    });
    if (!row || row.emailedAt || !row.card) return;
    const user = row.user;
    if (user.suspendedAt) return;
    // Unverified addresses only get mail where verification isn't required.
    if (this.env.AUTH_REQUIRE_EMAIL_VERIFICATION && !user.emailVerified) return;
    const preferences = await this.preferences(user.id);
    const type = notificationTypeSchema.parse(row.type);
    if (!preferences[EMAIL_PREFERENCE_FOR[type]]) return;

    const locale = isLocale(user.locale) ? user.locale : DEFAULT_LOCALE;
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const str = (value: unknown) => (typeof value === 'string' ? value : undefined);
    const dueAt = str(payload['dueAt']);
    await this.mail.send(
      user.email,
      mailTemplates.notification(locale, {
        type,
        actor: row.actor?.name ?? null,
        card: row.card.title,
        board: row.board.name,
        excerpt: str(payload['excerpt']),
        toList: str(payload['toList']),
        dueAt: dueAt
          ? new Intl.DateTimeFormat(locale, {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'UTC',
            }).format(new Date(dueAt)) + ' UTC'
          : undefined,
        url: `${this.env.PUBLIC_URL}/b/${row.boardId}/c/${row.card.id}`,
        settingsUrl: this.env.PUBLIC_URL,
      }),
    );
    await this.prisma.notification.update({
      where: { id: row.id },
      data: { emailedAt: new Date() },
    });
  }

  // -------------------------------------------------------------------------
  // The recipient's view
  // -------------------------------------------------------------------------

  async list(userId: string, cursor?: string, unreadOnly = false): Promise<NotificationPage> {
    const rows = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { readAt: null } : {}),
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      orderBy: { id: 'desc' },
      take: PAGE_SIZE + 1,
      include: INCLUDE,
    });
    const page = rows.slice(0, PAGE_SIZE);
    return {
      items: page.map((row) => this.toDto(row)),
      nextCursor: rows.length > PAGE_SIZE ? (page.at(-1)?.id ?? null) : null,
      unreadCount: await this.prisma.notification.count({ where: { userId, readAt: null } }),
    };
  }

  async markRead(userId: string, notificationId: string): Promise<NotificationDto> {
    const existing = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!existing || existing.userId !== userId) throw AppError.notFound('NOTIFICATION_NOT_FOUND');
    const row = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: existing.readAt ?? new Date() },
      include: INCLUDE,
    });
    this.realtime.notificationsChanged(userId);
    return this.toDto(row);
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    this.realtime.notificationsChanged(userId);
  }

  async preferences(userId: string): Promise<NotificationPreferences> {
    const row = await this.prisma.notificationPreference.findUnique({ where: { userId } });
    if (!row) return DEFAULT_PREFERENCES;
    const { emailMentions, emailAssignments, emailWatching, emailDueSoon } = row;
    return { emailMentions, emailAssignments, emailWatching, emailDueSoon };
  }

  async updatePreferences(
    userId: string,
    input: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreferences> {
    await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...DEFAULT_PREFERENCES, ...input },
      update: input,
    });
    return this.preferences(userId);
  }

  private toDto(row: NotificationRow): NotificationDto {
    return {
      id: row.id,
      type: notificationTypeSchema.parse(row.type),
      actor: row.actor ? toUserSummary(row.actor) : null,
      board: row.board,
      card: row.card,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
