import type { Workspace } from '@flowbit/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { LockIcon, PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { boardSurface } from './backgrounds';
import { CreateBoardDialog } from './create-board-dialog';
import { boardsQuery } from './queries';

const TILE =
  'flex h-24 rounded-lg p-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

/** The boards of a workspace, with a tile to create one. */
export function BoardGrid({ workspace }: { workspace: Workspace }) {
  const { t } = useTranslation();
  const { data: boards = [], isPending } = useQuery(boardsQuery(workspace.id));
  const canCreate = workspace.role !== 'VIEWER';

  if (!isPending && boards.length === 0 && !canCreate) {
    return <p className="text-sm text-muted-foreground">{t('boards.emptyTitle')}</p>;
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {boards.map((board) => {
        const surface = boardSurface(board.background);
        return (
          <li key={board.id}>
            <Link
              to="/b/$boardId"
              params={{ boardId: board.id }}
              className={cn(
                TILE,
                'items-start justify-between font-semibold transition-[filter] hover:brightness-95 dark:hover:brightness-125',
                surface.className,
              )}
              style={surface.style}
            >
              <span className="line-clamp-2 break-words">{board.name}</span>
              {board.visibility === 'PRIVATE' ? (
                <LockIcon
                  className="size-4 shrink-0 opacity-80"
                  aria-label={t('boards.visibilityPRIVATE')}
                />
              ) : null}
            </Link>
          </li>
        );
      })}
      {canCreate ? (
        <li>
          <CreateBoardDialog
            workspaceId={workspace.id}
            trigger={
              <button
                type="button"
                className={cn(
                  TILE,
                  'w-full items-center justify-center gap-2 border border-dashed bg-muted/50 text-sm text-muted-foreground transition-colors hover:bg-muted',
                )}
              >
                <PlusIcon className="size-4" aria-hidden />
                {t('boards.create')}
              </button>
            }
          />
        </li>
      ) : null}
    </ul>
  );
}
