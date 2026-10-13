import type { BoardDetail, Card } from '@flowbit/shared';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { CardBadges, CardLabels } from '@/features/cards/card-badges';
import { LABEL_STYLES } from '@/features/cards/label-colors';
import { cn } from '@/lib/utils';

export function CardTileContent({
  card,
  board,
  dragging,
}: {
  card: Card;
  board: Pick<BoardDetail, 'labels' | 'members'>;
  dragging?: boolean;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border bg-card text-sm text-card-foreground shadow-xs',
        dragging && 'rotate-2 shadow-lg ring-2 ring-primary/40',
      )}
    >
      {card.coverColor ? (
        <div className={cn('h-8', LABEL_STYLES[card.coverColor].cover)} aria-hidden />
      ) : null}
      <div className="grid gap-1.5 px-3 py-2">
        <CardLabels card={card} labels={board.labels} />
        <span className="break-words">{card.title}</span>
        <CardBadges card={card} members={board.members} />
      </div>
    </div>
  );
}

/**
 * A card on the board. It is a link to the card dialog (Enter opens it) and,
 * when the board is editable, a drag handle (Space picks it up).
 */
export function CardTile({
  card,
  board,
  disabled,
}: {
  card: Card;
  board: Pick<BoardDetail, 'labels' | 'members'>;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const pending = card.id.startsWith('temp-');
  const sortable = useSortable({
    id: card.id,
    data: { type: 'card', title: card.title },
    disabled: disabled || pending,
  });
  const { setNodeRef, transform, transition, isDragging } = sortable;
  // Without dragging (observers, a filtered board) the card is a plain link:
  // dnd-kit's attributes would announce it as a disabled sortable item.
  const { role: _role, ...attributes } = sortable.attributes;
  const dragProps = disabled || pending ? {} : { ...attributes, ...sortable.listeners };

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(isDragging && 'opacity-40')}
    >
      <Link
        to="/b/$boardId/c/$cardId"
        params={{ boardId: card.boardId, cardId: card.id }}
        // Keep the board's filter while the card is open.
        search={true}
        aria-label={t('cards.openCard', { title: card.title })}
        disabled={pending}
        className="block rounded-lg outline-none hover:brightness-[0.97] focus-visible:ring-[3px] focus-visible:ring-ring/60 dark:hover:brightness-110"
        {...dragProps}
      >
        <CardTileContent card={card} board={board} />
      </Link>
    </li>
  );
}
