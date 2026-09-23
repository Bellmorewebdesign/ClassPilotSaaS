import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runSync, SyncAbortedError } from './syncEngine.js';
import { HelperTabClosedError } from './helperTab.js';
import type { SyncProgress } from '../lib/messages.js';

/**
 * Sync engine behaviour under failure.
 *
 * The two properties that matter most here are opposites, and the old engine
 * got one of them wrong:
 *
 *   ONE BAD ASSIGNMENT is recoverable. It costs a warning and the sync
 *   carries on, because a single malformed page should not deny a student
 *   their other eleven classes.
 *
 *   THE HELPER TAB DISAPPEARING is not. It used to be caught by the same
 *   per-item handler, so closing the tab made `assignmentsDone` sprint
 *   through the remaining queue - the UI showed rapid progress while
 *   nothing was read at all.
 */

const COURSE = 'Njk5MjMxMjM';
const WORK_A = 'NTQzMjE5OA';
const WORK_B = 'ODc2NTQzMjE';
const WORK_C = 'MTExMjIyMzMz';

// --- test doubles ----------------------------------------------------------

let navigations: string[] = [];
let closedAfter: number | null = null;
let storage: Record<string, unknown> = {};

/** Per-URL behaviour for EXTRACT_ASSIGNMENT. */
let assignmentBehaviour: (url: string) => 'ok' | 'unreadable' = () => 'ok';

function classCandidate() {
  return {
    name: 'AP Chemistry',
    sourceId: COURSE,
    canonicalUrl: `https://classroom.google.com/c/${COURSE}`,
    section: null,
    teacherName: null,
    room: null,
    description: null,
    extraction: {
      extractor: 'classroomHome',
      version: '1.0.0',
      pageUrl: null,
      provenance: [],
      warnings: [],
      durationMs: 1,
    },
  };
}

function assignmentCandidate(url: string) {
  return {
    title: 'Titration Lab',
    classSourceId: COURSE,
    classCanonicalUrl: `https://classroom.google.com/c/${COURSE}`,
    canonicalUrl: url,
    sourceId: WORK_A,
    description: null,
    dueAt: null,
    dueLabel: null,
    points: null,
    grade: null,
    status: 'assigned' as const,
    assignmentType: 'assignment' as const,
    attachments: [],
    extraction: {
      extractor: 'assignmentPage',
      version: '1.0.0',
      pageUrl: url,
      provenance: [],
      warnings: [],
      durationMs: 1,
    },
  };
}

function items(count: number) {
  const ids = [WORK_A, WORK_B, WORK_C].slice(0, count);
  return ids.map((id) => ({
    sourceId: id,
    canonicalUrl: `https://classroom.google.com/c/${COURSE}/a/${id}/details`,
    kind: 'assignment' as const,
    courseId: COURSE,
    title: 'Item ' + id,
    assignmentType: 'assignment' as const,
    dueLabel: null,
    topic: null,
  }));
}

let itemCount = 3;

function readyFor(target: string) {
  return {
    ok: true,
    type: 'READY',
    readiness: {
      state: 'ready',
      target,
      url: 'https://classroom.google.com/',
      waitedMs: 5,
      mutations: 1,
      documentHidden: false,
      signals: [],
    },
  };
}

