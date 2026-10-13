import type { Notification } from '@flowbit/shared';
import type { TFunction } from 'i18next';

/** One line describing a notification, e.g. "Ann mentioned you on Ship it". */
export function notificationText(t: TFunction, notification: Notification): string {
  const actor = notification.actor?.name ?? t('notifications.someone');
  const card = notification.card?.title ?? t('notifications.deletedCard');
  const payload = notification.payload;
  const text = (key: string) => (typeof payload[key] === 'string' ? payload[key] : '');
  switch (notification.type) {
    case 'MENTIONED':
      return t('notifications.types.MENTIONED', { actor, card });
    case 'ASSIGNED':
      return t('notifications.types.ASSIGNED', { actor, card });
    case 'COMMENTED':
      return t('notifications.types.COMMENTED', { actor, card });
    case 'CARD_MOVED':
      return t('notifications.types.CARD_MOVED', { actor, card, list: text('toList') });
    case 'CARD_CREATED':
      return t('notifications.types.CARD_CREATED', { actor, card, list: text('list') });
    case 'DUE_SOON':
      return t('notifications.types.DUE_SOON', { card });
  }
}
