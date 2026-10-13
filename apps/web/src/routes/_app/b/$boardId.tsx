import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, Outlet, useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/api/client';
import { Page } from '@/components/page';
import { Button } from '@/components/ui/button';
import { useMe } from '@/features/auth/queries';
import { boardSurface } from '@/features/boards/backgrounds';
import { BoardCanvas } from '@/features/boards/board-canvas';
import { BoardHeader } from '@/features/boards/board-header';
import {
  activeFilterCount,
  type BoardFilter,
  boardSearchSchema,
  matchesFilter,
  toSearch,
} from '@/features/boards/filters';
import { boardQuery } from '@/features/boards/queries';
import { useBoardRealtime } from '@/features/boards/use-board-realtime';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_app/b/$boardId')({
  validateSearch: boardSearchSchema,
  loader: ({ context, params }) => context.queryClient.ensureQueryData(boardQuery(params.boardId)),
  component: BoardPage,
  errorComponent: BoardError,
});

function BoardPage() {
  const { boardId } = Route.useParams();
  const { data: board } = useSuspenseQuery(boardQuery(boardId));
  useBoardRealtime(boardId);
  const surface = boardSurface(board.background);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: me } = useMe();
  const filter: BoardFilter = search;
  const filtering = activeFilterCount(filter) > 0;
  const visibleCardIds = useMemo(
    () =>
      filtering
        ? new Set(
            board.cards
              .filter((card) => matchesFilter(card, filter, { meId: me?.id, labels: board.labels }))
              .map((card) => card.id),
          )
        : undefined,
    [filtering, filter, board.cards, board.labels, me?.id],
  );

  return (
    <div
      className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', surface.className)}
      style={surface.style}
    >
      <BoardHeader
        board={board}
        filter={filter}
        onFilterChange={(next) => void navigate({ search: toSearch(next), replace: true })}
      />
      <div className="min-h-0 flex-1">
        <BoardCanvas board={board} visibleCardIds={visibleCardIds} />
      </div>
      <Outlet />
    </div>
  );
}

function BoardError({ error }: { error: unknown }) {
  const { t } = useTranslation();
  const notFound = error instanceof ApiError && error.status === 404;
  return (
    <Page>
      <div className="grid justify-items-center gap-3 pt-12 text-center">
        <p className="max-w-sm text-muted-foreground">
          {notFound ? t('errors.BOARD_NOT_FOUND') : errorMessage(t, error)}
        </p>
        <Button asChild variant="outline">
          <Link to="/">{t('notFound.home')}</Link>
        </Button>
      </div>
    </Page>
  );
}
