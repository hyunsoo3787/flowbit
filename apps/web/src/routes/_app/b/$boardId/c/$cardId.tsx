import {
  type BoardDetail,
  CARD_DESCRIPTION_MAX_LENGTH,
  CARD_TITLE_MAX_LENGTH,
  type Card,
} from '@flowbit/shared';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  AlignLeftIcon,
  ArrowRightLeftIcon,
  CheckSquareIcon,
  ClockIcon,
  PanelTopIcon,
  PlusIcon,
  TagIcon,
  Trash2Icon,
  UserIcon,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { InlineEdit } from '@/components/inline-edit';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Avatar } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { Markdown } from '@/features/boards/markdown';
import {
  boardQuery,
  boardsQuery,
  useDeleteCard,
  useMoveCard,
  useUpdateCard,
} from '@/features/boards/queries';
import { DUE_STYLES } from '@/features/cards/card-badges';
import {
  CoverPopover,
  DatesPopover,
  LabelsPopover,
  MembersPopover,
} from '@/features/cards/card-popovers';
import { AddChecklistPopover, Checklists } from '@/features/cards/checklists';
import { Comments } from '@/features/cards/comments';
import { dueStatus, formatDate } from '@/features/cards/due';
import { LABEL_STYLES } from '@/features/cards/label-colors';
import { MentionTextarea } from '@/features/cards/mention-textarea';
import { cn } from '@/lib/utils';

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
  const close = () => void navigate({ to: '/b/$boardId', params: { boardId }, search: true });

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        closeLabel={t('common.close')}
        className="max-h-[90svh] gap-0 overflow-x-hidden overflow-y-auto p-0 sm:max-w-3xl"
      >
        {card && list ? (
          <CardDetails
            board={board}
            card={card}
            listName={list.name}
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
  board: BoardDetail;
  card: Card;
  listName: string;
  canEdit: boolean;
  onDeleted: () => void;
}

function CardDetails({ board, card, listName, canEdit, onDeleted }: CardDetailsProps) {
  const { t, i18n } = useTranslation();
  const updateCard = useUpdateCard(board.id);
  const deleteCard = useDeleteCard(board.id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(card.description);
  const assignees = board.members.filter((member) => card.assigneeIds.includes(member.user.id));
  const labels = board.labels.filter((label) => card.labelIds.includes(label.id));
  const status = dueStatus(card);
  const people = board.members.map((member) => member.user);

  const saveDescription = () => {
    if (draft !== card.description) updateCard.mutate({ cardId: card.id, description: draft });
    setEditing(false);
  };

  const sideButton = (icon: ReactNode, label: string) => (
    <Button variant="secondary" size="sm" className="w-full justify-start">
      {icon}
      {label}
    </Button>
  );
  const addButton = (label: string) => (
    <Button variant="secondary" size="icon" className="size-8" aria-label={label}>
      <PlusIcon />
    </Button>
  );

  return (
    <>
      {card.coverColor ? (
        <div className={cn('h-20 shrink-0', LABEL_STYLES[card.coverColor].cover)} aria-hidden />
      ) : null}
      <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_10.5rem]">
        <div className="grid min-w-0 content-start gap-6">
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

          {assignees.length > 0 || labels.length > 0 || card.dueAt || card.startAt ? (
            <div className="flex flex-wrap gap-x-6 gap-y-4">
              {assignees.length > 0 ? (
                <div className="grid gap-1.5">
                  <h3 className="text-xs font-semibold text-muted-foreground">
                    {t('cards.members.title')}
                  </h3>
                  <div className="flex flex-wrap items-center gap-1">
                    {assignees.map(({ user }) => (
                      <Avatar key={user.id} user={user} size="md" />
                    ))}
                    {canEdit ? (
                      <MembersPopover
                        board={board}
                        card={card}
                        trigger={addButton(t('cards.members.title'))}
                      />
                    ) : null}
                  </div>
                </div>
              ) : null}
              {labels.length > 0 ? (
                <div className="grid gap-1.5">
                  <h3 className="text-xs font-semibold text-muted-foreground">
                    {t('cards.labels.title')}
                  </h3>
                  <ul className="flex flex-wrap items-center gap-1">
                    {labels.map((label) => (
                      <li
                        key={label.id}
                        className={cn(
                          'h-8 min-w-12 rounded-sm px-3 text-sm leading-8 font-medium',
                          LABEL_STYLES[label.color].chip,
                        )}
                        title={label.name || t(`labels.colors.${label.color}`)}
                      >
                        {label.name}
                        {label.name ? null : (
                          <span className="sr-only">{t(`labels.colors.${label.color}`)}</span>
                        )}
                      </li>
                    ))}
                    {canEdit ? (
                      <li>
                        <LabelsPopover
                          board={board}
                          card={card}
                          trigger={addButton(t('cards.labels.title'))}
                        />
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
              {card.dueAt || card.startAt ? (
                <div className="grid gap-1.5">
                  <h3 className="text-xs font-semibold text-muted-foreground">
                    {card.dueAt ? t('cards.dates.due') : t('cards.dates.start')}
                  </h3>
                  <div className="flex items-center gap-2">
                    {card.dueAt ? (
                      <Checkbox
                        checked={Boolean(card.dueCompletedAt)}
                        disabled={!canEdit}
                        aria-label={t('cards.dates.complete')}
                        onCheckedChange={(checked) =>
                          updateCard.mutate({ cardId: card.id, dueComplete: checked === true })
                        }
                      />
                    ) : null}
                    <span className="rounded-md bg-secondary px-2 py-1 text-sm">
                      {card.startAt ? formatDate(card.startAt, i18n.language) : null}
                      {card.startAt && card.dueAt ? ' – ' : null}
                      {card.dueAt ? formatDate(card.dueAt, i18n.language) : null}
                    </span>
                    {status && status !== 'later' ? (
                      <span
                        className={cn(
                          'rounded-sm px-1.5 py-0.5 text-xs font-medium',
                          DUE_STYLES[status],
                        )}
                      >
                        {t(`cards.due.${status}`)}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

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
                <MentionTextarea
                  escapeHandled
                  autoFocus
                  rows={8}
                  value={draft}
                  members={board.members}
                  maxLength={CARD_DESCRIPTION_MAX_LENGTH}
                  placeholder={t('cards.descriptionPlaceholder')}
                  aria-label={t('cards.description')}
                  onChange={setDraft}
                  onSubmit={saveDescription}
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
              <Markdown people={people}>{card.description}</Markdown>
            ) : (
              <p className="text-sm text-muted-foreground">{t('cards.noDescription')}</p>
            )}
          </section>

          <Checklists cardId={card.id} board={board} canEdit={canEdit} />
          <Comments cardId={card.id} board={board} canComment={canEdit} />
        </div>

        {canEdit ? (
          <aside className="grid content-start gap-2" aria-label={t('cards.actions')}>
            <h3 className="text-xs font-semibold text-muted-foreground">{t('cards.addToCard')}</h3>
            <MembersPopover
              board={board}
              card={card}
              trigger={sideButton(<UserIcon />, t('cards.members.title'))}
            />
            <LabelsPopover
              board={board}
              card={card}
              trigger={sideButton(<TagIcon />, t('cards.labels.title'))}
            />
            <AddChecklistPopover
              cardId={card.id}
              trigger={sideButton(<CheckSquareIcon />, t('checklists.add'))}
            />
            <DatesPopover
              board={board}
              card={card}
              trigger={sideButton(<ClockIcon />, t('cards.dates.title'))}
            />
            <CoverPopover
              board={board}
              card={card}
              trigger={sideButton(<PanelTopIcon />, t('cards.cover.title'))}
            />
            <h3 className="mt-3 text-xs font-semibold text-muted-foreground">
              {t('cards.actions')}
            </h3>
            <MoveCard
              boardId={board.id}
              workspaceId={board.workspaceId}
              card={card}
              lists={board.lists}
            />
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start text-destructive"
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
          </aside>
        ) : null}
      </div>
    </>
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
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" className="w-full justify-start">
          <ArrowRightLeftIcon />
          {t('cards.move')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end">
        {open ? (
          <MoveCardForm
            boardId={boardId}
            workspaceId={workspaceId}
            card={card}
            lists={lists}
            onMoved={() => setOpen(false)}
          />
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function MoveCardForm({
  boardId,
  workspaceId,
  card,
  lists,
  onMoved,
}: {
  boardId: string;
  workspaceId: string;
  card: { id: string; listId: string };
  lists: { id: string; name: string }[];
  onMoved: () => void;
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
        onMoved();
        if (targetBoardId !== boardId) {
          void navigate({
            to: '/b/$boardId/c/$cardId',
            params: { boardId: targetBoardId, cardId: card.id },
          });
        }
      }}
    >
      <PopoverTitle>{t('cards.move')}</PopoverTitle>
      <div className="grid gap-2">
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
        <Button type="submit" disabled={!listId || listId === card.listId}>
          {t('cards.moveSubmit')}
        </Button>
      </div>
    </form>
  );
}
