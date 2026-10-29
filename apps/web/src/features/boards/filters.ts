import type { Card, Label } from '@flowbit/shared';
import { z } from 'zod';

export const DUE_FILTERS = ['overdue', 'day', 'week', 'none', 'complete'] as const;
export type DueFilter = (typeof DUE_FILTERS)[number];

/** Special values: cards without labels, without members, assigned to the viewer. */
export const NONE = 'none';
export const ME = 'me';

export interface BoardFilter {
  q?: string;
  labels?: string[];
  members?: string[];
  due?: DueFilter[];
}

const list = z
  .string()
  .optional()
  .transform((value) => (value ? value.split(',').filter(Boolean) : undefined));

/** The board route's search params: comma-separated, so URLs stay readable and shareable. */
export const boardSearchSchema = z.object({
  q: z.string().max(200).optional().catch(undefined),
  labels: list.catch(undefined),
  members: list.catch(undefined),
  due: list
    .transform((values) =>
      values?.filter((value): value is DueFilter =>
        (DUE_FILTERS as readonly string[]).includes(value),
      ),
    )
    .catch(undefined),
});
export type BoardSearch = z.input<typeof boardSearchSchema>;

/** Search params for a filter, without empty entries. */
export function toSearch(filter: BoardFilter): BoardSearch {
  const join = (values?: string[]) => (values && values.length > 0 ? values.join(',') : undefined);
  return {
    q: filter.q?.trim() ? filter.q : undefined,
    labels: join(filter.labels),
    members: join(filter.members),
    due: join(filter.due),
  };
}

export function activeFilterCount(filter: BoardFilter): number {
  return (
    (filter.q?.trim() ? 1 : 0) +
    (filter.labels?.length ?? 0) +
    (filter.members?.length ?? 0) +
    (filter.due?.length ?? 0)
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

function matchesDue(card: Card, due: DueFilter, now: number) {
  const dueAt = card.dueAt ? Date.parse(card.dueAt) : null;
  switch (due) {
    case 'none':
      return dueAt === null;
    case 'complete':
      return dueAt !== null && card.dueCompletedAt !== null;
    case 'overdue':
      return dueAt !== null && !card.dueCompletedAt && dueAt < now;
    case 'day':
      return dueAt !== null && !card.dueCompletedAt && dueAt >= now && dueAt - now <= DAY_MS;
    case 'week':
      return dueAt !== null && !card.dueCompletedAt && dueAt >= now && dueAt - now <= 7 * DAY_MS;
  }
}

/**
 * Whether a card passes the filter. Within a group (labels, members, due)
 * any choice matches; across groups, all must match.
 */
export function matchesFilter(
  card: Card,
  filter: BoardFilter,
  context: { meId: string | undefined; labels: Label[]; now?: number },
): boolean {
  const q = filter.q?.trim().toLowerCase();
  if (q) {
    const names = context.labels
      .filter((label) => card.labelIds.includes(label.id))
      .map((label) => label.name.toLowerCase());
    const haystack = [card.title.toLowerCase(), card.description.toLowerCase(), ...names];
    if (!haystack.some((text) => text.includes(q))) return false;
  }
  if (filter.labels?.length) {
    const ok = filter.labels.some((id) =>
      id === NONE ? card.labelIds.length === 0 : card.labelIds.includes(id),
    );
    if (!ok) return false;
  }
  if (filter.members?.length) {
    const ok = filter.members.some((id) => {
      if (id === NONE) return card.assigneeIds.length === 0;
      const userId = id === ME ? context.meId : id;
      return userId !== undefined && card.assigneeIds.includes(userId);
    });
    if (!ok) return false;
  }
  if (filter.due?.length) {
    const now = context.now ?? Date.now();
    if (!filter.due.some((due) => matchesDue(card, due, now))) return false;
  }
  return true;
}
