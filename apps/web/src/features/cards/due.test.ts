import { describe, expect, it } from 'vitest';
import { dueStatus, fromLocalInput, toLocalInput } from './due';

const NOW = Date.parse('2026-10-13T12:00:00Z');

describe('dueStatus', () => {
  it('rates due dates by urgency', () => {
    expect(dueStatus({ dueAt: null, dueCompletedAt: null }, NOW)).toBeNull();
    expect(dueStatus({ dueAt: '2026-10-13T11:00:00Z', dueCompletedAt: null }, NOW)).toBe('overdue');
    expect(dueStatus({ dueAt: '2026-10-14T11:00:00Z', dueCompletedAt: null }, NOW)).toBe('soon');
    expect(dueStatus({ dueAt: '2026-10-20T11:00:00Z', dueCompletedAt: null }, NOW)).toBe('later');
    expect(
      dueStatus({ dueAt: '2026-10-01T11:00:00Z', dueCompletedAt: '2026-10-02T00:00:00Z' }, NOW),
    ).toBe('complete');
  });
});

describe('local date inputs', () => {
  it('round-trips through the datetime-local format', () => {
    const iso = new Date(2026, 9, 13, 9, 30).toISOString();
    expect(toLocalInput(iso)).toBe('2026-10-13T09:30');
    expect(fromLocalInput('2026-10-13T09:30')).toBe(iso);
    expect(fromLocalInput('')).toBeNull();
    expect(toLocalInput(null)).toBe('');
  });
});
