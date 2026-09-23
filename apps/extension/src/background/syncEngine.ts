import { brand } from '@classpilot/shared';
import {
  CLASSROOM_ORIGIN,
  classStreamUrl,
  classworkUrl,
  parseClassroomUrl,
  type AssignmentCandidate,
  type ClassroomClassCandidate,
  type SyncWarning,
} from '@classpilot/shared';
import { type ApiClient, ApiClientError } from '../lib/apiClient.js';
import type { SyncCounts, SyncMode, SyncProgress, SyncSummary } from '../lib/messages.js';
import { HelperTab, HelperTabClosedError, type HelperTabOptions } from './helperTab.js';
import type { ReadinessResult } from '../extractors/readiness.js';
import {
  loadSyncState,
  recordClassSynced,
  recordDetailRead,
  recordSyncFailure,
  recordSyncSuccess,
  shouldReadDetail,
  startSyncState,
} from './syncState.js';

/**
 * The Classroom sync engine.
 *
 * Phases, matching the product spec:
 *
 *   1. Confirm the browser session can actually see Classroom.
 *   2. Discover enrolled classes from the home page.
 *   3. For each class, open its Classwork page and list the item URLs.
 *   4. Read the class stream for announcements.
 *   5. Visit each item in ONE reused inactive helper tab, sequentially.
 *   6. Upload in batches, not one POST per discovery.
 *   7. Close the helper tab and report.
 *
 * ---------------------------------------------------------------------------
 * PARTIAL TOLERANCE, AND ITS LIMIT
 *
 * One unreadable assignment costs one assignment: the failure becomes a
 * SyncWarning and the loop continues.
 *
 * That tolerance used to extend to the helper tab disappearing, which was a
 * bug with a very misleading symptom. When the user closed the helper tab,
 * every subsequent `goTo` threw immediately, each throw was recorded as a
 * per-item warning, and `assignmentsDone` climbed through the whole
 * remaining queue in milliseconds. The UI showed a sync racing to completion
 * while nothing was being read at all.
 *
 * A malformed assignment is recoverable. The browser machinery vanishing is
 * not. HelperTabClosedError is now fatal and aborts with `helper_tab_closed`.
 *
 * ---------------------------------------------------------------------------
 * COUNTING HONESTLY
 *
 * `discovered` is what we found. `read` is what we successfully extracted.
 * They are separate numbers because reporting attempts as successes is how
 * "20 assignments synced" comes to mean "20 pages we tried to open".
 */

/** How many records we accumulate before POSTing a batch. */
const BATCH_SIZE = 25;

/** Cap on items visited per class, so one enormous class cannot stall a sync. */
const MAX_ITEMS_PER_CLASS = 200;

export interface SyncEngineDeps {
  client: ApiClient;
  clientVersion: string;
  onProgress: (progress: SyncProgress) => void;
  /** Returns true when the user has asked to stop. */
  isCancelled: () => boolean;
  /** Which sync policy to run. Defaults to the state machine's choice. */
  mode?: SyncMode;
  /** Restrict the run to one class. Used by a targeted rescan. */
  onlyClassId?: string;
  /** Helper tab tuning. Tests shorten the polite delay; production does not. */
  helperOptions?: HelperTabOptions;
}

export class SyncAbortedError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SyncAbortedError';
  }
}

function emptyCounts(): SyncCounts {
  return {
    classesDiscovered: 0,
    classesRead: 0,
    assignmentsDiscovered: 0,
    assignmentsRead: 0,
    materialsDiscovered: 0,
    materialsRead: 0,
    announcementsDiscovered: 0,
    detailsSkippedUnchanged: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
  };
}

