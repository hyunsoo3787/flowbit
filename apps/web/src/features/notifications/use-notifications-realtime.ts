import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getSocket } from '@/lib/realtime';
import { notificationText } from './notification-text';
import { notificationsQuery, patchNotifications } from './queries';

/** Delivers new notifications as they happen: into the list and as a toast. */
export function useNotificationsRealtime() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const socket = getSocket();
    const key = notificationsQuery.queryKey;
    const onNotification: Parameters<typeof socket.on<'notification'>>[1] = (notification) => {
      queryClient.setQueryData(key, (data) =>
        patchNotifications(
          data,
          (items, first) =>
            first && !items.some((item) => item.id === notification.id)
              ? [notification, ...items]
              : items,
          (count) => count + 1,
        ),
      );
      if (!queryClient.getQueryData(key)) void queryClient.invalidateQueries({ queryKey: key });
      const { card, board } = notification;
      toast(notificationText(t, notification), {
        description: board.name,
        ...(card
          ? {
              action: {
                label: t('notifications.open'),
                onClick: () =>
                  void navigate({
                    to: '/b/$boardId/c/$cardId',
                    params: { boardId: board.id, cardId: card.id },
                  }),
              },
            }
          : {}),
      });
    };
    const onChanged = () => void queryClient.invalidateQueries({ queryKey: key });
    // Catch up on anything missed while disconnected.
    const onReconnect = () => void queryClient.invalidateQueries({ queryKey: key });

    socket.on('notification', onNotification);
    socket.on('notifications:changed', onChanged);
    socket.io.on('reconnect', onReconnect);
    return () => {
      socket.off('notification', onNotification);
      socket.off('notifications:changed', onChanged);
      socket.io.off('reconnect', onReconnect);
    };
  }, [queryClient, navigate, t]);
}
