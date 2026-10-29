import type { BoardDetail } from '@flowbit/shared';
import { FilterIcon, XIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { LABEL_STYLES } from '@/features/cards/label-colors';
import { cn } from '@/lib/utils';
import { activeFilterCount, type BoardFilter, DUE_FILTERS, ME, NONE } from './filters';

function toggle<T>(values: T[] | undefined, value: T, on: boolean): T[] {
  const rest = (values ?? []).filter((item) => item !== value);
  return on ? [...rest, value] : rest;
}

function Option({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-accent">
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      {children}
    </label>
  );
}

/** The board's filter: keyword, labels, members and due dates. */
export function BoardFilterButton({
  board,
  filter,
  onChange,
  className,
}: {
  board: BoardDetail;
  filter: BoardFilter;
  onChange: (filter: BoardFilter) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const count = activeFilterCount(filter);

  return (
    <div className="flex items-center">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(className, count > 0 && 'bg-current/15')}
            aria-label={count > 0 ? t('filters.buttonActive', { count }) : t('filters.button')}
          >
            <FilterIcon />
            <span className="hidden sm:inline">{t('filters.button')}</span>
            {count > 0 ? (
              <span className="rounded-full bg-current/20 px-1.5 text-xs">{count}</span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80">
          <PopoverTitle>{t('filters.title')}</PopoverTitle>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Input
                value={filter.q ?? ''}
                onChange={(event) => onChange({ ...filter, q: event.target.value })}
                placeholder={t('filters.keywordPlaceholder')}
                aria-label={t('filters.keyword')}
              />
            </div>

            <fieldset className="grid gap-0.5">
              <legend className="mb-1 text-xs font-semibold text-muted-foreground">
                {t('filters.members')}
              </legend>
              <Option
                checked={filter.members?.includes(NONE) ?? false}
                onChange={(on) =>
                  onChange({ ...filter, members: toggle(filter.members, NONE, on) })
                }
              >
                {t('filters.noMembers')}
              </Option>
              <Option
                checked={filter.members?.includes(ME) ?? false}
                onChange={(on) => onChange({ ...filter, members: toggle(filter.members, ME, on) })}
              >
                {t('filters.assignedToMe')}
              </Option>
              {board.members.map(({ user }) => (
                <Option
                  key={user.id}
                  checked={filter.members?.includes(user.id) ?? false}
                  onChange={(on) =>
                    onChange({ ...filter, members: toggle(filter.members, user.id, on) })
                  }
                >
                  <Avatar user={user} size="xs" />
                  <span className="truncate">{user.name}</span>
                </Option>
              ))}
            </fieldset>

            <fieldset className="grid gap-0.5">
              <legend className="mb-1 text-xs font-semibold text-muted-foreground">
                {t('filters.due')}
              </legend>
              {DUE_FILTERS.map((due) => (
                <Option
                  key={due}
                  checked={filter.due?.includes(due) ?? false}
                  onChange={(on) => onChange({ ...filter, due: toggle(filter.due, due, on) })}
                >
                  {t(`filters.dueOptions.${due}`)}
                </Option>
              ))}
            </fieldset>

            <fieldset className="grid gap-0.5">
              <legend className="mb-1 text-xs font-semibold text-muted-foreground">
                {t('filters.labels')}
              </legend>
              <Option
                checked={filter.labels?.includes(NONE) ?? false}
                onChange={(on) => onChange({ ...filter, labels: toggle(filter.labels, NONE, on) })}
              >
                {t('filters.noLabels')}
              </Option>
              {board.labels.map((label) => (
                <Option
                  key={label.id}
                  checked={filter.labels?.includes(label.id) ?? false}
                  onChange={(on) =>
                    onChange({ ...filter, labels: toggle(filter.labels, label.id, on) })
                  }
                >
                  <span
                    className={cn(
                      'h-6 min-w-0 flex-1 truncate rounded-sm px-2 text-xs leading-6 font-medium',
                      LABEL_STYLES[label.color].chip,
                    )}
                  >
                    {label.name || t(`labels.colors.${label.color}`)}
                  </span>
                </Option>
              ))}
            </fieldset>
          </div>
        </PopoverContent>
      </Popover>
      {count > 0 ? (
        <Button
          variant="ghost"
          size="icon"
          className={cn('size-8', className)}
          aria-label={t('filters.clear')}
          onClick={() => onChange({})}
        >
          <XIcon />
        </Button>
      ) : null}
    </div>
  );
}
