import type { BoardDetail, Card } from '@flowbit/shared';
import { AlignLeftIcon, CheckSquareIcon, ClockIcon, MessageSquareIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AvatarStack } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { type DueStatus, dueStatus, formatDate } from './due';
import { LABEL_STYLES } from './label-colors';

export const DUE_STYLES: Record<DueStatus, string> = {
  complete: 'bg-green-600 text-white',
  overdue: 'bg-red-600 text-white',
  soon: 'bg-amber-400 text-amber-950',
  later: 'text-muted-foreground',
};

/** The card's labels as small colored chips, with names when they have one. */
export function CardLabels({ card, labels }: { card: Card; labels: BoardDetail['labels'] }) {
  const applied = labels.filter((label) => card.labelIds.includes(label.id));
  if (applied.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1">
      {applied.map((label) => (
        <li
          key={label.id}
          className={cn(
            'h-4 min-w-10 truncate rounded-sm px-1.5 text-[10px] leading-4 font-semibold',
            LABEL_STYLES[label.color].chip,
            !label.name && 'w-10',
          )}
          title={label.name || undefined}
        >
          {label.name}
        </li>
      ))}
    </ul>
  );
}

/** Small indicators at the bottom of a card on the board. */
export function CardBadges({ card, members }: { card: Card; members: BoardDetail['members'] }) {
  const { t, i18n } = useTranslation();
  const status = dueStatus(card);
  const assignees = card.assigneeIds.flatMap((id) => {
    const member = members.find((candidate) => candidate.user.id === id);
    return member ? [member.user] : [];
  });
  const { comments, checklistItems, checklistItemsDone } = card.badges;
  const hasBadges =
    status || card.description || comments > 0 || checklistItems > 0 || assignees.length > 0;
  if (!hasBadges) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      {status && card.dueAt ? (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-sm px-1 py-0.5',
            DUE_STYLES[status],
          )}
          title={t(`cards.due.${status}`)}
        >
          <ClockIcon className="size-3" aria-hidden />
          {formatDate(card.dueAt, i18n.language)}
          <span className="sr-only">{t(`cards.due.${status}`)}</span>
        </span>
      ) : null}
      {card.description ? (
        <AlignLeftIcon className="size-3.5" aria-label={t('cards.hasDescription')} />
      ) : null}
      {comments > 0 ? (
        <span
          className="inline-flex items-center gap-1"
          title={t('cards.commentCount', { count: comments })}
        >
          <MessageSquareIcon className="size-3.5" aria-hidden />
          {comments}
          <span className="sr-only">{t('cards.commentCount', { count: comments })}</span>
        </span>
      ) : null}
      {checklistItems > 0 ? (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-sm px-1 py-0.5',
            checklistItemsDone === checklistItems && 'bg-green-600 text-white',
          )}
          title={t('cards.checklistProgress', { done: checklistItemsDone, total: checklistItems })}
        >
          <CheckSquareIcon className="size-3.5" aria-hidden />
          {checklistItemsDone}/{checklistItems}
        </span>
      ) : null}
      {assignees.length > 0 ? (
        <span className="ml-auto">
          <AvatarStack users={assignees} max={3} size="xs" />
        </span>
      ) : null}
    </div>
  );
}
