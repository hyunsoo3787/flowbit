import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/api/client';
import { Page } from '@/components/page';
import { Button } from '@/components/ui/button';
import { BACKGROUND_CLASSES } from '@/features/boards/backgrounds';
import { BoardCanvas } from '@/features/boards/board-canvas';
import { BoardHeader } from '@/features/boards/board-header';
import { boardQuery } from '@/features/boards/queries';
import { useBoardRealtime } from '@/features/boards/use-board-realtime';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_app/b/$boardId')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(boardQuery(params.boardId)),
  component: BoardPage,
  errorComponent: BoardError,
});

function BoardPage() {
  const { boardId } = Route.useParams();
  const { data: board } = useSuspenseQuery(boardQuery(boardId));
  useBoardRealtime(boardId);

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-hidden',
        BACKGROUND_CLASSES[board.background],
      )}
    >
      <BoardHeader board={board} />
      <div className="min-h-0 flex-1">
        <BoardCanvas board={board} />
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
