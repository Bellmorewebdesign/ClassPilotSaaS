import type { StructureReport } from '../extractors/diagnostics.js';
import type { ClassroomClassCandidate, AssignmentCandidate } from '@classpilot/shared';
import type { ClassworkPageResult } from '../extractors/classworkPage.js';

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
  | { type: 'EXTRACT_HOME' }
  | { type: 'EXTRACT_CLASS' }
  | { type: 'EXTRACT_CLASSWORK' }
  | { type: 'EXTRACT_ASSIGNMENT' }
  | { type: 'CAPTURE_STRUCTURE'; includeText: boolean };

export type ContentResponse =
  | { ok: true; type: 'PONG'; url: string; readyState: DocumentReadyState }
  | {
      ok: true;
      type: 'HOME';
      classes: ClassroomClassCandidate[];
      looksSignedIn: boolean;
    }
  | { ok: true; type: 'CLASS'; klass: ClassroomClassCandidate }
  | { ok: true; type: 'CLASSWORK'; page: ClassworkPageResult }
  | { ok: true; type: 'ASSIGNMENT'; assignment: AssignmentCandidate }
  | { ok: true; type: 'STRUCTURE'; report: StructureReport }
  | { ok: false; error: string; code: string };

// --- popup -> background --------------------------------------------------

export type PopupRequest =
  | { type: 'GET_STATE' }
  | { type: 'START_SYNC' }
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
  | 'reading_assignments'
  | 'uploading'
  | 'complete'
  | 'failed';

export interface SyncProgress {
  phase: SyncPhase;
  classesDone: number;
  classesTotal: number;
  assignmentsDone: number;
  assignmentsTotal: number;
  /** What the engine is working on right now, e.g. "AP Calculus - Limits". */
  currentLabel: string | null;
}

export interface SyncSummary {
  syncId: string;
  finishedAt: string;
  classes: number;
  assignments: number;
  created: number;
  updated: number;
  unchanged: number;
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
