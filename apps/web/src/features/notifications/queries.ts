import type {
  Notification,
  NotificationPage,
  UpdateNotificationPreferencesInput,
} from '@flowbit/shared';
import {
  type InfiniteData,
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api, unwrap } from '@/api/client';
import { errorMessage } from '@/lib/errors';

export const notificationsQuery = infiniteQueryOptions({
  queryKey: ['notifications'],
  queryFn: ({ pageParam }) =>
    unwrap(
      api.GET('/api/v1/me/notifications', {
        params: { query: pageParam ? { cursor: pageParam } : {} },
      }),
    ),
  initialPageParam: null as string | null,
  getNextPageParam: (page) => page.nextCursor,
});

export const preferencesQuery = queryOptions({
  queryKey: ['notification-preferences'],
  queryFn: () => unwrap(api.GET('/api/v1/me/notification-preferences')),
});

type Data = InfiniteData<NotificationPage>;

/** Applies a change to the cached notifications: every page, and the unread count. */
export function patchNotifications(
  data: Data | undefined,
  update: (items: Notification[], first: boolean) => Notification[],
  unread: (count: number) => number,
): Data | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page, i) => ({
      ...page,
      items: update(page.items, i === 0),
      unreadCount: unread(page.unreadCount),
    })),
  };
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      unwrap(
        api.POST('/api/v1/me/notifications/{notificationId}/read', {
          params: { path: { notificationId } },
        }),
      ),
    onMutate: (notificationId) => {
      const now = new Date().toISOString();
      queryClient.setQueryData(notificationsQuery.queryKey, (data: Data | undefined) => {
        const wasUnread = data?.pages.some((page) =>
          page.items.some((item) => item.id === notificationId && !item.readAt),
        );
        return patchNotifications(
          data,
          (items) =>
            items.map((item) =>
              item.id === notificationId ? { ...item, readAt: item.readAt ?? now } : item,
            ),
          (count) => (wasUnread ? Math.max(count - 1, 0) : count),
        );
      });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.POST('/api/v1/me/notifications/read'),
    onMutate: () => {
      const now = new Date().toISOString();
      queryClient.setQueryData(notificationsQuery.queryKey, (data: Data | undefined) =>
        patchNotifications(
          data,
          (items) => items.map((item) => ({ ...item, readAt: item.readAt ?? now })),
          () => 0,
        ),
      );
    },
  });
}

export function useUpdatePreferences() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateNotificationPreferencesInput) =>
      unwrap(api.PATCH('/api/v1/me/notification-preferences', { body })),
    onSuccess: (preferences) => queryClient.setQueryData(preferencesQuery.queryKey, preferences),
    onError: (error) => toast.error(errorMessage(t, error)),
  });
}
