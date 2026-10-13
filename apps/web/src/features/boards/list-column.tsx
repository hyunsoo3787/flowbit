import {
  type Board,
  type Card,
  CARD_TITLE_MAX_LENGTH,
  type List,
  LIST_NAME_MAX_LENGTH,
} from '@flowbit/shared';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQuery } from '@tanstack/react-query';
import { ArrowRightLeftIcon, MoreHorizontalIcon, Trash2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { InlineEdit } from '@/components/inline-edit';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { CardTile } from './card-tile';
import { Composer } from './composer';
import {
  boardsQuery,
  newTempId,
  useCreateCard,
  useDeleteList,
  useMoveList,
  useRenameList,
} from './queries';

const END = Number.MAX_SAFE_INTEGER;

function MoveListMenu({ board, list }: { board: Board; list: List }) {
  const { t } = useTranslation();
  const { data: boards = [] } = useQuery(boardsQuery(board.workspaceId));
  const moveList = useMoveList(board.id);
  const targets = boards.filter((other) => other.id !== board.id && other.role !== 'OBSERVER');

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <ArrowRightLeftIcon />
        {t('lists.moveToBoard')}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {targets.length === 0 ? (
          <DropdownMenuItem disabled>{t('lists.noOtherBoards')}</DropdownMenuItem>
        ) : (
          targets.map((target) => (
            <DropdownMenuItem
              key={target.id}
              onSelect={() => {
                moveList.mutate({ listId: list.id, toBoardId: target.id, toIndex: END });
                toast.success(t('lists.moved', { board: target.name }));
              }}
            >
              <span className="truncate">{target.name}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

interface ListColumnProps {
  board: Board;
  list: List;
  cards: Card[];
  canEdit: boolean;
}

/** One list: a draggable column whose cards can be reordered and moved. */
export function ListColumn({ board, list, cards, canEdit }: ListColumnProps) {
  const { t } = useTranslation();
  const renameList = useRenameList(board.id);
  const deleteList = useDeleteList(board.id);
  const createCard = useCreateCard(board.id);
  const pending = list.id.startsWith('temp-');

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: list.id,
    data: { type: 'list', title: list.name },
    disabled: !canEdit || pending,
  });
  // Lets cards be dropped into an empty list.
  const { setNodeRef: setDropRef } = useDroppable({
    id: `cards:${list.id}`,
    data: { type: 'list-cards', listId: list.id },
    disabled: !canEdit,
  });

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      aria-label={list.name}
      className={cn(
        'flex max-h-full w-72 shrink-0 flex-col rounded-xl bg-muted/95 text-foreground shadow-sm',
        isDragging && 'opacity-40',
      )}
    >
      <header className="flex items-center gap-1 p-2 pb-1">
        <h2
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className={cn('min-w-0 flex-1 font-semibold', canEdit && 'cursor-grab')}
        >
          <InlineEdit
            value={list.name}
            label={t('lists.rename')}
            maxLength={LIST_NAME_MAX_LENGTH}
            disabled={!canEdit || pending}
            onSave={(name) => renameList.mutate({ listId: list.id, name })}
            className="py-1 text-sm"
            inputClassName="py-1 text-sm"
          />
        </h2>
        {canEdit && !pending ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={t('lists.menu', { name: list.name })}
              >
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <MoveListMenu board={board} list={list} />
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  if (window.confirm(t('lists.deleteConfirm', { name: list.name }))) {
                    deleteList.mutate(list.id);
                  }
                }}
              >
                <Trash2Icon />
                {t('lists.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </header>

      <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <ol ref={setDropRef} className="flex min-h-2 flex-col gap-2 overflow-y-auto px-2 pb-1">
          {cards.map((card) => (
            <CardTile key={card.id} card={card} disabled={!canEdit} />
          ))}
        </ol>
      </SortableContext>

      {canEdit && !pending ? (
        <div className="p-2 pt-1">
          <Composer
            openLabel={t('cards.add')}
            placeholder={t('cards.titlePlaceholder')}
            submitLabel={t('cards.submit')}
            maxLength={CARD_TITLE_MAX_LENGTH}
            multiline
            onSubmit={(title) => createCard.mutate({ listId: list.id, title, tempId: newTempId() })}
          />
        </div>
      ) : (
        <div className="h-2" />
      )}
    </section>
  );
}
