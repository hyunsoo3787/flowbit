import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  type BoardDetail,
  CHECKLIST_ITEM_TEXT_MAX_LENGTH,
  CHECKLIST_TITLE_MAX_LENGTH,
  type Checklist,
  type ChecklistItem,
} from '@flowbit/shared';
import { useQuery } from '@tanstack/react-query';
import { CheckSquareIcon, ClockIcon, GripVerticalIcon, MoreHorizontalIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InlineEdit } from '@/components/inline-edit';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { Composer } from '@/features/boards/composer';
import { cn } from '@/lib/utils';
import { DUE_STYLES } from './card-badges';
import { dueStatus, formatDate, fromLocalInput, toLocalInput } from './due';
import { checklistsQuery, useChecklistMutations } from './queries';

type Mutations = ReturnType<typeof useChecklistMutations>;

/** The card's checklists, loaded with the dialog. */
export function Checklists({
  cardId,
  board,
  canEdit,
}: {
  cardId: string;
  board: BoardDetail;
  canEdit: boolean;
}) {
  const { data: checklists = [] } = useQuery(checklistsQuery(cardId));
  const mutations = useChecklistMutations(cardId);
  if (checklists.length === 0) return null;
  return (
    <div className="grid gap-6">
      {checklists.map((checklist) => (
        <ChecklistSection
          key={checklist.id}
          checklist={checklist}
          board={board}
          canEdit={canEdit}
          mutations={mutations}
        />
      ))}
    </div>
  );
}

function ChecklistSection({
  checklist,
  board,
  canEdit,
  mutations,
}: {
  checklist: Checklist;
  board: BoardDetail;
  canEdit: boolean;
  mutations: Mutations;
}) {
  const { t } = useTranslation();
  const done = checklist.items.filter((item) => item.completedAt).length;
  const total = checklist.items.length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const pending = checklist.id.startsWith('temp-');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const textOf = (id: UniqueIdentifier) =>
    checklist.items.find((item) => item.id === id)?.text ?? String(id);
  const announcements: Announcements = {
    onDragStart: ({ active }) => t('dnd.pickedUp', { item: textOf(active.id) }),
    onDragOver: ({ active, over }) =>
      over && over.id !== active.id
        ? t('dnd.over', { item: textOf(active.id), target: textOf(over.id) })
        : undefined,
    onDragEnd: ({ active }) => t('dnd.dropped', { item: textOf(active.id) }),
    onDragCancel: ({ active }) => t('dnd.cancelled', { item: textOf(active.id) }),
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const toIndex = checklist.items.findIndex((item) => item.id === over.id);
    if (toIndex === -1) return;
    mutations.moveItem.mutate({ itemId: String(active.id), checklistId: checklist.id, toIndex });
  };

  return (
    <section className="grid gap-2" aria-label={checklist.title}>
      <div className="flex items-center gap-2">
        <CheckSquareIcon className="size-4 shrink-0" aria-hidden />
        <h3 className="min-w-0 flex-1 font-semibold">
          <InlineEdit
            value={checklist.title}
            label={t('checklists.rename')}
            maxLength={CHECKLIST_TITLE_MAX_LENGTH}
            disabled={!canEdit || pending}
            onSave={(title) =>
              mutations.renameChecklist.mutate({ checklistId: checklist.id, title })
            }
          />
        </h3>
        {canEdit ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => {
              if (window.confirm(t('checklists.deleteConfirm', { title: checklist.title }))) {
                mutations.deleteChecklist.mutate(checklist.id);
              }
            }}
          >
            {t('common.delete')}
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
          {percent}%
        </span>
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={t('checklists.progress', { title: checklist.title })}
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width]',
              percent === 100 ? 'bg-green-600' : 'bg-primary',
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{
          announcements,
          screenReaderInstructions: { draggable: t('dnd.instructions') },
        }}
      >
        <SortableContext
          items={checklist.items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="grid gap-0.5">
            {checklist.items.map((item) => (
              <ChecklistItemRow
                key={item.id}
                item={item}
                board={board}
                canEdit={canEdit}
                mutations={mutations}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {canEdit && !pending ? (
        <Composer
          openLabel={t('checklists.addItem')}
          placeholder={t('checklists.itemPlaceholder')}
          submitLabel={t('checklists.addItemSubmit')}
          maxLength={CHECKLIST_ITEM_TEXT_MAX_LENGTH}
          onSubmit={(text) => mutations.addItem.mutate({ checklistId: checklist.id, text })}
          className="w-auto justify-self-start"
        />
      ) : null}
    </section>
  );
}

function ChecklistItemRow({
  item,
  board,
  canEdit,
  mutations,
}: {
  item: ChecklistItem;
  board: BoardDetail;
  canEdit: boolean;
  mutations: Mutations;
}) {
  const { t, i18n } = useTranslation();
  const pending = item.id.startsWith('temp-');
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !canEdit || pending });
  const assignee = board.members.find((member) => member.user.id === item.assigneeId)?.user;
  const status = dueStatus({ dueAt: item.dueAt, dueCompletedAt: item.completedAt });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'group flex items-start gap-2 rounded-md px-1 py-1 hover:bg-accent/60',
        isDragging && 'relative z-10 bg-card shadow-md',
      )}
    >
      {canEdit ? (
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="mt-0.5 cursor-grab text-muted-foreground opacity-40 outline-none group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t('checklists.reorder', { text: item.text })}
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon className="size-4" />
        </button>
      ) : null}
      <Checkbox
        className="mt-1"
        checked={Boolean(item.completedAt)}
        disabled={!canEdit || pending}
        aria-label={item.text}
        onCheckedChange={(checked) =>
          mutations.updateItem.mutate({ itemId: item.id, completed: checked === true })
        }
      />
      <div className="min-w-0 flex-1">
        <InlineEdit
          value={item.text}
          label={t('checklists.editItem')}
          maxLength={CHECKLIST_ITEM_TEXT_MAX_LENGTH}
          disabled={!canEdit || pending}
          multiline
          onSave={(text) => mutations.updateItem.mutate({ itemId: item.id, text })}
          className={cn('text-sm', item.completedAt && 'text-muted-foreground line-through')}
          inputClassName="resize-none text-sm"
        />
      </div>
      {status && item.dueAt ? (
        <span
          className={cn(
            'mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-sm px-1 text-xs',
            DUE_STYLES[status],
          )}
        >
          <ClockIcon className="size-3" aria-hidden />
          {formatDate(item.dueAt, i18n.language)}
        </span>
      ) : null}
      {assignee ? <Avatar user={assignee} size="xs" className="mt-0.5" /> : null}
      {canEdit && !pending ? <ItemMenu item={item} board={board} mutations={mutations} /> : null}
    </li>
  );
}

