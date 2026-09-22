import type { StructureReport } from '../extractors/diagnostics.js';
import type { ClassroomClassCandidate, AssignmentCandidate } from '@classpilot/shared';
import type { ClassworkPageResult } from '../extractors/classworkPage.js';
import type { ReadinessResult, ReadinessTarget } from '../extractors/readiness.js';
import type { StreamPageResult } from '../extractors/streamPage.js';

/**
 * The message protocol between the extension's three contexts.
 *
 *   popup      <-> background   user actions and progress
 *   background <-> content      "extract this page for me"
 *
 * Everything is typed through this one file so a message can never be sent
 * in a shape the receiver does not handle.
 */

// --- background -> content ------------------------------------------------

export type ContentRequest =
  | { type: 'PING' }
  /**
   * Block until the page reaches the semantic state an extractor needs.
   *
   * This is the request that replaced "loaded + PING + fixed delay". The
   * content script owns the answer because the extractors live there and
   * only they know what "extractable" means for a given page.
   */
  | { type: 'AWAIT_READY'; target: ReadinessTarget; timeoutMs?: number }
  | { type: 'EXTRACT_HOME' }
  | { type: 'EXTRACT_CLASS' }
  | { type: 'EXTRACT_CLASSWORK' }
  | { type: 'EXTRACT_STREAM' }
  | { type: 'EXTRACT_ASSIGNMENT' }
  | { type: 'CAPTURE_STRUCTURE'; includeText: boolean };

export type ContentResponse =
  | { ok: true; type: 'PONG'; url: string; readyState: DocumentReadyState }
  | { ok: true; type: 'READY'; readiness: ReadinessResult }
  | {
      ok: true;
      type: 'HOME';
      classes: ClassroomClassCandidate[];
      looksSignedIn: boolean;
    }
  | { ok: true; type: 'CLASS'; klass: ClassroomClassCandidate }
  | { ok: true; type: 'CLASSWORK'; page: ClassworkPageResult }
  | { ok: true; type: 'STREAM'; page: StreamPageResult }
  | { ok: true; type: 'ASSIGNMENT'; assignment: AssignmentCandidate }
  | { ok: true; type: 'STRUCTURE'; report: StructureReport }
  | { ok: false; error: string; code: string };

// --- popup -> background --------------------------------------------------

export type PopupRequest =
  | { type: 'GET_STATE' }
  | { type: 'START_SYNC'; mode?: SyncMode; classId?: string }
  | { type: 'CANCEL_SYNC' }
  | { type: 'SAVE_SETTINGS'; apiUrl: string; apiToken: string }
  | { type: 'TEST_CONNECTION' }
  | { type: 'CAPTURE_DIAGNOSTICS'; includeText: boolean };

// --- shared state ---------------------------------------------------------

export type SyncPhase =
  | 'idle'
  | 'checking_session'
  | 'discovering_classes'
  | 'discovering_classwork'
  | 'reading_announcements'
  | 'reading_assignments'
  | 'uploading'
  | 'complete'
  | 'failed';

/**
 * Sync policies.
 *
 * Reading a student's whole Classroom history on every run is both slow and
 * rude to Google, but only ever reading "what changed" means the first sync
 * gives the workspace nothing to work with. These are the four intents:
 *
 *   initial_backfill   first meaningful sync. Read the current academic
 *                      context deeply enough to be useful.
 *   incremental        routine. Discovery everywhere, detail reads only
 *                      where the stored copy has gone stale.
 *   incremental_fast   discovery only, no stream. For a quick "anything new".
 *   deep_reconcile     re-read everything. User-requested, or after an
 *                      extractor version change.
 *   targeted_rescan    one class, read fully. What an agent asks for when it
 *                      suspects its context is stale.
 */
export type SyncMode =
  | 'initial_backfill'
  | 'incremental'
  | 'incremental_fast'
  | 'deep_reconcile'
  | 'targeted_rescan';

/**
 * What a sync actually did.
 *
 * `discovered` and `read` are separate on purpose. Reporting attempts as
 * successes is how "20 assignments synced" comes to mean "20 pages we tried
 * to open, most of which failed".
 */
export interface SyncCounts {
  classesDiscovered: number;
  classesRead: number;
  assignmentsDiscovered: number;
  assignmentsRead: number;
  materialsDiscovered: number;
  materialsRead: number;
  announcementsDiscovered: number;
  /** Detail pages an incremental run skipped because the stored copy was fresh. */
  detailsSkippedUnchanged: number;
  created: number;
  updated: number;
  unchanged: number;
}

export interface SyncProgress {
  phase: SyncPhase;
  mode: SyncMode;
  classesDone: number;
  classesTotal: number;
  assignmentsDone: number;
  assignmentsTotal: number;
  announcementsFound: number;
  /** What the engine is working on right now, e.g. "AP Calculus - Limits". */
  currentLabel: string | null;
  /**
   * True while blocked on Classroom rendering. Drives an honest
   * "Waiting for Classroom to finish loading..." instead of a fake percentage.
   */
  waitingForClassroom: boolean;
}

export interface SyncSummary {
  syncId: string;
  mode: SyncMode;
  finishedAt: string;
  counts: SyncCounts;
  /** Set when the sync could not finish. Distinct from a list of warnings. */
  fatal: { code: string; message: string } | null;
  warnings: Array<{ code: string; message: string; url: string | null }>;
}

export type ConnectionStatus =
  | { state: 'unconfigured' }
  | { state: 'ok'; email: string; apiUrl: string }
  | { state: 'unauthorized'; apiUrl: string }
  | { state: 'unreachable'; apiUrl: string; detail: string };

export interface ExtensionState {
  settings: { apiUrl: string; hasToken: boolean };
  connection: ConnectionStatus;
  /** Whether the active tab is on Google Classroom. */
  classroomDetected: boolean;
  syncing: boolean;
  progress: SyncProgress;
  lastSummary: SyncSummary | null;
  lastError: { code: string; message: string } | null;
  /**
   * Durable sync bookkeeping, so the popup can say what a sync would do
   * before it does it, and offer to resume an interrupted one.
   */
  sync: {
    lastSuccessfulSyncAt: string | null;
    lastDeepScanAt: string | null;
    /** What a plain "Sync Classroom" click would run right now. */
    nextMode: SyncMode;
    interrupted: {
      syncId: string;
      mode: SyncMode;
      startedAt: string;
      lastCompletedClassId: string | null;
      reason: string;
    } | null;
  };
}

export type PopupResponse =
  | { ok: true; type: 'STATE'; state: ExtensionState }
  | { ok: true; type: 'CONNECTION'; connection: ConnectionStatus }
  | { ok: true; type: 'DIAGNOSTICS'; report: StructureReport }
  | { ok: true; type: 'ACK' }
  | { ok: false; error: string; code: string };

/** Progress pushed from background to any open popup. */
export interface ProgressBroadcast {
  type: 'SYNC_PROGRESS';
  state: ExtensionState;
}
