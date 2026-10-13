import { CARD_DESCRIPTION_MAX_LENGTH, CARD_TITLE_MAX_LENGTH } from '@flowbit/shared';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { AlignLeftIcon, ArrowRightLeftIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { InlineEdit } from '@/components/inline-edit';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Markdown } from '@/features/boards/markdown';
import {
  boardQuery,
  boardsQuery,
  useDeleteCard,
  useMoveCard,
  useUpdateCard,
} from '@/features/boards/queries';

export const Route = createFileRoute('/_app/b/$boardId/c/$cardId')({
  component: CardDialog,
});

function CardDialog() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { boardId, cardId } = Route.useParams();
  const { data: board } = useSuspenseQuery(boardQuery(boardId));
  const card = board.cards.find((item) => item.id === cardId);
  const list = board.lists.find((item) => item.id === card?.listId);
  const canEdit = board.role !== 'OBSERVER';
  const close = () => void navigate({ to: '/b/$boardId', params: { boardId } });

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        closeLabel={t('common.close')}
        className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"
      >
        {card && list ? (
          <CardDetails
            boardId={boardId}
            workspaceId={board.workspaceId}
            card={card}
            listName={list.name}
            lists={board.lists}
            canEdit={canEdit}
            onDeleted={close}
          />
        ) : (
          <>
            <DialogTitle className="sr-only">{t('errors.CARD_NOT_FOUND')}</DialogTitle>
            <p className="py-6 text-center text-muted-foreground">{t('errors.CARD_NOT_FOUND')}</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface CardDetailsProps {
  boardId: string;
  workspaceId: string;
  card: { id: string; title: string; description: string; listId: string };
  listName: string;
  lists: { id: string; name: string }[];
  canEdit: boolean;
  onDeleted: () => void;
}

function CardDetails({
  boardId,
  workspaceId,
  card,
  listName,
  lists,
  canEdit,
  onDeleted,
}: CardDetailsProps) {
  const { t } = useTranslation();
  const updateCard = useUpdateCard(boardId);
  const deleteCard = useDeleteCard(boardId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(card.description);

  const saveDescription = () => {
    if (draft !== card.description) updateCard.mutate({ cardId: card.id, description: draft });
    setEditing(false);
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-1 pr-6">
        <DialogTitle className="text-xl">
          <InlineEdit
            value={card.title}
            label={t('cards.title')}
            maxLength={CARD_TITLE_MAX_LENGTH}
            disabled={!canEdit}
            multiline
            onSave={(title) => updateCard.mutate({ cardId: card.id, title })}
            inputClassName="resize-none text-lg"
          />
        </DialogTitle>
        <DialogDescription className="px-1">
          {t('cards.inList', { list: listName })}
        </DialogDescription>
      </div>

      <section className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-semibold">
            <AlignLeftIcon className="size-4" aria-hidden />
            {t('cards.description')}
          </h3>
          {canEdit && !editing ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setDraft(card.description);
                setEditing(true);
              }}
            >
              {t('cards.editDescription')}
            </Button>
          ) : null}
        </div>
        {editing ? (
          <div className="grid gap-2">
            <Textarea
              autoFocus
              rows={8}
              value={draft}
              maxLength={CARD_DESCRIPTION_MAX_LENGTH}
              placeholder={t('cards.descriptionPlaceholder')}
              aria-label={t('cards.description')}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation();
                  setEditing(false);
                }
              }}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={saveDescription}>
                {t('cards.save')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                {t('common.cancel')}
              </Button>
              <span className="ml-auto text-xs text-muted-foreground">
                {t('cards.markdownHint')}
              </span>
            </div>
          </div>
        ) : card.description ? (
          <Markdown>{card.description}</Markdown>
        ) : (
          <p className="text-sm text-muted-foreground">{t('cards.noDescription')}</p>
        )}
      </section>

      {canEdit ? (
        <div className="grid gap-4 border-t pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <MoveCard boardId={boardId} workspaceId={workspaceId} card={card} lists={lists} />
          <Button
            variant="outline"
            className="text-destructive"
            onClick={() => {
              if (window.confirm(t('cards.deleteConfirm'))) {
                deleteCard.mutate(card.id);
                toast.success(t('cards.deleted'));
                onDeleted();
              }
            }}
          >
            <Trash2Icon />
            {t('cards.delete')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const END = Number.MAX_SAFE_INTEGER;

function MoveCard({
  boardId,
  workspaceId,
  card,
  lists,
}: {
  boardId: string;
  workspaceId: string;
  card: { id: string; listId: string };
  lists: { id: string; name: string }[];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const moveCard = useMoveCard(boardId);
  const { data: boards = [] } = useQuery(boardsQuery(workspaceId));
  const [targetBoardId, setTargetBoardId] = useState(boardId);
  const { data: targetBoard } = useQuery({
    ...boardQuery(targetBoardId),
    enabled: targetBoardId !== boardId,
  });
  const targetLists = targetBoardId === boardId ? lists : (targetBoard?.lists ?? []);
  const [targetListId, setTargetListId] = useState(card.listId);
  const listId = targetLists.some((list) => list.id === targetListId)
    ? targetListId
    : targetLists[0]?.id;

  const selectClass =
    'h-9 w-full rounded-md border border-input bg-card px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!listId || listId === card.listId) return;
        moveCard.mutate({ cardId: card.id, toListId: listId, toIndex: END });
        if (targetBoardId !== boardId) {
          void navigate({
            to: '/b/$boardId/c/$cardId',
            params: { boardId: targetBoardId, cardId: card.id },
          });
        }
      }}
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        <ArrowRightLeftIcon className="size-4" aria-hidden />
        {t('cards.move')}
      </p>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <div className="grid gap-1">
          <Label htmlFor="move-board" className="text-xs text-muted-foreground">
            {t('cards.board')}
          </Label>
          <select
            id="move-board"
            className={selectClass}
            value={targetBoardId}
            onChange={(event) => setTargetBoardId(event.target.value)}
          >
            {boards
              .filter((board) => board.role !== 'OBSERVER')
              .map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
          </select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="move-list" className="text-xs text-muted-foreground">
            {t('cards.list')}
          </Label>
          <select
            id="move-list"
            className={selectClass}
            value={listId ?? ''}
            onChange={(event) => setTargetListId(event.target.value)}
          >
            {targetLists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="submit"
          variant="secondary"
          className="self-end"
          disabled={!listId || listId === card.listId}
        >
          {t('cards.moveSubmit')}
        </Button>
      </div>
    </form>
  );
}
