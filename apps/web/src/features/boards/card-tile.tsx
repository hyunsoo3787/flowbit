import type { Card } from '@flowbit/shared';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link } from '@tanstack/react-router';
import { AlignLeftIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export function CardTileContent({ card, dragging }: { card: Card; dragging?: boolean }) {
  return (
    <div
      className={cn(
        'grid gap-1 rounded-lg border bg-card px-3 py-2 text-sm text-card-foreground shadow-xs',
        dragging && 'rotate-2 shadow-lg ring-2 ring-primary/40',
      )}
    >
      <span className="break-words">{card.title}</span>
      {card.description ? (
        <AlignLeftIcon className="size-3.5 text-muted-foreground" aria-hidden />
      ) : null}
    </div>
  );
}

/**
 * A card on the board. It is a link to the card dialog (Enter opens it) and,
 * when the board is editable, a drag handle (Space picks it up).
 */
export function CardTile({ card, disabled }: { card: Card; disabled: boolean }) {
  const { t } = useTranslation();
  const pending = card.id.startsWith('temp-');
  const {
    attributes: { role: _role, ...attributes },
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { type: 'card', title: card.title },
    disabled: disabled || pending,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(isDragging && 'opacity-40')}
    >
      <Link
        to="/b/$boardId/c/$cardId"
        params={{ boardId: card.boardId, cardId: card.id }}
        aria-label={t('cards.openCard', { title: card.title })}
        disabled={pending}
        className="block rounded-lg outline-none hover:brightness-[0.97] focus-visible:ring-[3px] focus-visible:ring-ring/60 dark:hover:brightness-110"
        {...attributes}
        {...listeners}
      >
        <CardTileContent card={card} />
      </Link>
    </li>
  );
}
