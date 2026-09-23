import type { SyncCounts, SyncMode } from '../lib/messages.js';

/**
 * Durable sync state.
 *
 * WHY THIS EXISTS
 *
 * Without it, every sync is a first sync. The extension re-opened every
 * assignment detail page on every run, which is slow, hammers Google, and
 * makes a routine "did anything change today" cost the same as a full
 * backfill.
 *
 * It also had no memory of being interrupted, so a sync that died halfway
 * had to start from zero next time.
 *
 * WHAT IS STORED
 *
 * Only sync bookkeeping - no coursework. A record of what was seen and when,
 * keyed by the stable Classroom source id, so the next run can decide what is
 * worth re-reading.
 *
 * MV3 service workers are killed at Chrome's discretion, so this lives in
 * chrome.storage.local rather than in memory.
 */

const STATE_KEY = 'classpilot.syncState';

/**
 * Freshness-record schema version.
 *
 * Bumped when a bug made the stored records untrustworthy. Version 1 stamped
 * lastFetchedAt before the detail page was read, so an item whose read failed
 * was recorded as fetched and skipped by every incremental sync for the next
 * 24 hours. Those records cannot be repaired - there is no way to tell a
 * genuine read from a poisoned one - so loading an older version drops the
 * per-item table and lets the next sync rebuild it.
 *
 * Only the freshness table is dropped. Nothing about the user's synced
 * coursework lives here, so this costs one thorough sync and nothing else.
 */
const STATE_VERSION = 2;

/**
 * How long a stored detail page is trusted before an incremental run reads
 * it again.
 *
 * Deliberately short. Teachers edit assignments after posting, and the cost
 * of being wrong here is stale homework instructions.
 */
const DETAIL_FRESHNESS_MS = 24 * 60 * 60 * 1000;

/**
 * Safety overlap. A teacher can edit something posted before the last sync,
 * so an incremental run looks back further than "since last time".
 */
export const INCREMENTAL_OVERLAP_MS = 3 * 24 * 60 * 60 * 1000;

export interface SeenItem {
  /** First time this source id was ever observed. */
  firstSeenAt: string;
  /** Most recent observation. */
  lastSeenAt: string;
  /** Last time the detail page itself was read, as opposed to the listing. */
  lastFetchedAt: string | null;
}

export interface InterruptedSync {
  syncId: string;
  mode: SyncMode;
  startedAt: string;
  /** Last class whose items were all processed. */
  lastCompletedClassId: string | null;
  /** Why it stopped. */
  reason: string;
}

export interface SyncState {
  /** Schema version of the freshness table. See STATE_VERSION. */
  version: number;
  /** Null until the first sync completes. Drives initial_backfill vs incremental. */
  lastSuccessfulSyncAt: string | null;
  lastSuccessfulMode: SyncMode | null;
  /** The deepest scan we have done, so a reconcile can be offered sensibly. */
  lastDeepScanAt: string | null;
  lastCounts: SyncCounts | null;
  /** Per-source-id freshness. Bounded; see MAX_TRACKED_ITEMS. */
  items: Record<string, SeenItem>;
  /** Set while a sync is running, cleared on success. Enables resume. */
  inFlight: {
    syncId: string;
    mode: SyncMode;
    startedAt: string;
    lastCompletedClassId: string | null;
  } | null;
  /** The last interruption, so the popup can offer to resume. */
  interrupted: InterruptedSync | null;
}

/**
 * Cap on tracked items, so storage cannot grow without bound across years of
 * coursework. Oldest-seen entries are evicted first.
 */
const MAX_TRACKED_ITEMS = 5000;

function emptyState(): SyncState {
  return {
    version: STATE_VERSION,
    lastSuccessfulSyncAt: null,
    lastSuccessfulMode: null,
    lastDeepScanAt: null,
    lastCounts: null,
    items: {},
    inFlight: null,
    interrupted: null,
  };
}

export async function loadSyncState(): Promise<SyncState> {
  try {
    const stored = await chrome.storage.local.get(STATE_KEY);
    const state = stored[STATE_KEY] as Partial<SyncState> | undefined;
    if (!state) return emptyState();
    // Merge over a fresh object so a state written by an older version, or a
    // partially-written one, can never produce undefined fields.
    return migrate({ ...emptyState(), ...state, items: state.items ?? {} });
  } catch {
    return emptyState();
  }
}

/**
 * Bring a stored state up to the current schema.
 *
 * Exported so the migration is testable without chrome.storage. It keeps the
 * sync history and drops only what it cannot trust.
 */
export function migrate(state: SyncState): SyncState {
  if (state.version === STATE_VERSION) return state;
  return { ...state, version: STATE_VERSION, items: {} };
}

async function writeSyncState(state: SyncState): Promise<void> {
  await chrome.storage.local.set({ [STATE_KEY]: state });
}

/** Choose the mode a plain "Sync" click should run. */
export function defaultModeFor(state: SyncState): SyncMode {
  if (state.lastSuccessfulSyncAt === null) return 'initial_backfill';
  return 'incremental';
}

