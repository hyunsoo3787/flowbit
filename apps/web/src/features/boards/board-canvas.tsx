import { type BoardDetail, LIST_NAME_MAX_LENGTH } from '@flowbit/shared';
import {
  type Announcements,
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CardTileContent } from './card-tile';
import { Composer } from './composer';
import { ListColumn } from './list-column';
import { boardColumns, newTempId, useCreateList, useMoveCard, useMoveList } from './queries';

/** Card ids per list id, in display order. */
type Columns = Record<string, string[]>;

type Active = { type: 'card' | 'list'; id: string } | null;

function toColumns(board: BoardDetail): Columns {
  return Object.fromEntries(
    boardColumns(board).map(({ list, cards }) => [list.id, cards.map((card) => card.id)]),
  );
}

/** The list a card or drop target belongs to, in the given layout. */
function containerOf(columns: Columns, id: UniqueIdentifier, data?: { listId?: string }) {
  if (data?.listId) return data.listId;
  const key = String(id);
  if (key in columns) return key;
  return Object.keys(columns).find((listId) => columns[listId]!.includes(key));
}

export function BoardCanvas({ board }: { board: BoardDetail }) {
  const { t } = useTranslation();
  const canEdit = board.role !== 'OBSERVER';
  const columns = useMemo(() => boardColumns(board), [board]);
  const serverColumns = useMemo(() => toColumns(board), [board]);
  const listIds = columns.map(({ list }) => list.id);
  const cardsById = useMemo(() => new Map(board.cards.map((card) => [card.id, card])), [board]);

  // While a card is dragged across lists, its live position is kept here.
  const [dragColumns, setDragColumns] = useState<Columns | null>(null);
  const [active, setActive] = useState<Active>(null);
  const layout = dragColumns ?? serverColumns;

  const moveCard = useMoveCard(board.id);
  const moveList = useMoveList(board.id);
  const createList = useCreateList(board.id);

  const sensors = useSensors(
    // A small distance keeps plain clicks working (open card, rename list).
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    // Space picks up; Enter is left for opening the card.
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  );

  const nameOf = (id: UniqueIdentifier, data?: { title?: string }) => data?.title ?? String(id);
  const announcements: Announcements = {
    onDragStart: ({ active: item }) =>
      t('dnd.pickedUp', { item: nameOf(item.id, item.data.current) }),
    onDragOver: ({ active: item, over }) =>
      over
        ? t('dnd.over', {
            item: nameOf(item.id, item.data.current),
            target: nameOf(over.id, over.data.current),
          })
        : undefined,
    onDragEnd: ({ active: item }) => t('dnd.dropped', { item: nameOf(item.id, item.data.current) }),
    onDragCancel: ({ active: item }) =>
      t('dnd.cancelled', { item: nameOf(item.id, item.data.current) }),
  };

  const onDragStart = ({ active: item }: DragStartEvent) => {
    const type = item.data.current?.['type'] === 'list' ? 'list' : 'card';
    setActive({ type, id: String(item.id) });
    if (type === 'card') setDragColumns(serverColumns);
  };

  const onDragOver = ({ active: item, over }: DragOverEvent) => {
    if (active?.type !== 'card' || !over) return;
    setDragColumns((current) => {
      if (!current) return current;
      const from = containerOf(current, item.id);
      const to = containerOf(current, over.id, over.data.current);
      if (!from || !to || from === to) return current;
      const target = current[to]!;
      const overIndex = target.indexOf(String(over.id));
      const index = overIndex === -1 ? target.length : overIndex;
      return {
        ...current,
        [from]: current[from]!.filter((id) => id !== item.id),
        [to]: [...target.slice(0, index), String(item.id), ...target.slice(index)],
      };
    });
  };

  const reset = () => {
    setDragColumns(null);
    setActive(null);
  };

  const onDragEnd = ({ active: item, over }: DragEndEvent) => {
    if (active?.type === 'list') {
      const overList = over ? containerOf(serverColumns, over.id, over.data.current) : undefined;
      const from = listIds.indexOf(String(item.id));
      const to = overList ? listIds.indexOf(overList) : -1;
      if (from !== -1 && to !== -1 && from !== to) {
        moveList.mutate({ listId: String(item.id), toIndex: to });
      }
      reset();
      return;
    }

    const current = dragColumns ?? serverColumns;
    const cardId = String(item.id);
    const listId = containerOf(current, cardId);
    if (!listId || !over) return reset();

    let order = current[listId]!;
    const overIndex = order.indexOf(String(over.id));
    const fromIndex = order.indexOf(cardId);
    if (overIndex !== -1 && overIndex !== fromIndex) order = arrayMove(order, fromIndex, overIndex);
    const toIndex = order.indexOf(cardId);

    const original = cardsById.get(cardId);
    const originalIndex = original ? serverColumns[original.listId]!.indexOf(cardId) : -1;
    if (original && (original.listId !== listId || originalIndex !== toIndex)) {
      moveCard.mutate({ cardId, toListId: listId, toIndex });
    }
    reset();
  };

  const activeCard = active?.type === 'card' ? cardsById.get(active.id) : undefined;
  const activeList =
    active?.type === 'list' ? columns.find(({ list }) => list.id === active.id) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={reset}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: t('dnd.instructions') },
      }}
    >
      <div className="flex h-full items-start gap-3 overflow-x-auto px-4 pb-4 sm:px-6">
        <SortableContext items={listIds} strategy={horizontalListSortingStrategy}>
          {columns.map(({ list }) => (
            <ListColumn
              key={list.id}
              board={board}
              list={list}
              cards={(layout[list.id] ?? []).flatMap((id) => {
                const card = cardsById.get(id);
                return card ? [card] : [];
              })}
              canEdit={canEdit}
            />
          ))}
        </SortableContext>

        {canEdit ? (
          <div className="w-72 shrink-0 rounded-xl bg-muted/80 p-2">
            <Composer
              openLabel={columns.length === 0 ? t('lists.add') : t('lists.addAnother')}
              placeholder={t('lists.namePlaceholder')}
              submitLabel={t('lists.submit')}
              maxLength={LIST_NAME_MAX_LENGTH}
              onSubmit={(name) => createList.mutate({ name, tempId: newTempId() })}
            />
          </div>
        ) : null}
      </div>

      <DragOverlay>
        {activeCard ? (
          <div className="w-68">
            <CardTileContent card={activeCard} dragging />
          </div>
        ) : activeList ? (
          <div className="w-72 rotate-1 rounded-xl bg-muted p-3 font-semibold shadow-lg ring-2 ring-primary/40">
            {activeList.list.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