beforeEach(() => {
  navigations = [];
  closedAfter = null;
  storage = {};
  itemCount = 3;
  assignmentBehaviour = () => 'ok';

  let currentUrl = '';

  vi.stubGlobal('crypto', {
    getRandomValues: (array: Uint8Array) => array.fill(7),
  });

  vi.stubGlobal('chrome', {
    runtime: { lastError: undefined },
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: storage[key] })),
        set: vi.fn(async (values: Record<string, unknown>) => {
          Object.assign(storage, values);
        }),
      },
    },
    windows: { create: vi.fn(async () => ({ id: 1 })), remove: vi.fn(async () => {}) },
    tabs: {
      create: vi.fn(async ({ url }: { url: string }) => {
        navigations.push(url);
        currentUrl = url;
        return { id: 1, status: 'complete', url };
      }),
      update: vi.fn(async (_id: number, { url }: { url: string }) => {
        if (closedAfter !== null && navigations.length >= closedAfter) {
          throw new Error('No tab with id: 1');
        }
        navigations.push(url);
        currentUrl = url;
        return { id: 1, status: 'complete', url };
      }),
      get: vi.fn(async () => {
        if (closedAfter !== null && navigations.length >= closedAfter) {
          throw new Error('No tab with id: 1');
        }
        return { id: 1, status: 'complete', url: currentUrl };
      }),
      remove: vi.fn(async () => {}),
      onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
      sendMessage: vi.fn(
        (
          _id: number,
          request: { type: string; target?: string },
          callback: (response: unknown) => void,
        ) => {
          switch (request.type) {
            case 'PING':
              return callback({
                ok: true,
                type: 'PONG',
                url: currentUrl,
                readyState: 'complete',
              });
            case 'AWAIT_READY':
              return callback(readyFor(request.target ?? 'home'));
            case 'EXTRACT_HOME':
              return callback({
                ok: true,
                type: 'HOME',
                classes: [classCandidate()],
                looksSignedIn: true,
              });
            case 'EXTRACT_CLASSWORK':
              return callback({
                ok: true,
                type: 'CLASSWORK',
                page: { courseId: COURSE, items: items(itemCount) },
              });
            case 'EXTRACT_STREAM':
              return callback({
                ok: true,
                type: 'STREAM',
                page: { courseId: COURSE, announcements: [], looksEmpty: true },
              });
            case 'EXTRACT_ASSIGNMENT':
              if (assignmentBehaviour(currentUrl) === 'unreadable') {
                return callback({
                  ok: false,
                  code: 'assignment_extract_failed',
                  error: 'no title',
                });
              }
              return callback({
                ok: true,
                type: 'ASSIGNMENT',
                assignment: assignmentCandidate(currentUrl),
              });
            default:
              return callback({ ok: true, type: 'ACK' });
          }
        },
      ),
    },
  });
});

afterEach(() => vi.unstubAllGlobals());

function deps(overrides: Partial<Parameters<typeof runSync>[0]> = {}) {
  const progress: SyncProgress[] = [];
  return {
    progress,
    args: {
      client: {
        whoAmI: vi.fn(async () => ({ email: 'student@example.test' })),
        postSyncBatch: vi.fn(async () => ({
          classesCreated: 1,
          classesUpdated: 0,
          assignmentsCreated: 1,
          assignmentsUpdated: 0,
          assignmentsUnchanged: 0,
          rejected: [],
        })),
      },
      clientVersion: '0.1.0',
      onProgress: (p: SyncProgress) => progress.push({ ...p }),
      isCancelled: () => false,
      // Real syncs pause politely between navigations; tests must not.
      helperOptions: { politenessDelayMs: 0, allowVisibilityEscalation: false },
      ...overrides,
    } as unknown as Parameters<typeof runSync>[0],
  };
}

// --- tests -----------------------------------------------------------------

describe('a single unreadable assignment is recoverable', () => {
  it('warns about the bad item and still reads the others', async () => {
    assignmentBehaviour = (url) => (url.includes(WORK_B) ? 'unreadable' : 'ok');

    const { args } = deps();
    const summary = await runSync(args);

    expect(summary.counts.assignmentsDiscovered).toBe(3);
    expect(summary.counts.assignmentsRead).toBe(2);
    expect(summary.warnings.map((w) => w.code)).toContain('assignment_extract_failed');
    expect(summary.fatal).toBeNull();
  });

  it('reports discovered and read as different numbers', async () => {
    assignmentBehaviour = (url) => (url.includes(WORK_B) ? 'unreadable' : 'ok');
    const { args } = deps();
    const summary = await runSync(args);

    // The heart of honest counting: attempts are not successes.
    expect(summary.counts.assignmentsRead).toBeLessThan(
      summary.counts.assignmentsDiscovered,
    );
  });
});

