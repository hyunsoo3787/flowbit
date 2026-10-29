import type { BoardDetail } from '@flowbit/shared';
import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, unwrap } from '@/api/client';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { relativeTime } from '@/lib/time';
import { activityText } from './activity-text';

type Source = { kind: 'board'; id: string } | { kind: 'card'; id: string };

export const activityQuery = (source: Source) =>
  infiniteQueryOptions({
    queryKey: [source.kind === 'board' ? 'boards' : 'cards', source.id, 'activity'],
    queryFn: ({ pageParam }) => {
      const query = pageParam ? { cursor: pageParam } : {};
      return unwrap(
        source.kind === 'board'
          ? api.GET('/api/v1/boards/{boardId}/activity', {
              params: { path: { boardId: source.id }, query },
            })
          : api.GET('/api/v1/cards/{cardId}/activity', {
              params: { path: { cardId: source.id }, query },
            }),
      );
    },
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });

/** What happened on a board or a card, newest first. */
export function ActivityList({ source, board }: { source: Source; board: BoardDetail }) {
  const { t, i18n } = useTranslation();
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage, isPending } = useInfiniteQuery(
    activityQuery(source),
  );
  const items = data?.pages.flatMap((page) => page.items) ?? [];

  if (isPending) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;
  return (
    <div className="grid gap-3">
      <ol className="grid gap-3">
        {items.map((activity) => (
          <li key={activity.id} className="flex gap-2">
            {activity.actor ? (
              <Avatar user={activity.actor} size="sm" className="mt-0.5" />
            ) : (
              <span className="size-6 shrink-0" />
            )}
            <span className="grid gap-0.5">
              <span className="text-sm">
                {activityText(t, activity, board, { inCard: source.kind === 'card' })}
              </span>
              <time dateTime={activity.createdAt} className="text-xs text-muted-foreground">
                {relativeTime(activity.createdAt, i18n.language)}
              </time>
            </span>
          </li>
        ))}
        {items.length === 0 ? (
          <li className="text-sm text-muted-foreground">{t('activity.empty')}</li>
        ) : null}
      </ol>
      {hasNextPage ? (
        <Button
          variant="ghost"
          size="sm"
          className="justify-self-start"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          {t('activity.loadMore')}
        </Button>
      ) : null}
    </div>
  );
}
