import type { Card } from '@flowbit/shared';
import { describe, expect, it } from 'vitest';
import { activeFilterCount, boardSearchSchema, matchesFilter, toSearch } from './filters';

const NOW = Date.parse('2026-10-13T12:00:00Z');
const base: Card = {
  id: 'c1',
  boardId: 'b1',
  listId: 'l1',
  title: 'Write docs',
  description: 'For the API',
  position: 'a0',
  startAt: null,
  dueAt: null,
  dueCompletedAt: null,
  coverColor: null,
  assigneeIds: [],
  labelIds: [],
  badges: { comments: 0, checklistItems: 0, checklistItemsDone: 0 },
  version: 1,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};
const labels = [{ id: 'red', boardId: 'b1', name: 'Urgent', color: 'red' as const, version: 1 }];
const context = { meId: 'me-id', labels, now: NOW };
const card = (extra: Partial<Card>) => ({ ...base, ...extra });

describe('matchesFilter', () => {
  it('matches keywords in title, description and label names', () => {
    expect(matchesFilter(base, { q: 'DOCS' }, context)).toBe(true);
    expect(matchesFilter(base, { q: 'api' }, context)).toBe(true);
    expect(matchesFilter(card({ labelIds: ['red'] }), { q: 'urgent' }, context)).toBe(true);
    expect(matchesFilter(base, { q: 'missing' }, context)).toBe(false);
  });

  it('matches any chosen label, or cards without labels', () => {
    expect(matchesFilter(card({ labelIds: ['red'] }), { labels: ['red', 'blue'] }, context)).toBe(
      true,
    );
    expect(matchesFilter(base, { labels: ['red'] }, context)).toBe(false);
    expect(matchesFilter(base, { labels: ['none'] }, context)).toBe(true);
  });

  it('matches members, "me" and unassigned cards', () => {
    const mine = card({ assigneeIds: ['me-id'] });
    expect(matchesFilter(mine, { members: ['me'] }, context)).toBe(true);
    expect(matchesFilter(mine, { members: ['someone'] }, context)).toBe(false);
    expect(matchesFilter(base, { members: ['none'] }, context)).toBe(true);
  });

  it('matches due dates by urgency', () => {
    const overdue = card({ dueAt: '2026-10-12T00:00:00Z' });
    const tomorrow = card({ dueAt: '2026-10-14T06:00:00Z' });
    const nextWeek = card({ dueAt: '2026-10-18T00:00:00Z' });
    const done = card({ dueAt: '2026-10-12T00:00:00Z', dueCompletedAt: '2026-10-12T01:00:00Z' });
    expect(matchesFilter(overdue, { due: ['overdue'] }, context)).toBe(true);
    expect(matchesFilter(done, { due: ['overdue'] }, context)).toBe(false);
    expect(matchesFilter(done, { due: ['complete'] }, context)).toBe(true);
    expect(matchesFilter(tomorrow, { due: ['day'] }, context)).toBe(true);
    expect(matchesFilter(nextWeek, { due: ['day'] }, context)).toBe(false);
    expect(matchesFilter(nextWeek, { due: ['week'] }, context)).toBe(true);
    expect(matchesFilter(base, { due: ['none'] }, context)).toBe(true);
  });

  it('requires every group to match', () => {
    const filter = { labels: ['red'], members: ['me'] };
    expect(matchesFilter(card({ labelIds: ['red'] }), filter, context)).toBe(false);
    expect(
      matchesFilter(card({ labelIds: ['red'], assigneeIds: ['me-id'] }), filter, context),
    ).toBe(true);
  });
});

describe('search params', () => {
  it('round-trips through comma-separated params and drops unknown values', () => {
    const search = toSearch({ q: 'x', labels: ['a', 'b'], members: [], due: ['overdue'] });
    expect(search).toEqual({ q: 'x', labels: 'a,b', members: undefined, due: 'overdue' });
    const parsed = boardSearchSchema.parse({ ...search, due: 'overdue,bogus' });
    expect(parsed).toEqual({ q: 'x', labels: ['a', 'b'], members: undefined, due: ['overdue'] });
    expect(activeFilterCount(parsed)).toBe(4);
  });
});
