import {
  BOARD_NAME_MAX_LENGTH,
  BOARD_VISIBILITIES,
  type BoardDetail,
  type BoardVisibility,
} from '@flowbit/shared';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  EyeIcon,
  LockIcon,
  MoreHorizontalIcon,
  PaletteIcon,
  Trash2Icon,
  UsersIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { InlineEdit } from '@/components/inline-edit';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { workspaceQuery } from '@/features/workspaces/queries';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { BackgroundPicker } from './background-picker';
import { boardSurface } from './backgrounds';
import { useDeleteBoard, useUpdateBoard } from './queries';

export function BoardHeader({ board }: { board: BoardDetail }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: workspace } = useQuery(workspaceQuery(board.workspaceId));
  const updateBoard = useUpdateBoard(board.id);
  const deleteBoard = useDeleteBoard(board.id);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [changingBackground, setChangingBackground] = useState(false);
  const isAdmin = board.role === 'ADMIN';
  const VisibilityIcon = board.visibility === 'PRIVATE' ? LockIcon : UsersIcon;

  const onDelete = async () => {
    try {
      await deleteBoard.mutateAsync();
      toast.success(t('boards.deleted'));
      await navigate({ to: '/w/$workspaceId', params: { workspaceId: board.workspaceId } });
    } catch (error) {
      toast.error(errorMessage(t, error));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 sm:px-6">
      <nav className="flex min-w-0 items-center gap-2 text-sm">
        <Link
          to="/w/$workspaceId"
          params={{ workspaceId: board.workspaceId }}
          className="max-w-40 truncate rounded-sm opacity-80 hover:underline hover:opacity-100"
        >
          {workspace?.name}
        </Link>
        <span className="opacity-80" aria-hidden>
          /
        </span>
      </nav>
      <h1 className="min-w-0 text-lg font-bold">
        <InlineEdit
          value={board.name}
          label={t('boards.rename')}
          maxLength={BOARD_NAME_MAX_LENGTH}
          disabled={!isAdmin}
          onSave={(name) => updateBoard.mutate({ name })}
          className="hover:bg-current/15! disabled:hover:bg-transparent!"
          inputClassName="text-base"
        />
      </h1>
      <span
        className="inline-flex items-center gap-1 rounded-md bg-current/10 px-2 py-0.5 text-xs"
        title={t(`boards.visibility${board.visibility}Hint`)}
      >
        <VisibilityIcon className="size-3.5" aria-hidden />
        {t(`boards.visibility${board.visibility}`)}
      </span>
      {board.role === 'OBSERVER' ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-current/15 px-2 py-0.5 text-xs">
          <EyeIcon className="size-3.5" aria-hidden />
          {t('boards.readOnly')}
        </span>
      ) : null}

      {isAdmin ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto text-inherit hover:bg-current/15 hover:text-inherit dark:hover:bg-current/15"
              aria-label={t('boards.menu')}
            >
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={() => setChangingBackground(true)}>
              <PaletteIcon />
              {t('boards.changeBackground')}
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <VisibilityIcon />
                {t('boards.visibility')}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={board.visibility}
                  onValueChange={(value) =>
                    updateBoard.mutate({ visibility: value as BoardVisibility })
                  }
                >
                  {BOARD_VISIBILITIES.map((option) => (
                    <DropdownMenuRadioItem key={option} value={option}>
                      {t(`boards.visibility${option}`)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmingDelete(true)}>
              <Trash2Icon />
              {t('boards.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {changingBackground ? (
        <BackgroundDialog
          board={board}
          onClose={() => setChangingBackground(false)}
          onSave={(background) => {
            updateBoard.mutate({ background });
            setChangingBackground(false);
          }}
        />
      ) : null}

      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent closeLabel={t('common.close')}>
          <DialogHeader>
            <DialogTitle>{t('boards.deleteConfirmTitle', { name: board.name })}</DialogTitle>
            <DialogDescription>{t('boards.deleteConfirmBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={deleteBoard.isPending}>
              {t('boards.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Picks a new background with a live preview; nothing changes until Save. */
function BackgroundDialog({
  board,
  onClose,
  onSave,
}: {
  board: BoardDetail;
  onClose: () => void;
  onSave: (background: string) => void;
}) {
  const { t } = useTranslation();
  const [background, setBackground] = useState(board.background);
  const surface = boardSurface(background);

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('boards.changeBackground')}</DialogTitle>
        </DialogHeader>
        <div
          className={cn(
            'grid h-24 place-items-center rounded-lg px-4 text-center font-semibold',
            surface.className,
          )}
          style={surface.style}
          aria-hidden
        >
          <span className="line-clamp-2">{board.name}</span>
        </div>
        <BackgroundPicker value={background} onChange={setBackground} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => onSave(background)} disabled={background === board.background}>
            {t('common.saveChanges')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
