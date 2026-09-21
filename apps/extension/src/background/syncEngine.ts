import { brand } from '@classpilot/shared';
import {
  CLASSROOM_ORIGIN,
  classworkUrl,
  parseClassroomUrl,
  type AssignmentCandidate,
  type ClassroomClassCandidate,
  type SyncWarning,
} from '@classpilot/shared';
import { type ApiClient, ApiClientError } from '../lib/apiClient.js';
import type { SyncProgress, SyncSummary } from '../lib/messages.js';
import { HelperTab } from './helperTab.js';

/**
 * The Classroom sync engine.
 *
 * Phases, matching the product spec:
 *
 *   1. Confirm the browser session can actually see Classroom.
 *   2. Discover enrolled classes from the home page.
 *   3. For each class, open its Classwork page and list the item URLs.
 *   4. Visit each item in ONE reused inactive helper tab, sequentially.
 *   5. Upload in batches, not one POST per discovery.
 *   6. Close the helper tab and report.
 *
 * The governing rule is partial tolerance: one unreadable assignment costs
 * one assignment. Every failure below is caught, converted into a
 * user-readable SyncWarning, and the loop continues. Only two things abort a
 * sync: no Classroom session, and an unusable API token.
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

export async function runSync(deps: SyncEngineDeps): Promise<SyncSummary> {
  const syncId = newSyncId();
  const startedAt = new Date().toISOString();
  const warnings: SyncWarning[] = [];

  const totals = { created: 0, updated: 0, unchanged: 0 };
  const progress: SyncProgress = {
    phase: 'checking_session',
    classesDone: 0,
    classesTotal: 0,
    assignmentsDone: 0,
    assignmentsTotal: 0,
    currentLabel: null,
  };
  const report = (): void => deps.onProgress({ ...progress });
  report();

  // Fail fast on a bad token rather than after scraping for two minutes.
  try {
    await deps.client.whoAmI();
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw new SyncAbortedError(error.kind, error.userMessage);
    }
    throw error;
  }

  const helper = new HelperTab();
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

    progress.phase = final ? 'uploading' : progress.phase;
    report();

    const result = await deps.client.postSyncBatch({
      syncId,
      startedAt,
      classes: pendingClasses,
      assignments: pendingAssignments,
      warnings: warnings.splice(0, warnings.length),
      clientVersion: deps.clientVersion,
      batchIndex: batchIndex++,
      final,
    });

    totals.created += result.classesCreated + result.assignmentsCreated;
    totals.updated += result.classesUpdated + result.assignmentsUpdated;
    totals.unchanged += result.assignmentsUnchanged;

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

  try {
    // --- Phase 1 + 2: session check and class discovery -------------------
    progress.phase = 'discovering_classes';
    report();

    await helper.goTo(`${CLASSROOM_ORIGIN}/h`);
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

    const classes = homeResponse.classes;
    progress.classesTotal = classes.length;
    report();

    if (classes.length === 0) {
      await flush(true);
      await helper.close();
      return summarize(syncId, 0, 0, totals, warnings);
    }

    pendingClasses.push(...classes);
    await flush(false);

    // --- Phase 3 + 4: per-class classwork discovery and item reading ------
    let assignmentsSeen = 0;

    for (const klass of classes) {
      if (deps.isCancelled()) break;

      progress.currentLabel = klass.name;
      progress.phase = 'discovering_classwork';
      report();

      const courseId = klass.sourceId ?? parseClassroomUrl(klass.canonicalUrl).courseId;
      if (!courseId) {
        warnings.push({
          code: 'class_id_unknown',
          message: `Skipped a class because its Classroom id could not be determined.`,
          url: klass.canonicalUrl,
        });
        progress.classesDone += 1;
        report();
        continue;
      }

      let items: Array<{ canonicalUrl: string; title: string | null }> = [];

      try {
        await helper.pause();
        await helper.goTo(classworkUrl(courseId));
        const classwork = await helper.ask({ type: 'EXTRACT_CLASSWORK' });

        if (classwork.ok && classwork.type === 'CLASSWORK') {
          items = classwork.page.items.slice(0, MAX_ITEMS_PER_CLASS);
          if (classwork.page.items.length > MAX_ITEMS_PER_CLASS) {
            warnings.push({
              code: 'class_item_cap_reached',
              message: `Only the first ${MAX_ITEMS_PER_CLASS} classwork items were read for one class.`,
              url: classworkUrl(courseId),
            });
          }
        } else {
          warnings.push({
            code: 'classwork_unreadable',
            message: `Could not read the Classwork page for one class.`,
            url: classworkUrl(courseId),
          });
        }
      } catch (error) {
        // A class whose Classwork page will not load costs us that class,
        // not the sync.
        warnings.push({
          code: 'classwork_load_failed',
          message: `Could not open the Classwork page for one class: ${describeError(error)}.`,
          url: classworkUrl(courseId),
        });
        progress.classesDone += 1;
        report();
        continue;
      }

      progress.assignmentsTotal += items.length;
      progress.phase = 'reading_assignments';
      report();

      for (const item of items) {
        if (deps.isCancelled()) break;

        progress.currentLabel = item.title ? `${klass.name} - ${item.title}` : klass.name;
        report();

        try {
          await helper.pause();
          await helper.goTo(item.canonicalUrl);
          const detail = await helper.ask({ type: 'EXTRACT_ASSIGNMENT' });

          if (detail.ok && detail.type === 'ASSIGNMENT') {
            pendingAssignments.push(detail.assignment);
            assignmentsSeen += 1;
          } else {
            warnings.push({
              code: detail.ok ? 'assignment_unexpected_response' : detail.code,
              message: 'One assignment page could not be read.',
              url: item.canonicalUrl,
            });
          }
        } catch (error) {
          warnings.push({
            code: 'assignment_load_failed',
            message: `One assignment page did not load: ${describeError(error)}.`,
            url: item.canonicalUrl,
          });
        }

        progress.assignmentsDone += 1;
        report();

        // --- Phase 5: batched upload --------------------------------------
        await flush(false);
      }

      progress.classesDone += 1;
      progress.currentLabel = null;
      report();
    }

    // --- Phase 5 (final) + 6 ---------------------------------------------
    await flush(true);
    progress.phase = 'complete';
    report();

    return summarize(syncId, classes.length, assignmentsSeen, totals, warnings);
  } finally {
    // Phase 6: the helper tab is closed whether the sync succeeded, failed or
    // was cancelled. Leaving a stray background tab open would be its own bug.
    await helper.close();
  }
}

function summarize(
  syncId: string,
  classes: number,
  assignments: number,
  totals: { created: number; updated: number; unchanged: number },
  warnings: SyncWarning[],
): SyncSummary {
  return {
    syncId,
    finishedAt: new Date().toISOString(),
    classes,
    assignments,
    created: totals.created,
    updated: totals.updated,
    unchanged: totals.unchanged,
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
