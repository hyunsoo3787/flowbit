import type { Activity, BoardDetail } from '@flowbit/shared';
import type { TFunction } from 'i18next';

type Board = Pick<BoardDetail, 'lists' | 'labels' | 'members'>;

const CARD_FIELDS = [
  'dueComplete',
  'dueAt',
  'startAt',
  'title',
  'description',
  'coverColor',
] as const;

/**
 * One sentence for an activity entry, e.g. "Ann moved Ship it from To do to
 * Done". Names of lists, labels and people come from the board as it is now.
 * Inside a card's own history, the card is called "this card".
 */
export function activityText(
  t: TFunction,
  activity: Activity,
  board: Board,
  options: { inCard?: boolean } = {},
): string {
  const p = activity.payload;
  const text = (key: string) => (typeof p[key] === 'string' ? (p[key] as string) : '');
  const actor = activity.actor?.name ?? t('activity.someone');
  const card = options.inCard
    ? t('activity.thisCard')
    : (activity.card?.title ?? (text('title') || t('activity.aCard')));
  const listName = (id: string) =>
    board.lists.find((list) => list.id === id)?.name ?? t('activity.aList');
  const labelName = (id: string) => {
    const label = board.labels.find((candidate) => candidate.id === id);
    return label ? label.name || t(`labels.colors.${label.color}`) : t('activity.aLabel');
  };
  const person = (id: string) =>
    board.members.find((member) => member.user.id === id)?.user.name ?? t('activity.someone');

  switch (activity.type) {
    case 'board.created':
      return t('activity.types.boardCreated', { actor });
    case 'board.updated':
      return t('activity.types.boardUpdated', { actor });
    case 'list.created':
      return t('activity.types.listCreated', { actor, list: text('name') });
    case 'list.updated':
      return t('activity.types.listRenamed', { actor, list: text('name') });
    case 'list.moved':
      return t('activity.types.listMoved', { actor, list: listName(text('listId')) });
    case 'list.deleted':
      return t('activity.types.listDeleted', { actor, list: text('name') });
    case 'card.created':
      return t('activity.types.cardCreated', { actor, card, list: listName(text('listId')) });
    case 'card.moved':
      return t('activity.types.cardMoved', {
        actor,
        card,
        from: listName(text('fromListId')),
        to: listName(text('toListId')),
      });
    case 'card.deleted':
      return t('activity.types.cardDeleted', { actor, card: text('title') });
    case 'card.updated': {
      const fields = Array.isArray(p['fields']) ? (p['fields'] as string[]) : [];
      const field = CARD_FIELDS.find((candidate) => fields.includes(candidate));
      return field
        ? t(`activity.types.cardUpdated.${field}`, { actor, card })
        : t('activity.types.cardUpdated.other', { actor, card });
    }
    case 'card.assigned':
      return text('userId') === activity.actor?.id
        ? t('activity.types.cardJoined', { actor, card })
        : t('activity.types.cardAssigned', { actor, card, person: person(text('userId')) });
    case 'card.unassigned':
      return t('activity.types.cardUnassigned', { actor, card, person: person(text('userId')) });
    case 'card.labeled':
      return t('activity.types.cardLabeled', { actor, card, label: labelName(text('labelId')) });
    case 'card.unlabeled':
      return t('activity.types.cardUnlabeled', { actor, card, label: labelName(text('labelId')) });
    case 'checklist.created':
      return t('activity.types.checklistCreated', { actor, card, checklist: text('title') });
    case 'checklist.deleted':
      return t('activity.types.checklistDeleted', { actor, card, checklist: text('title') });
    case 'checklist.item.completed':
      return t('activity.types.itemCompleted', { actor, card, item: text('text') });
    case 'checklist.item.reopened':
      return t('activity.types.itemReopened', { actor, card, item: text('text') });
    case 'comment.created':
      return t('activity.types.commented', { actor, card });
    default:
      return t('activity.types.other', { actor });
  }
}
