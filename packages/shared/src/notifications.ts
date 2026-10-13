import { z } from 'zod';
import { userSummarySchema } from './members.js';

// ---------------------------------------------------------------------------
// Activity: what happened on a board, newest first.
// ---------------------------------------------------------------------------

export const activitySchema = z.object({
  id: z.uuid(),
  /** e.g. "card.created", "card.moved", "comment.created"; see the services. */
  type: z.string(),
  actor: userSummarySchema.nullable(),
  /** The card, while it still exists. */
  card: z.object({ id: z.uuid(), title: z.string() }).nullable(),
  /** Type-specific details, e.g. { fromListId, toListId } for "card.moved". */
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
});
export type Activity = z.infer<typeof activitySchema>;

export const activityPageSchema = z.object({
  items: z.array(activitySchema),
  nextCursor: z.uuid().nullable(),
});
export type ActivityPage = z.infer<typeof activityPageSchema>;

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const NOTIFICATION_TYPES = [
  /** Someone mentioned you in a comment. */
  'MENTIONED',
  /** Someone assigned a card to you. */
  'ASSIGNED',
  /** A comment on a card you're assigned to or watch. */
  'COMMENTED',
  /** A card you're assigned to or watch moved to another list. */
  'CARD_MOVED',
  /** A card was added to a board you watch. */
  'CARD_CREATED',
  /** A card you're assigned to or watch is due within a day. */
  'DUE_SOON',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);

export const notificationSchema = z.object({
  id: z.uuid(),
  type: notificationTypeSchema,
  actor: userSummarySchema.nullable(),
  board: z.object({ id: z.uuid(), name: z.string() }),
  /** Null when the card was deleted since. */
  card: z.object({ id: z.uuid(), title: z.string() }).nullable(),
  /** Details: { excerpt } for comments, { fromList, toList } for moves, { dueAt } for due dates. */
  payload: z.record(z.string(), z.unknown()),
  readAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type Notification = z.infer<typeof notificationSchema>;

export const notificationPageSchema = z.object({
  items: z.array(notificationSchema),
  nextCursor: z.uuid().nullable(),
  unreadCount: z.int(),
});
export type NotificationPage = z.infer<typeof notificationPageSchema>;

export const notificationPreferencesSchema = z.object({
  emailMentions: z.boolean(),
  emailAssignments: z.boolean(),
  /** Comments, moves and new cards on what you watch or are assigned to. */
  emailWatching: z.boolean(),
  emailDueSoon: z.boolean(),
});
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export const updateNotificationPreferencesSchema = notificationPreferencesSchema.partial();
export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>;

/** The email preference that decides whether a notification type is emailed. */
export const EMAIL_PREFERENCE_FOR: Record<NotificationType, keyof NotificationPreferences> = {
  MENTIONED: 'emailMentions',
  ASSIGNED: 'emailAssignments',
  COMMENTED: 'emailWatching',
  CARD_MOVED: 'emailWatching',
  CARD_CREATED: 'emailWatching',
  DUE_SOON: 'emailDueSoon',
};

export const watchStateSchema = z.object({ watching: z.boolean() });
export type WatchState = z.infer<typeof watchStateSchema>;
