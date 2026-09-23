import { describe, expect, it } from 'vitest';
import {
  calendarEventCreateSchema,
  calendarEventUpdateSchema,
  calendarRangeSchema,
} from './schemas.js';
import { assignmentEventId, isDerivedEventId, CALENDAR_ITEM_TYPES } from './types.js';

/**
 * Calendar wire validation.
 *
 * The API trusts nothing a client sends, so these bounds are the defence.
 */

const OID = '64b7f3c2a1d4e5f601234567';

describe('creating an event', () => {
  it('accepts a minimal event and fills the defaults', () => {
    const parsed = calendarEventCreateSchema.parse({
      title: 'Revise for chemistry',
      startAt: '2026-09-22T15:00:00.000Z',
    });
    expect(parsed).toMatchObject({
      type: 'event',
      allDay: false,
      timezone: 'UTC',
      endAt: null,
      classId: null,
      assignmentId: null,
      description: null,
    });
  });

  it('accepts every declared item type', () => {
    for (const type of CALENDAR_ITEM_TYPES) {
      expect(() =>
        calendarEventCreateSchema.parse({
          title: 'x',
          startAt: '2026-09-22T15:00:00.000Z',
          type,
        }),
      ).not.toThrow();
    }
  });

  it('rejects an empty title', () => {
    expect(() =>
      calendarEventCreateSchema.parse({ title: '   ', startAt: '2026-09-22T15:00:00Z' }),
    ).toThrow();
  });

  it('rejects an unparseable date', () => {
    expect(() =>
      calendarEventCreateSchema.parse({ title: 'x', startAt: 'next tuesday' }),
    ).toThrow();
  });

  it('rejects an end before the start', () => {
    expect(() =>
      calendarEventCreateSchema.parse({
        title: 'x',
        startAt: '2026-09-22T15:00:00Z',
        endAt: '2026-09-22T14:00:00Z',
      }),
    ).toThrow();
  });

  it('accepts an end equal to the start, which is a point in time', () => {
    expect(() =>
      calendarEventCreateSchema.parse({
        title: 'x',
        startAt: '2026-09-22T15:00:00Z',
        endAt: '2026-09-22T15:00:00Z',
      }),
    ).not.toThrow();
  });

  it('rejects a title beyond the stored bound', () => {
    expect(() =>
      calendarEventCreateSchema.parse({
        title: 'x'.repeat(301),
        startAt: '2026-09-22T15:00:00Z',
      }),
    ).toThrow();
  });

  it('validates the time zone against Intl rather than a hardcoded list', () => {
    expect(() =>
      calendarEventCreateSchema.parse({
        title: 'x',
        startAt: '2026-09-22T15:00:00Z',
        timezone: 'America/New_York',
      }),
    ).not.toThrow();
    expect(() =>
      calendarEventCreateSchema.parse({
        title: 'x',
        startAt: '2026-09-22T15:00:00Z',
        timezone: 'Mars/Olympus_Mons',
      }),
    ).toThrow();
  });

  it('rejects a classId that is not an id', () => {
    expect(() =>
      calendarEventCreateSchema.parse({
        title: 'x',
        startAt: '2026-09-22T15:00:00Z',
        classId: '../../etc/passwd',
      }),
    ).toThrow();
  });

  it('accepts a real object id for a class link', () => {
    const parsed = calendarEventCreateSchema.parse({
      title: 'x',
      startAt: '2026-09-22T15:00:00Z',
      classId: OID,
    });
    expect(parsed.classId).toBe(OID);
  });
});

describe('updating an event', () => {
  it('accepts a single field', () => {
    expect(calendarEventUpdateSchema.parse({ title: 'New title' })).toEqual({
      title: 'New title',
    });
  });

  it('rejects an empty patch rather than performing a no-op write', () => {
    expect(() => calendarEventUpdateSchema.parse({})).toThrow();
  });

  it('allows clearing the class link', () => {
    expect(calendarEventUpdateSchema.parse({ classId: null })).toEqual({ classId: null });
  });
});

describe('listing a range', () => {
  it('accepts a normal window', () => {
    expect(() =>
      calendarRangeSchema.parse({
        from: '2026-09-01T00:00:00Z',
        to: '2026-10-01T00:00:00Z',
      }),
    ).not.toThrow();
  });

  it('rejects a backwards window', () => {
    expect(() =>
      calendarRangeSchema.parse({
        from: '2026-10-01T00:00:00Z',
        to: '2026-09-01T00:00:00Z',
      }),
    ).toThrow();
  });

  it('rejects an unbounded request for years of data', () => {
    expect(() =>
      calendarRangeSchema.parse({
        from: '2020-01-01T00:00:00Z',
        to: '2026-01-01T00:00:00Z',
      }),
    ).toThrow();
  });
});

describe('derived assignment events', () => {
  it('builds a namespaced id', () => {
    expect(assignmentEventId(OID)).toBe(`assignment:${OID}`);
  });

  it('recognises a derived id', () => {
    expect(isDerivedEventId(assignmentEventId(OID))).toBe(true);
  });

  it('does not mistake a stored event id for a derived one', () => {
    expect(isDerivedEventId(OID)).toBe(false);
  });
});