export async function runSync(deps: SyncEngineDeps): Promise<SyncSummary> {
  const persisted = await loadSyncState();
  const mode: SyncMode =
    deps.mode ?? (persisted.lastSuccessfulSyncAt === null ? 'initial_backfill' : 'incremental');

  const syncId = newSyncId();
  const startedAt = new Date().toISOString();

  /*
   * Two lists, deliberately.
   *
   * `pendingWarnings` is drained into each upload batch so the server has the
   * record. `allWarnings` is never drained, because the summary the student
   * sees has to be able to say how many things went wrong. Draining one list
   * into the POST used to leave the summary with an empty array, so the popup
   * reported a clean sync no matter what had failed.
   */
  const pendingWarnings: SyncWarning[] = [];
  const allWarnings: SyncWarning[] = [];
  const warnings = {
    push(warning: SyncWarning) {
      pendingWarnings.push(warning);
      allWarnings.push(warning);
    },
  };
  const counts = emptyCounts();

  await startSyncState({ syncId, mode, startedAt });

  const progress: SyncProgress = {
    phase: 'checking_session',
    mode,
    classesDone: 0,
    classesTotal: 0,
    assignmentsDone: 0,
    assignmentsTotal: 0,
    announcementsFound: 0,
    currentLabel: null,
    waitingForClassroom: false,
  };
  const report = (): void => deps.onProgress({ ...progress });
  report();

  // Fail fast on a bad token rather than after scraping for two minutes.
  try {
    await deps.client.whoAmI();
  } catch (error) {
    if (error instanceof ApiClientError) {
      await recordSyncFailure(error.kind);
      throw new SyncAbortedError(error.kind, error.userMessage);
    }
    throw error;
  }

  const helper = new HelperTab(deps.helperOptions ?? {});
  const unwatch = helper.watchForClosure();
  let batchIndex = 0;

  /** Accumulated records waiting to be uploaded. */
  let pendingClasses: ClassroomClassCandidate[] = [];
  let pendingAssignments: AssignmentCandidate[] = [];

  const flush = async (final: boolean): Promise<void> => {
    if (!final && pendingClasses.length + pendingAssignments.length < BATCH_SIZE) {
      return;
    }
    if (!final && pendingClasses.length === 0 && pendingAssignments.length === 0) {
      return;
    }

    if (final) {
      progress.phase = 'uploading';
      report();
    }

    const result = await deps.client.postSyncBatch({
      syncId,
      startedAt,
      classes: pendingClasses,
      assignments: pendingAssignments,
      warnings: pendingWarnings.splice(0, pendingWarnings.length),
      clientVersion: deps.clientVersion,
      batchIndex: batchIndex++,
      final,
    });

    counts.created += result.classesCreated + result.assignmentsCreated;
    counts.updated += result.classesUpdated + result.assignmentsUpdated;
    counts.unchanged += result.assignmentsUnchanged;

    // The server tells us what it refused and why; surface it rather than
    // silently reporting a clean sync.
    for (const rejection of result.rejected) {
      warnings.push({
        code: rejection.reason,
        message: `${brand.shortName} could not store one ${rejection.kind}: ${humanizeReason(rejection.reason)}`,
        url: rejection.url,
      });
    }

    pendingClasses = [];
    pendingAssignments = [];
  };

  /**
   * Turn a readiness result into either "carry on" or a warning.
   *
   * `empty` is a real answer, not a failure: a class with no classwork is a
   * normal thing for a class to be.
   */
  const noteReadiness = (
    readiness: ReadinessResult,
    escalated: boolean,
    url: string,
  ): boolean => {
    progress.waitingForClassroom = false;

    if (escalated) {
      warnings.push({
        code: 'classroom_needed_visible_window',
        message:
          'Google Classroom would not finish rendering in a hidden tab, so the sync tab was briefly given its own unfocused window.',
        url,
      });
    }

    switch (readiness.state) {
      case 'ready':
      case 'empty':
        return true;
      case 'signed_out':
        throw new SyncAbortedError(
          'not_signed_in',
          'Please sign into Google Classroom first, then try again.',
        );
      case 'wrong_page':
        warnings.push({
          code: 'classroom_wrong_page',
          message: 'Classroom sent the sync somewhere unexpected; that page was skipped.',
          url,
        });
        return false;
      case 'timeout':
        warnings.push({
          code: 'classroom_not_ready',
          message: `Classroom did not finish loading one page within ${Math.round(readiness.waitedMs / 1000)}s, so it was skipped.`,
          url,
        });
        return false;
    }
  };

  try {
    // --- Phase 1 + 2: session check and class discovery -------------------
    progress.phase = 'discovering_classes';
    progress.waitingForClassroom = true;
    report();

    const homeUrl = `${CLASSROOM_ORIGIN}/h`;
    const homeNav = await helper.goTo(homeUrl, 'home');
    if (!noteReadiness(homeNav.readiness, homeNav.escalated, homeUrl)) {
      throw new SyncAbortedError(
        'home_unreadable',
        `${brand.shortName} could not read your Classroom home page.`,
      );
    }

    const homeResponse = await helper.ask({ type: 'EXTRACT_HOME' });
    if (!homeResponse.ok || homeResponse.type !== 'HOME') {
      throw new SyncAbortedError(
        'home_unreadable',
        `${brand.shortName} could not read your Classroom home page.`,
      );
    }
    if (!homeResponse.looksSignedIn) {
      throw new SyncAbortedError(
        'not_signed_in',
        'Please sign into Google Classroom first, then try again.',
      );
    }

    const allClasses = homeResponse.classes;
    const classes = deps.onlyClassId
      ? allClasses.filter(
          (klass) =>
            (klass.sourceId ?? parseClassroomUrl(klass.canonicalUrl).courseId) ===
            deps.onlyClassId,
        )
      : allClasses;

    counts.classesDiscovered = classes.length;
    progress.classesTotal = classes.length;
    report();

    if (classes.length === 0) {
      await flush(true);
      await recordSyncSuccess({ syncId, mode, counts });
      progress.phase = 'complete';
      report();
      return summarize(syncId, mode, counts, allWarnings, null);
    }

    pendingClasses.push(...classes);
    await flush(false);

    // --- Phase 3-5: per-class discovery and reading -----------------------
    for (const klass of classes) {
      if (deps.isCancelled()) break;

      progress.currentLabel = klass.name;
      progress.phase = 'discovering_classwork';
      report();

      const courseId = klass.sourceId ?? parseClassroomUrl(klass.canonicalUrl).courseId;
      if (!courseId) {
        warnings.push({
          code: 'class_id_unknown',
          message: 'Skipped a class because its Classroom id could not be determined.',
          url: klass.canonicalUrl,
        });
        progress.classesDone += 1;
        report();
        continue;
      }

      let items: Array<{
        canonicalUrl: string;
        title: string | null;
        sourceId: string;
        kind: 'assignment' | 'material';
      }> = [];

      const workUrl = classworkUrl(courseId);
      try {
        await helper.pause();
        progress.waitingForClassroom = true;
        report();
        const nav = await helper.goTo(workUrl, 'classwork');
        if (noteReadiness(nav.readiness, nav.escalated, workUrl)) {
          const classwork = await helper.ask({ type: 'EXTRACT_CLASSWORK' });
          if (classwork.ok && classwork.type === 'CLASSWORK') {
            items = classwork.page.items.slice(0, MAX_ITEMS_PER_CLASS);
            if (classwork.page.items.length > MAX_ITEMS_PER_CLASS) {
              warnings.push({
                code: 'class_item_cap_reached',
                message: `Only the first ${MAX_ITEMS_PER_CLASS} classwork items were read for one class.`,
                url: workUrl,
              });
            }
          } else {
            warnings.push({
              code: 'classwork_unreadable',
              message: 'Could not read the Classwork page for one class.',
              url: workUrl,
            });
          }
        }
      } catch (error) {
        if (error instanceof HelperTabClosedError) throw error;
        // A class whose Classwork page will not load costs us that class,
        // not the sync.
        warnings.push({
          code: 'classwork_load_failed',
          message: `Could not open the Classwork page for one class: ${describeError(error)}.`,
          url: workUrl,
        });
        progress.classesDone += 1;
        report();
        continue;
      }

      const discoveredAssignments = items.filter((item) => item.kind === 'assignment').length;
      const discoveredMaterials = items.length - discoveredAssignments;
      counts.assignmentsDiscovered += discoveredAssignments;
      counts.materialsDiscovered += discoveredMaterials;
      progress.assignmentsTotal += items.length;

      // --- Phase 4: announcements ----------------------------------------
      if (modeReadsStream(mode)) {
        progress.phase = 'reading_announcements';
        report();
        const streamUrl = classStreamUrl(courseId);
        try {
          await helper.pause();
          const nav = await helper.goTo(streamUrl, 'stream');
          if (noteReadiness(nav.readiness, nav.escalated, streamUrl)) {
            const stream = await helper.ask({ type: 'EXTRACT_STREAM' });
            if (stream.ok && stream.type === 'STREAM') {
              counts.announcementsDiscovered += stream.page.announcements.length;
              progress.announcementsFound = counts.announcementsDiscovered;
            } else {
              warnings.push({
                code: 'stream_unreadable',
                message: 'Could not read the Stream page for one class.',
                url: streamUrl,
              });
            }
          }
        } catch (error) {
          if (error instanceof HelperTabClosedError) throw error;
          warnings.push({
            code: 'stream_load_failed',
            message: `Could not open the Stream page for one class: ${describeError(error)}.`,
            url: streamUrl,
          });
        }
      }

      // --- Phase 5: item detail reads ------------------------------------
      progress.phase = 'reading_assignments';
      report();

      for (const item of items) {
        if (deps.isCancelled()) break;

        // Incremental runs skip detail pages whose stored copy is still
        // fresh. Discovery already told us the item exists.
        if (!(await shouldReadDetail(mode, item.sourceId))) {
          counts.detailsSkippedUnchanged += 1;
          progress.assignmentsDone += 1;
          report();
          continue;
        }

        progress.currentLabel = item.title ? `${klass.name} - ${item.title}` : klass.name;
        report();

        try {
          await helper.pause();
          const nav = await helper.goTo(item.canonicalUrl, 'assignment');
          if (noteReadiness(nav.readiness, nav.escalated, item.canonicalUrl)) {
            const detail = await helper.ask({ type: 'EXTRACT_ASSIGNMENT' });

            if (detail.ok && detail.type === 'ASSIGNMENT') {
              pendingAssignments.push(detail.assignment);
              // Freshness is stamped HERE, on success only. A failed read
              // must leave the item stale so the next sync retries it.
              await recordDetailRead(item.sourceId);
              if (item.kind === 'material') counts.materialsRead += 1;
              else counts.assignmentsRead += 1;
            } else {
              warnings.push({
                code: detail.ok ? 'assignment_unexpected_response' : detail.code,
                message: 'One assignment page could not be read.',
                url: item.canonicalUrl,
              });
            }
          }
        } catch (error) {
          // The one failure that is NOT this item's fault.
          if (error instanceof HelperTabClosedError) throw error;
          warnings.push({
            code: 'assignment_load_failed',
            message: `One assignment page did not load: ${describeError(error)}.`,
            url: item.canonicalUrl,
          });
        }

        progress.assignmentsDone += 1;
        report();

        // --- Phase 6: batched upload --------------------------------------
        await flush(false);
      }

      counts.classesRead += 1;
      await recordClassSynced(courseId);
      progress.classesDone += 1;
      progress.currentLabel = null;
      report();
    }

    // --- Phase 6 (final) + 7 ---------------------------------------------
    await flush(true);
    await recordSyncSuccess({ syncId, mode, counts });
    progress.phase = 'complete';
    report();

    return summarize(syncId, mode, counts, allWarnings, null);
  } catch (error) {
    if (error instanceof HelperTabClosedError) {
      await recordSyncFailure(error.code);
      throw new SyncAbortedError(error.code, error.message);
    }
    if (error instanceof SyncAbortedError) {
      await recordSyncFailure(error.code);
    }
    throw error;
  } finally {
    // Phase 7: the helper tab is closed whether the sync succeeded, failed or
    // was cancelled. Leaving a stray background tab open would be its own bug.
    unwatch();
    await helper.close();
  }
}

