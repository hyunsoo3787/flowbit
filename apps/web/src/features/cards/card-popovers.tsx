import {
  type BoardDetail,
  type Card,
  LABEL_COLORS,
  LABEL_NAME_MAX_LENGTH,
  type Label,
  type LabelColor,
} from '@flowbit/shared';
import { CheckIcon, ChevronLeftIcon, PencilIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label as FieldLabel } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import {
  newTempId,
  useCreateLabel,
  useDeleteLabel,
  useSetAssignee,
  useSetCardLabel,
  useUpdateCard,
  useUpdateLabel,
} from '@/features/boards/queries';
import { cn } from '@/lib/utils';
import { fromLocalInput, toLocalInput } from './due';
import { LABEL_STYLES } from './label-colors';

interface CardPopoverProps {
  board: BoardDetail;
  card: Card;
  trigger: ReactNode;
}

const ROW =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent';

export function MembersPopover({ board, card, trigger }: CardPopoverProps) {
  const { t } = useTranslation();
  const setAssignee = useSetAssignee(board.id);
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const people = board.members.filter(
    (member) =>
      !query ||
      member.user.name.toLowerCase().includes(query) ||
      member.user.email.toLowerCase().includes(query),
  );

  return (
    <Popover onOpenChange={() => setSearch('')}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent>
        <PopoverTitle>{t('cards.members.title')}</PopoverTitle>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('cards.members.search')}
          aria-label={t('cards.members.search')}
          className="mb-2"
        />
        <ul className="grid gap-0.5">
          {people.map(({ user }) => {
            const assigned = card.assigneeIds.includes(user.id);
            return (
              <li key={user.id}>
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={assigned}
                  className={ROW}
                  onClick={() =>
                    setAssignee.mutate({ cardId: card.id, userId: user.id, assigned: !assigned })
                  }
                >
                  <Avatar user={user} />
                  <span className="min-w-0 flex-1 truncate">{user.name}</span>
                  {assigned ? <CheckIcon className="size-4" aria-hidden /> : null}
                </button>
              </li>
            );
          })}
          {people.length === 0 ? (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">{t('cards.members.none')}</li>
          ) : null}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function LabelsPopover({ board, card, trigger }: CardPopoverProps) {
  const { t } = useTranslation();
  const setLabel = useSetCardLabel(board.id);
  const [editing, setEditing] = useState<Label | 'new' | null>(null);
  const canManage = board.role !== 'OBSERVER';

  return (
    <Popover onOpenChange={() => setEditing(null)}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent>
        {editing ? (
          <LabelEditor
            board={board}
            label={editing === 'new' ? null : editing}
            onDone={() => setEditing(null)}
          />
        ) : (
          <>
            <PopoverTitle>{t('cards.labels.title')}</PopoverTitle>
            <ul className="grid gap-1">
              {board.labels.map((label) => {
                const applied = card.labelIds.includes(label.id);
                const name = label.name || t(`labels.colors.${label.color}`);
                return (
                  <li key={label.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={applied}
                      aria-label={name}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() =>
                        setLabel.mutate({ cardId: card.id, labelId: label.id, applied: !applied })
                      }
                    >
                      <span
                        className={cn(
                          'grid size-4 shrink-0 place-items-center rounded-[4px] border',
                          applied && 'border-primary bg-primary text-primary-foreground',
                        )}
                        aria-hidden
                      >
                        {applied ? <CheckIcon className="size-3" /> : null}
                      </span>
                      <span
                        className={cn(
                          'h-8 min-w-0 flex-1 truncate rounded-sm px-2 text-left text-sm leading-8 font-medium',
                          LABEL_STYLES[label.color].chip,
                        )}
                      >
                        {label.name}
                      </span>
                    </button>
                    {canManage ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={t('cards.labels.edit', { name })}
                        onClick={() => setEditing(label)}
                      >
                        <PencilIcon />
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {canManage ? (
              <Button variant="secondary" className="mt-2 w-full" onClick={() => setEditing('new')}>
                {t('cards.labels.create')}
              </Button>
            ) : null}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function LabelEditor({
  board,
  label,
  onDone,
}: {
  board: BoardDetail;
  label: Label | null;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const createLabel = useCreateLabel(board.id);
  const updateLabel = useUpdateLabel(board.id);
  const deleteLabel = useDeleteLabel(board.id);
  const [name, setName] = useState(label?.name ?? '');
  const [color, setColor] = useState<LabelColor>(label?.color ?? 'green');

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (label) updateLabel.mutate({ labelId: label.id, name: name.trim(), color });
        else createLabel.mutate({ name: name.trim(), color, tempId: newTempId() });
        onDone();
      }}
    >
      <div className="relative">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute -top-1 left-0 size-7"
          aria-label={t('common.back')}
          onClick={onDone}
        >
          <ChevronLeftIcon />
        </Button>
        <PopoverTitle>
          {label ? t('cards.labels.editTitle') : t('cards.labels.create')}
        </PopoverTitle>
      </div>
      <div
        className={cn(
          'h-8 truncate rounded-sm px-2 text-sm leading-8 font-medium',
          LABEL_STYLES[color].chip,
        )}
      >
        {name}
      </div>
      <div className="grid gap-1.5">
        <FieldLabel htmlFor="label-name">{t('cards.labels.name')}</FieldLabel>
        <Input
          id="label-name"
          value={name}
          maxLength={LABEL_NAME_MAX_LENGTH}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
      </div>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">{t('cards.labels.color')}</legend>
        <div className="grid grid-cols-5 gap-1.5">
          {LABEL_COLORS.map((option) => (
            <label key={option} className="cursor-pointer" title={t(`labels.colors.${option}`)}>
              <input
                type="radio"
                name="label-color"
                value={option}
                checked={color === option}
                onChange={() => setColor(option)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  'grid h-7 place-items-center rounded-sm ring-offset-2 ring-offset-popover peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
                  LABEL_STYLES[option].chip,
                )}
              >
                {color === option ? <CheckIcon className="size-4" aria-hidden /> : null}
                <span className="sr-only">{t(`labels.colors.${option}`)}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center justify-between gap-2">
        <Button type="submit">
          {label ? t('common.saveChanges') : t('cards.labels.createSubmit')}
        </Button>
        {label ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            onClick={() => {
              if (window.confirm(t('cards.labels.deleteConfirm'))) {
                deleteLabel.mutate(label.id);
                onDone();
              }
            }}
          >
            {t('common.delete')}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function DatesPopover({ board, card, trigger }: CardPopoverProps) {
  const { t } = useTranslation();
  const updateCard = useUpdateCard(board.id);
  const [open, setOpen] = useState(false);
  const [startAt, setStartAt] = useState('');
  const [dueAt, setDueAt] = useState('');

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setStartAt(toLocalInput(card.startAt));
          setDueAt(toLocalInput(card.dueAt));
        }
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            updateCard.mutate({
              cardId: card.id,
              startAt: fromLocalInput(startAt),
              dueAt: fromLocalInput(dueAt),
            });
            setOpen(false);
          }}
        >
          <PopoverTitle>{t('cards.dates.title')}</PopoverTitle>
          <div className="grid gap-1.5">
            <FieldLabel htmlFor="card-start">{t('cards.dates.start')}</FieldLabel>
            <Input
              id="card-start"
              type="datetime-local"
              value={startAt}
              onChange={(event) => setStartAt(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <FieldLabel htmlFor="card-due">{t('cards.dates.due')}</FieldLabel>
            <Input
              id="card-due"
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
            />
          </div>
          <div className="flex justify-between gap-2">
            <Button type="submit">{t('common.saveChanges')}</Button>
            {card.startAt || card.dueAt ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  updateCard.mutate({
                    cardId: card.id,
                    startAt: null,
                    dueAt: null,
                    dueComplete: false,
                  });
                  setOpen(false);
                }}
              >
                {t('cards.dates.remove')}
              </Button>
            ) : null}
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export function CoverPopover({ board, card, trigger }: CardPopoverProps) {
  const { t } = useTranslation();
  const updateCard = useUpdateCard(board.id);
  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent>
        <PopoverTitle>{t('cards.cover.title')}</PopoverTitle>
        <div
          className="grid grid-cols-5 gap-1.5"
          role="radiogroup"
          aria-label={t('cards.cover.title')}
        >
          {LABEL_COLORS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={card.coverColor === option}
              aria-label={t(`labels.colors.${option}`)}
              title={t(`labels.colors.${option}`)}
              className={cn(
                'grid h-9 place-items-center rounded-sm text-white outline-none ring-offset-2 ring-offset-popover focus-visible:ring-2 focus-visible:ring-ring',
                LABEL_STYLES[option].cover,
              )}
              onClick={() => updateCard.mutate({ cardId: card.id, coverColor: option })}
            >
              {card.coverColor === option ? <CheckIcon className="size-4" aria-hidden /> : null}
            </button>
          ))}
        </div>
        {card.coverColor ? (
          <Button
            variant="secondary"
            className="mt-3 w-full"
            onClick={() => updateCard.mutate({ cardId: card.id, coverColor: null })}
          >
            {t('cards.cover.remove')}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
