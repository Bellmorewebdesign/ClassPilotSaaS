import { describe, expect, it } from 'vitest';
import { normalizeIsoDate, parseDueLabel } from './dates.js';

/** Fixed "now" so every relative assertion is deterministic. */
const NOW = new Date(2026, 8, 20, 14, 0, 0); // Sun 20 Sep 2026, 14:00 local

describe('normalizeIsoDate', () => {
  it('accepts ISO strings and Date objects', () => {
    expect(normalizeIsoDate('2026-09-24T23:59:00.000Z', NOW)?.toISOString()).toBe(
      '2026-09-24T23:59:00.000Z',
    );
    expect(normalizeIsoDate(new Date(NOW), NOW)?.getTime()).toBe(NOW.getTime());
  });

  it('rejects unparseable values', () => {
    expect(normalizeIsoDate('not a date', NOW)).toBeNull();
    expect(normalizeIsoDate('', NOW)).toBeNull();
    expect(normalizeIsoDate(null, NOW)).toBeNull();
    expect(normalizeIsoDate({}, NOW)).toBeNull();
  });

  it('rejects instants implausibly far from now (bad parse guard)', () => {
    expect(normalizeIsoDate('1970-01-01T00:00:00Z', NOW)).toBeNull();
    expect(normalizeIsoDate('2999-01-01T00:00:00Z', NOW)).toBeNull();
  });
});

describe('parseDueLabel', () => {
  it('parses an explicit month/day with a 12-hour time', () => {
    const { dueAt, allDay } = parseDueLabel('Due Sep 24, 11:59 PM', NOW);
    expect(dueAt?.getMonth()).toBe(8);
    expect(dueAt?.getDate()).toBe(24);
    expect(dueAt?.getHours()).toBe(23);
    expect(dueAt?.getMinutes()).toBe(59);
    expect(allDay).toBe(false);
  });

  it('parses a date with no time and flags it as all-day', () => {
    const { dueAt, allDay } = parseDueLabel('Due Oct 3', NOW);
    expect(dueAt?.getMonth()).toBe(9);
    expect(dueAt?.getDate()).toBe(3);
    expect(allDay).toBe(true);
  });

  it('parses an explicit year', () => {
    const { dueAt } = parseDueLabel('Due January 8, 2027', NOW);
    expect(dueAt?.getFullYear()).toBe(2027);
    expect(dueAt?.getMonth()).toBe(0);
  });

  it('picks the nearest year when none is given (December -> January)', () => {
    const december = new Date(2026, 11, 28, 9, 0, 0);
    const { dueAt } = parseDueLabel('Due Jan 8, 11:59 PM', december);
    expect(dueAt?.getFullYear()).toBe(2027);
  });

  it('resolves Today and Tomorrow against the supplied now', () => {
    expect(parseDueLabel('Due Today, 11:59 PM', NOW).dueAt?.getDate()).toBe(20);
    expect(parseDueLabel('Due Tomorrow, 8:00 AM', NOW).dueAt?.getDate()).toBe(21);
  });

  it('handles midnight and noon meridiem edge cases', () => {
    expect(parseDueLabel('Due Sep 24, 12:00 AM', NOW).dueAt?.getHours()).toBe(0);
    expect(parseDueLabel('Due Sep 24, 12:00 PM', NOW).dueAt?.getHours()).toBe(12);
  });

  it('parses 24-hour times', () => {
    expect(parseDueLabel('Due Sep 24, 23:59', NOW).dueAt?.getHours()).toBe(23);
  });

  it('parses day-first ordering', () => {
    const { dueAt } = parseDueLabel('Due 24 September', NOW);
    expect(dueAt?.getDate()).toBe(24);
    expect(dueAt?.getMonth()).toBe(8);
  });

  it('treats "No due date" as genuinely no deadline, not a parse failure', () => {
    const result = parseDueLabel('No due date', NOW);
    expect(result.dueAt).toBeNull();
    expect(result.rawLabel).toBe('No due date');
  });

  it('returns null rather than guessing on labels it does not understand', () => {
    expect(parseDueLabel('Due soon', NOW).dueAt).toBeNull();
    expect(parseDueLabel('Posted 3 weeks ago', NOW).dueAt).toBeNull();
    expect(parseDueLabel('', NOW).dueAt).toBeNull();
    expect(parseDueLabel(null, NOW).dueAt).toBeNull();
  });

  it('rejects impossible calendar dates', () => {
    expect(parseDueLabel('Due Feb 30', NOW).dueAt).toBeNull();
  });

  it('always preserves the raw label for auditing', () => {
    expect(parseDueLabel('  Due   Sep 24  ', NOW).rawLabel).toBe('Due Sep 24');
  });
});
