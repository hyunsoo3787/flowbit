import type { Card } from '@flowbit/shared';

export type DueStatus = 'complete' | 'overdue' | 'soon' | 'later';

const DAY_MS = 24 * 60 * 60 * 1000;

/** How urgent a card's due date is: overdue, due within a day, later, or done. */
export function dueStatus(
  card: Pick<Card, 'dueAt' | 'dueCompletedAt'>,
  now = Date.now(),
): DueStatus | null {
  if (!card.dueAt) return null;
  if (card.dueCompletedAt) return 'complete';
  const due = Date.parse(card.dueAt);
  if (due < now) return 'overdue';
  if (due - now <= DAY_MS) return 'soon';
  return 'later';
}

/** A short, localized date, with the time when it isn't midnight. */
export function formatDate(iso: string, locale: string, options: { withYear?: boolean } = {}) {
  const date = new Date(iso);
  const withTime = date.getHours() !== 0 || date.getMinutes() !== 0;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    ...(options.withYear || !sameYear ? { year: 'numeric' } : {}),
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(date);
}

/** `<input type="datetime-local">` value for an ISO date, in local time. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The ISO date for a `datetime-local` value, or null when empty. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
