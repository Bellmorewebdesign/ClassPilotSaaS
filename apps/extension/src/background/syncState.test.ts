import { describe, expect, it } from 'vitest';
import {
  applyItemSeen,
  defaultModeFor,
  shouldReadDetailFor,
  type SeenItem,
  type SyncState,
} from './syncState.js';

/**
 * Sync state tests.
 *
 * These cover the pure decision functions rather than the chrome.storage
 * plumbing. The decisions are where the behaviour lives: whether a run is a
 * backfill or an increment, and whether a detail page is worth re-opening.
 */

function state(overrides: Partial<SyncState> = {}): SyncState {
  return {
    lastSuccessfulSyncAt: null,
    lastSuccessfulMode: null,
    lastDeepScanAt: null,
    lastCounts: null,
    items: {},
    inFlight: null,
    interrupted: null,
    ...overrides,
  };
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function seen(hoursAgo: number | null, now: number): SeenItem {
  const iso = new Date(now - (hoursAgo ?? 0) * HOUR).toISOString();
  return {
    firstSeenAt: iso,
    lastSeenAt: iso,
    lastFetchedAt: hoursAgo === null ? null : iso,
  };
}

describe('choosing a mode', () => {
  it('runs a backfill when nothing has ever succeeded', () => {
    expect(defaultModeFor(state())).toBe('initial_backfill');
  });

  it('runs incrementally once a sync has succeeded', () => {
    expect(
      defaultModeFor(state({ lastSuccessfulSyncAt: new Date().toISOString() })),
    ).toBe('incremental');
  });
});

describe('deciding whether to re-open a detail page', () => {
  const now = Date.now();

  it('a backfill reads everything, however fresh', () => {
    expect(shouldReadDetailFor('initial_backfill', seen(1, now), now)).toBe(true);
  });

  it('a deep reconcile reads everything', () => {
    expect(shouldReadDetailFor('deep_reconcile', seen(1, now), now)).toBe(true);
  });

  it('a targeted rescan reads everything in its class', () => {
    expect(shouldReadDetailFor('targeted_rescan', seen(1, now), now)).toBe(true);
  });

  it('an incremental run reads an item it has never fetched', () => {
    expect(shouldReadDetailFor('incremental', undefined, now)).toBe(true);
  });

  it('an incremental run reads an item seen but never fetched', () => {
    expect(shouldReadDetailFor('incremental', seen(null, now), now)).toBe(true);
  });

  it('an incremental run skips a detail fetched an hour ago', () => {
    expect(shouldReadDetailFor('incremental', seen(1, now), now)).toBe(false);
  });

  it('an incremental run re-reads a detail older than a day', () => {
    // Teachers edit assignments after posting; a day is the longest we are
    // willing to serve a stale set of instructions.
    expect(shouldReadDetailFor('incremental', seen(25, now), now)).toBe(true);
  });
});

describe('tracking what has been seen', () => {
  const now = '2026-09-22T10:00:00.000Z';

  it('records first and last sighting', () => {
    const s = applyItemSeen(state(), 'abc', false, now);
    expect(s.items.abc).toMatchObject({ firstSeenAt: now, lastSeenAt: now });
  });

  it('keeps the original firstSeenAt across later sightings', () => {
    let s = applyItemSeen(state(), 'abc', false, '2026-09-01T00:00:00.000Z');
    s = applyItemSeen(s, 'abc', false, now);
    expect(s.items.abc?.firstSeenAt).toBe('2026-09-01T00:00:00.000Z');
    expect(s.items.abc?.lastSeenAt).toBe(now);
  });

  it('only advances lastFetchedAt when the detail was actually read', () => {
    let s = applyItemSeen(state(), 'abc', true, '2026-09-01T00:00:00.000Z');
    s = applyItemSeen(s, 'abc', false, now);
    // Seeing it in a listing is not the same as reading its page.
    expect(s.items.abc?.lastFetchedAt).toBe('2026-09-01T00:00:00.000Z');
  });

  it('deduplicates by stable source id rather than creating a second record', () => {
    let s = applyItemSeen(state(), 'abc', true, now);
    s = applyItemSeen(s, 'abc', true, now);
    s = applyItemSeen(s, 'abc', true, now);
    expect(Object.keys(s.items)).toEqual(['abc']);
  });

  it('evicts the oldest sightings once the cap is reached', () => {
    let s = state();
    const base = Date.parse('2020-01-01T00:00:00.000Z');
    // 5001 items, one minute apart, so the eviction order is unambiguous.
    for (let i = 0; i < 5001; i += 1) {
      s = applyItemSeen(s, `item-${i}`, false, new Date(base + i * 60_000).toISOString());
    }
    expect(Object.keys(s.items)).toHaveLength(5000);
    expect(s.items['item-0']).toBeUndefined();
    expect(s.items['item-5000']).toBeDefined();
  });

  it('an incremental run after a backfill does not re-read what it just read', () => {
    // The property the whole mode system exists for.
    const now = Date.now();
    let s = state();
    s = applyItemSeen(s, 'abc', true, new Date(now).toISOString());
    expect(shouldReadDetailFor('incremental', s.items.abc, now + 5 * 60_000)).toBe(false);
    // ...but a day later it is fair game again.
    expect(shouldReadDetailFor('incremental', s.items.abc, now + 2 * DAY)).toBe(true);
  });
});
