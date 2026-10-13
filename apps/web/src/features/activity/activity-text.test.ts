import type { Activity, BoardDetail } from '@flowbit/shared';
import i18n, { type TFunction } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import en from '@/i18n/locales/en.json';
import { activityText } from './activity-text';

const board = {
  lists: [
    { id: 'l1', name: 'To do' },
    { id: 'l2', name: 'Done' },
  ],
  labels: [{ id: 'red', boardId: 'b', name: '', color: 'red', version: 1 }],
  members: [
    { user: { id: 'u2', name: 'Bob', email: 'b@x', image: null }, role: 'MEMBER', boardRole: null },
  ],
} as unknown as Pick<BoardDetail, 'lists' | 'labels' | 'members'>;

const activity = (type: string, payload: Record<string, unknown> = {}): Activity => ({
  id: 'a',
  type,
  actor: { id: 'u1', name: 'Ann', email: 'a@x', image: null },
  card: { id: 'c', title: 'Ship it' },
  payload,
  createdAt: '2026-10-13T00:00:00Z',
});

beforeAll(async () => {
  await i18n.init({ lng: 'en', resources: { en: { translation: en } } });
});

describe('activityText', () => {
  const t = i18n.t.bind(i18n) as TFunction;

  it('names lists, labels and people from the board', () => {
    expect(
      activityText(t, activity('card.moved', { fromListId: 'l1', toListId: 'l2' }), board),
    ).toBe('Ann moved Ship it from To do to Done');
    expect(activityText(t, activity('card.labeled', { labelId: 'red' }), board)).toBe(
      'Ann added the label Red to Ship it',
    );
    expect(activityText(t, activity('card.assigned', { userId: 'u2' }), board)).toBe(
      'Ann added Bob to Ship it',
    );
    expect(activityText(t, activity('card.assigned', { userId: 'u1' }), board)).toBe(
      'Ann joined Ship it',
    );
  });

  it('says "this card" inside the card', () => {
    expect(
      activityText(t, activity('card.updated', { fields: ['dueAt'] }), board, { inCard: true }),
    ).toBe('Ann changed the due date of this card');
  });

  it('falls back for unknown types', () => {
    expect(activityText(t, activity('something.new'), board)).toBe('Ann made a change');
  });
});