export async function startSyncState(run: {
  syncId: string;
  mode: SyncMode;
  startedAt: string;
}): Promise<void> {
  const state = await loadSyncState();
  state.inFlight = {
    syncId: run.syncId,
    mode: run.mode,
    startedAt: run.startedAt,
    lastCompletedClassId: null,
  };
  await writeSyncState(state);
}

export async function recordClassSynced(courseId: string): Promise<void> {
  const state = await loadSyncState();
  if (state.inFlight) {
    state.inFlight.lastCompletedClassId = courseId;
    await writeSyncState(state);
  }
}

/** Note that a source id was observed, and optionally that we read its detail. */
export async function recordItemSeen(
  sourceId: string,
  options: { fetchedDetail: boolean } = { fetchedDetail: false },
): Promise<void> {
  const state = await loadSyncState();
  applyItemSeen(state, sourceId, options.fetchedDetail, new Date().toISOString());
  await writeSyncState(state);
}

/** Pure, so the eviction policy is testable without chrome.storage. */
export function applyItemSeen(
  state: SyncState,
  sourceId: string,
  fetchedDetail: boolean,
  nowIso: string,
): SyncState {
  const existing = state.items[sourceId];
  state.items[sourceId] = {
    firstSeenAt: existing?.firstSeenAt ?? nowIso,
    lastSeenAt: nowIso,
    lastFetchedAt: fetchedDetail ? nowIso : (existing?.lastFetchedAt ?? null),
  };

  const ids = Object.keys(state.items);
  if (ids.length > MAX_TRACKED_ITEMS) {
    ids
      .sort(
        (a, b) =>
          Date.parse(state.items[a]!.lastSeenAt) - Date.parse(state.items[b]!.lastSeenAt),
      )
      .slice(0, ids.length - MAX_TRACKED_ITEMS)
      .forEach((id) => delete state.items[id]);
  }
  return state;
}

/**
 * Should this run open the item's detail page?
 *
 * A backfill or reconcile reads everything. An incremental run skips a detail
 * page whose stored copy is younger than DETAIL_FRESHNESS_MS - discovery has
 * already confirmed the item still exists, and re-reading an unchanged page
 * costs a navigation for nothing.
 */
export function shouldReadDetailFor(
  mode: SyncMode,
  item: SeenItem | undefined,
  now: number,
): boolean {
  if (mode === 'initial_backfill' || mode === 'deep_reconcile' || mode === 'targeted_rescan') {
    return true;
  }
  if (!item?.lastFetchedAt) return true;
  return now - Date.parse(item.lastFetchedAt) > DETAIL_FRESHNESS_MS;
}

export async function shouldReadDetail(mode: SyncMode, sourceId: string): Promise<boolean> {
  const state = await loadSyncState();
  const read = shouldReadDetailFor(mode, state.items[sourceId], Date.now());

  /*
   * Records the SIGHTING only - never the fetch.
   *
   * This used to stamp lastFetchedAt here, before the detail page had been
   * opened. An item whose read then failed was recorded as successfully
   * fetched, so every incremental sync for the next 24 hours skipped it. One
   * bad first sync could therefore poison the record and leave later syncs
   * reading nothing at all, which is indistinguishable from the extension
   * being broken.
   *
   * Only recordDetailRead, called after a successful extraction, may move
   * lastFetchedAt.
   */
  applyItemSeen(state, sourceId, false, new Date().toISOString());
  await writeSyncState(state);
  return read;
}

/**
 * Mark a detail page as successfully read.
 *
 * Called only after the extractor returned a candidate. A failed read leaves
 * lastFetchedAt alone, so the next sync tries again rather than trusting a
 * page it never managed to read.
 */
export async function recordDetailRead(sourceId: string): Promise<void> {
  const state = await loadSyncState();
  applyItemSeen(state, sourceId, true, new Date().toISOString());
  await writeSyncState(state);
}

export async function recordSyncSuccess(run: {
  syncId: string;
  mode: SyncMode;
  counts: SyncCounts;
}): Promise<void> {
  const state = await loadSyncState();
  const now = new Date().toISOString();
  state.lastSuccessfulSyncAt = now;
  state.lastSuccessfulMode = run.mode;
  state.lastCounts = run.counts;
  if (run.mode === 'initial_backfill' || run.mode === 'deep_reconcile') {
    state.lastDeepScanAt = now;
  }
  state.inFlight = null;
  state.interrupted = null;
  await writeSyncState(state);
}

export async function recordSyncFailure(reason: string): Promise<void> {
  const state = await loadSyncState();
  if (state.inFlight) {
    state.interrupted = {
      syncId: state.inFlight.syncId,
      mode: state.inFlight.mode,
      startedAt: state.inFlight.startedAt,
      lastCompletedClassId: state.inFlight.lastCompletedClassId,
      reason,
    };
  }
  state.inFlight = null;
  await writeSyncState(state);
}

/** Wipe everything. Used by "Recheck everything" before a deep reconcile. */
export async function clearSyncState(): Promise<void> {
  await writeSyncState(emptyState());
}