describe('the helper tab being closed aborts the sync', () => {
  it('throws SyncAbortedError with helper_tab_closed', async () => {
    // Home, classwork, stream, then the first assignment navigation fails.
    closedAfter = 4;
    const { args } = deps();

    await expect(runSync(args)).rejects.toMatchObject({
      name: 'SyncAbortedError',
      code: 'helper_tab_closed',
    });
  });

  it('does not march through the remaining queue', async () => {
    closedAfter = 4;
    const { args, progress } = deps();

    await expect(runSync(args)).rejects.toBeInstanceOf(SyncAbortedError);

    /*
     * The original bug's signature: assignmentsDone climbing to the full
     * queue length in milliseconds while nothing was read. At most the one
     * item that was in flight may have been counted.
     */
    const maxDone = Math.max(...progress.map((p) => p.assignmentsDone));
    expect(maxDone).toBeLessThan(3);
  });

  it('stores the interruption so the popup can offer to resume', async () => {
    closedAfter = 4;
    const { args } = deps();
    await expect(runSync(args)).rejects.toBeInstanceOf(SyncAbortedError);

    const state = storage['classpilot.syncState'] as {
      interrupted: { reason: string } | null;
    };
    expect(state.interrupted?.reason).toBe('helper_tab_closed');
  });

  it('cleans up without throwing a second time', async () => {
    closedAfter = 4;
    const { args } = deps();
    // The finally block runs regardless. A tab that is already gone must not
    // produce a second error that masks the real one.
    await expect(runSync(args)).rejects.toMatchObject({ code: 'helper_tab_closed' });
  });
});

describe('sync modes', () => {
  it('runs an initial backfill when nothing has ever synced', async () => {
    const { args } = deps();
    const summary = await runSync(args);
    expect(summary.mode).toBe('initial_backfill');
  });

  it('runs incrementally once a sync has succeeded', async () => {
    const first = deps();
    await runSync(first.args);

    const second = deps();
    const summary = await runSync(second.args);
    expect(summary.mode).toBe('incremental');
  });

  it('skips detail pages that are still fresh on an incremental run', async () => {
    await runSync(deps().args); // backfill reads all three
    const summary = await runSync(deps().args); // incremental

    expect(summary.counts.detailsSkippedUnchanged).toBe(3);
    expect(summary.counts.assignmentsRead).toBe(0);
    // Discovery still happened - we know the items are still there.
    expect(summary.counts.assignmentsDiscovered).toBe(3);
  });

  it('a deep reconcile re-reads everything', async () => {
    await runSync(deps().args);
    const summary = await runSync(deps({ mode: 'deep_reconcile' }).args);

    expect(summary.counts.detailsSkippedUnchanged).toBe(0);
    expect(summary.counts.assignmentsRead).toBe(3);
  });

  it('a targeted rescan restricts the run to one class', async () => {
    const summary = await runSync(deps({ mode: 'targeted_rescan', onlyClassId: 'nope' }).args);
    expect(summary.counts.classesDiscovered).toBe(0);
  });
});

describe('progress honesty', () => {
  it('never reports more assignments done than were discovered', async () => {
    const { args, progress } = deps();
    await runSync(args);
    for (const p of progress) {
      expect(p.assignmentsDone).toBeLessThanOrEqual(Math.max(p.assignmentsTotal, 0));
    }
  });

  it('surfaces the waiting-for-Classroom state', async () => {
    const { args, progress } = deps();
    await runSync(args);
    expect(progress.some((p) => p.waitingForClassroom)).toBe(true);
  });

  it('records a completed sync so the next one is incremental', async () => {
    await runSync(deps().args);
    const state = storage['classpilot.syncState'] as {
      lastSuccessfulSyncAt: string | null;
      interrupted: unknown;
    };
    expect(state.lastSuccessfulSyncAt).not.toBeNull();
    expect(state.interrupted).toBeNull();
  });
});

describe('fatal errors are distinguished from warnings', () => {
  it('a rejected API token aborts before any scraping', async () => {
    const { args } = deps({
      client: {
        whoAmI: vi.fn(async () => {
          const { ApiClientError } = await import('../lib/apiClient.js');
          throw new ApiClientError('unauthorized', 'Token rejected.', 401);
        }),
        postSyncBatch: vi.fn(),
      } as never,
    });

    await expect(runSync(args)).rejects.toBeInstanceOf(SyncAbortedError);
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it('HelperTabClosedError is not swallowed by the per-item handler', () => {
    // Guards the classification itself: if someone makes the closed error a
    // plain Error again, the engine's `instanceof` check goes quiet.
    const error = new HelperTabClosedError();
    expect(error.code).toBe('helper_tab_closed');
    expect(error).toBeInstanceOf(Error);
  });
});