/** Which modes pay the cost of reading each class's stream. */
function modeReadsStream(mode: SyncMode): boolean {
  return mode !== 'incremental_fast';
}

function summarize(
  syncId: string,
  mode: SyncMode,
  counts: SyncCounts,
  warnings: SyncWarning[],
  fatal: { code: string; message: string } | null,
): SyncSummary {
  return {
    syncId,
    mode,
    finishedAt: new Date().toISOString(),
    counts,
    fatal,
    warnings: warnings.map((warning) => ({
      code: warning.code,
      message: warning.message,
      url: warning.url,
    })),
  };
}

/**
 * A URL-safe random sync id, minted once per "Sync Classroom" click and
 * reused across every batch so the server stitches them into one run.
 */
export function newSyncId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Error text safe to show a user: no stack traces, no page content. */
function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'unknown error';
}

/** Turn a server rejection code into a sentence a student can act on. */
function humanizeReason(reason: string): string {
  switch (reason) {
    case 'assignment_missing_title':
      return 'it had no readable title';
    case 'class_missing_name':
      return 'it had no readable name';
    case 'assignment_class_not_found':
      return 'its class had not been synced';
    case 'assignment_class_unresolved':
      return 'it could not be matched to a class';
    case 'class_not_identifiable':
    case 'assignment_not_identifiable':
      return 'it had no identifying URL or id';
    default:
      return reason.replace(/_/g, ' ');
  }
}