function ItemMenu({
  item,
  board,
  mutations,
}: {
  item: ChecklistItem;
  board: BoardDetail;
  mutations: Mutations;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [assigneeId, setAssigneeId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const selectClass =
    'h-9 w-full rounded-md border border-input bg-card px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setAssigneeId(item.assigneeId ?? '');
          setDueAt(toLocalInput(item.dueAt));
        }
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 opacity-60 group-hover:opacity-100"
          aria-label={t('checklists.itemOptions', { text: item.text })}
        >
          <MoreHorizontalIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end">
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            mutations.updateItem.mutate({
              itemId: item.id,
              assigneeId: assigneeId || null,
              dueAt: fromLocalInput(dueAt),
            });
            setOpen(false);
          }}
        >
          <PopoverTitle>{t('checklists.itemOptionsTitle')}</PopoverTitle>
          <div className="grid gap-1.5">
            <Label htmlFor="item-assignee">{t('checklists.assignee')}</Label>
            <select
              id="item-assignee"
              className={selectClass}
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
            >
              <option value="">{t('checklists.nobody')}</option>
              {board.members.map(({ user }) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="item-due">{t('cards.dates.due')}</Label>
            <Input
              id="item-due"
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
            />
          </div>
          <div className="flex justify-between gap-2">
            <Button type="submit">{t('common.saveChanges')}</Button>
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              onClick={() => {
                mutations.deleteItem.mutate(item.id);
                setOpen(false);
              }}
            >
              {t('common.delete')}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** "Add checklist": asks for a title, then creates it. */
export function AddChecklistPopover({ cardId, trigger }: { cardId: string; trigger: ReactNode }) {
  const { t } = useTranslation();
  const { createChecklist } = useChecklistMutations(cardId);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setTitle(t('checklists.defaultTitle'));
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = title.trim();
            if (!trimmed) return;
            createChecklist.mutate({ title: trimmed });
            setOpen(false);
          }}
        >
          <PopoverTitle>{t('checklists.add')}</PopoverTitle>
          <div className="grid gap-1.5">
            <Label htmlFor="checklist-title">{t('checklists.title')}</Label>
            <Input
              id="checklist-title"
              value={title}
              maxLength={CHECKLIST_TITLE_MAX_LENGTH}
              onChange={(event) => setTitle(event.target.value)}
              onFocus={(event) => event.target.select()}
              autoFocus
            />
          </div>
          <Button type="submit">{t('checklists.addSubmit')}</Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
