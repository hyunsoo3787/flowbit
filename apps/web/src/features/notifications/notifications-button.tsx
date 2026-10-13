import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { BellIcon, CheckCheckIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { relativeTime } from '@/lib/time';
import { cn } from '@/lib/utils';
import { notificationText } from './notification-text';
import { notificationsQuery, useMarkAllRead, useMarkRead } from './queries';

/** The bell in the header: unread count and the latest notifications. */
export function NotificationsButton() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery(notificationsQuery);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const unread = data?.pages[0]?.unreadCount ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unread > 0
              ? t('notifications.buttonUnread', { count: unread })
              : t('notifications.button')
          }
        >
          <BellIcon />
          {unread > 0 ? (
            <span
              className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-semibold text-white"
              aria-hidden
            >
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <h2 className="text-sm font-semibold">{t('notifications.title')}</h2>
          {unread > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()}>
              <CheckCheckIcon />
              {t('notifications.markAllRead')}
            </Button>
          ) : null}
        </div>
        <ul className="max-h-[min(28rem,70svh)] overflow-y-auto">
          {items.map((notification) => (
            <li key={notification.id}>
              <button
                type="button"
                className={cn(
                  'flex w-full items-start gap-3 px-3 py-2.5 text-left outline-none hover:bg-accent focus-visible:bg-accent',
                  !notification.readAt && 'bg-primary/5',
                )}
                onClick={() => {
                  if (!notification.readAt) markRead.mutate(notification.id);
                  setOpen(false);
                  const { board, card } = notification;
                  void (card
                    ? navigate({
                        to: '/b/$boardId/c/$cardId',
                        params: { boardId: board.id, cardId: card.id },
                      })
                    : navigate({ to: '/b/$boardId', params: { boardId: board.id } }));
                }}
              >
                {notification.actor ? (
                  <Avatar user={notification.actor} size="md" />
                ) : (
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-amber-400 text-amber-950">
                    <BellIcon className="size-4" aria-hidden />
                  </span>
                )}
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="text-sm">{notificationText(t, notification)}</span>
                  {typeof notification.payload['excerpt'] === 'string' ? (
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      “{notification.payload['excerpt']}”
                    </span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {notification.board.name} ·{' '}
                    {relativeTime(notification.createdAt, i18n.language)}
                  </span>
                </span>
                {!notification.readAt ? (
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary">
                    <span className="sr-only">{t('notifications.unread')}</span>
                  </span>
                ) : null}
              </button>
            </li>
          ))}
          {items.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t('notifications.empty')}
            </li>
          ) : null}
        </ul>
        {hasNextPage ? (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              disabled={isFetchingNextPage}
              onClick={() => void fetchNextPage()}
            >
              {t('notifications.loadMore')}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
