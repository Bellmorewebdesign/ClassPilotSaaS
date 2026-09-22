import { brand } from '@classpilot/shared';
import type {
  ConnectionStatus,
  ExtensionState,
  PopupRequest,
  PopupResponse,
  ProgressBroadcast,
  SyncMode,
  SyncProgress,
  SyncSummary,
} from '../lib/messages.js';

/**
 * Popup UI.
 *
 * A thin, stateless view over the background worker's state. All logic lives
 * in the worker, so closing the popup mid-sync changes nothing: reopening it
 * re-reads the current state and carries on showing progress.
 *
 * Deliberately vanilla TypeScript with no framework. A popup has to render
 * instantly, and the whole surface is a dozen elements.
 */

// --- element lookup -------------------------------------------------------

function el<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`popup markup is missing #${id}`);
  return element as T;
}

const ui = {
  statusClassroom: el('status-classroom'),
  statusConnection: el('status-connection'),
  lastSync: el('last-sync'),

  progress: el('progress'),
  progressPhase: el('progress-phase'),
  progressMode: el('progress-mode'),
  progressClasses: el('progress-classes'),
  progressAssignments: el('progress-assignments'),
  barClasses: el('bar-classes'),
  barAssignments: el('bar-assignments'),
  progressCurrent: el('progress-current'),

  result: el('result'),
  resultTitle: el('result-title'),
  resultStats: el('result-stats'),
  warningsToggle: el<HTMLButtonElement>('warnings-toggle'),
  warnings: el('warnings'),

  error: el('error'),
  errorTitle: el('error-title'),
  errorMessage: el('error-message'),

  resume: el('resume'),
  resumeNote: el('resume-note'),
  resumeButton: el<HTMLButtonElement>('resume-button'),
  restartButton: el<HTMLButtonElement>('restart-button'),

  syncButton: el<HTMLButtonElement>('sync-button'),
  cancelButton: el<HTMLButtonElement>('cancel-button'),
  openApp: el<HTMLButtonElement>('open-app'),

  settingsToggle: el<HTMLButtonElement>('settings-toggle'),
  settingsPanel: el('settings-panel'),
  mainPanel: el('main-panel'),
  apiUrl: el<HTMLInputElement>('api-url'),
  apiToken: el<HTMLInputElement>('api-token'),
  tokenHint: el('token-hint'),
  saveSettings: el<HTMLButtonElement>('save-settings'),

  includeText: el<HTMLInputElement>('include-text'),
  captureDiagnostics: el<HTMLButtonElement>('capture-diagnostics'),
  diagnosticsOutput: el<HTMLTextAreaElement>('diagnostics-output'),
  copyDiagnostics: el<HTMLButtonElement>('copy-diagnostics'),
};

// --- messaging ------------------------------------------------------------

async function send(request: PopupRequest): Promise<PopupResponse> {
  try {
    return (await chrome.runtime.sendMessage(request)) as PopupResponse;
  } catch (error) {
    return {
      ok: false,
      code: 'worker_unreachable',
      error:
        error instanceof Error
          ? error.message
          : `The ${brand.extensionName} background worker is not responding.`,
    };
  }
}

// --- rendering ------------------------------------------------------------

function setStatus(row: HTMLElement, state: 'ok' | 'warn' | 'error' | 'pending', text: string): void {
  row.querySelector('.dot')?.setAttribute('data-state', state);
  const label = row.querySelector('.status-text');
  if (label) label.textContent = text;
}

function describeConnection(connection: ConnectionStatus): {
  state: 'ok' | 'warn' | 'error';
  text: string;
} {
  switch (connection.state) {
    case 'ok':
      return { state: 'ok', text: `Connected as ${connection.email}` };
    case 'unconfigured':
      return { state: 'warn', text: 'Not connected - open Settings' };
    case 'unauthorized':
      return { state: 'error', text: 'Token rejected - check Settings' };
    case 'unreachable':
      return { state: 'error', text: `Cannot reach ${connection.apiUrl}` };
  }
}

const PHASE_LABELS: Record<SyncProgress['phase'], string> = {
  idle: 'Starting…',
  checking_session: 'Checking your Classroom session…',
  discovering_classes: 'Finding your classes…',
  discovering_classwork: 'Reading Classwork pages…',
  reading_announcements: 'Reading announcements…',
  reading_assignments: 'Reading assignments…',
  uploading: `Saving to ${brand.shortName}…`,
  complete: 'Sync complete',
  failed: 'Sync failed',
};

/** What each policy is doing, in the student's terms. */
const MODE_LABELS: Record<SyncMode, string> = {
  initial_backfill: 'First sync - reading everything',
  incremental: 'Checking for changes',
  incremental_fast: 'Quick check',
  deep_reconcile: 'Rechecking everything',
  targeted_rescan: 'Rechecking one class',
};

function renderProgress(progress: SyncProgress): void {
  /*
   * Waiting on Classroom is its own state, said plainly. The alternative -
   * a spinner over a stalled counter - reads as progress that is not
   * happening.
   */
  ui.progressPhase.textContent = progress.waitingForClassroom
    ? 'Waiting for Classroom to finish loading…'
    : PHASE_LABELS[progress.phase];
  ui.progressMode.textContent = MODE_LABELS[progress.mode];
  ui.progressClasses.textContent = `${progress.classesDone} / ${progress.classesTotal}`;
  ui.progressAssignments.textContent = `${progress.assignmentsDone} / ${progress.assignmentsTotal}`;
  ui.barClasses.style.width = percent(progress.classesDone, progress.classesTotal);
  ui.barAssignments.style.width = percent(progress.assignmentsDone, progress.assignmentsTotal);
  ui.progressCurrent.textContent = progress.currentLabel ?? '';
}

function percent(done: number, total: number): string {
  if (total <= 0) return '0%';
  return `${Math.min(100, Math.round((done / total) * 100))}%`;
}

function renderSummary(summary: SyncSummary): void {
  const hasWarnings = summary.warnings.length > 0;
  const c = summary.counts;

  if (summary.fatal) {
    // The error panel below already says the sync was interrupted. This card
    // answers the next question: what was actually saved before it stopped.
    ui.resultTitle.textContent = 'Saved before it stopped';
  } else if (hasWarnings) {
    ui.resultTitle.textContent =
      summary.warnings.length === 1
        ? 'Sync completed with 1 warning'
        : `Sync completed with ${summary.warnings.length} warnings`;
  } else {
    ui.resultTitle.textContent = 'Sync complete';
  }

  /*
   * Discovered and read are shown separately whenever they differ. Folding
   * them into one number is what made "20 assignments" mean "20 we tried".
   */
  const rows = [
    statRow('Classes', c.classesRead, c.classesDiscovered),
    statRow('Assignments read', c.assignmentsRead, c.assignmentsDiscovered),
  ];
  if (c.materialsDiscovered > 0) {
    rows.push(statRow('Materials read', c.materialsRead, c.materialsDiscovered));
  }
  if (c.announcementsDiscovered > 0) {
    rows.push(statRow('Announcements', c.announcementsDiscovered));
  }
  if (c.detailsSkippedUnchanged > 0) {
    rows.push(statRow('Already up to date', c.detailsSkippedUnchanged));
  }
  rows.push(statRow('New', c.created), statRow('Updated', c.updated));
  if (hasWarnings) rows.push(statRow('Could not be read', summary.warnings.length));

  ui.resultStats.replaceChildren(...rows);

  ui.warningsToggle.hidden = !hasWarnings;
  ui.warnings.hidden = true;
  ui.warnings.replaceChildren(
    ...summary.warnings.map((warning) => {
      const item = document.createElement('li');
      item.textContent = warning.message;
      return item;
    }),
  );

  ui.result.hidden = false;
}

/**
 * One summary row.
 *
 * When `outOf` is supplied and differs from `value`, the row reads "12 of 15"
 * - the honest shape for "we found fifteen and could read twelve".
 */
function statRow(label: string, value: number, outOf?: number): HTMLLIElement {
  const row = document.createElement('li');
  const name = document.createElement('span');
  name.textContent = label;
  const count = document.createElement('span');
  count.textContent =
    outOf !== undefined && outOf !== value ? `${value} of ${outOf}` : String(value);
  row.append(name, count);
  return row;
}

/** Why an interrupted sync stopped, in a sentence. */
function describeReason(reason: string): string {
  switch (reason) {
    case 'helper_tab_closed':
      return 'the Classroom sync tab was closed';
    case 'not_signed_in':
      return 'Classroom was not signed in';
    case 'home_unreadable':
      return 'the Classroom home page could not be read';
    case 'unauthorized':
      return 'the API token was rejected';
    default:
      return reason.replace(/_/g, ' ');
  }
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function render(state: ExtensionState): void {
  setStatus(
    ui.statusClassroom,
    state.classroomDetected ? 'ok' : 'warn',
    state.classroomDetected
      ? 'Google Classroom is open'
      : 'Open Google Classroom to sync',
  );

  const connection = describeConnection(state.connection);
  setStatus(ui.statusConnection, connection.state, connection.text);

  ui.lastSync.textContent = state.sync.lastSuccessfulSyncAt
    ? `Last successful sync: ${formatTimestamp(state.sync.lastSuccessfulSyncAt)}`
    : 'No completed sync yet.';

  ui.progress.hidden = !state.syncing;
  if (state.syncing) renderProgress(state.progress);

  // While syncing, the live progress replaces the previous run's summary.
  if (state.syncing) {
    ui.result.hidden = true;
  } else if (state.lastSummary) {
    renderSummary(state.lastSummary);
  }

  ui.error.hidden = state.lastError === null;
  if (state.lastError) {
    /*
     * The helper tab closing is a specific, actionable thing, not a generic
     * failure, so it gets its own sentence and its own recovery.
     */
    ui.errorTitle.textContent =
      state.lastError.code === 'helper_tab_closed' ? 'Sync interrupted' : 'Sync failed';
    ui.errorMessage.textContent = state.lastError.message;
  }

  /*
   * Resume is offered when a previous run was interrupted and we are not
   * already running. It starts the same mode again; the per-item freshness
   * record is what stops it repeating work it already finished.
   */
  const interrupted = state.sync.interrupted;
  ui.resume.hidden = state.syncing || interrupted === null;
  if (interrupted) {
    ui.resumeNote.textContent = `The last sync stopped before it finished (${describeReason(interrupted.reason)}).`;
  }

  ui.syncButton.hidden = state.syncing;
  ui.cancelButton.hidden = !state.syncing;
  ui.syncButton.disabled = state.connection.state === 'unconfigured';
  ui.syncButton.textContent =
    state.sync.nextMode === 'initial_backfill' ? 'Start first sync' : 'Sync Classroom';

  ui.apiUrl.value = state.settings.apiUrl;
  ui.tokenHint.textContent = state.settings.hasToken
    ? 'A token is saved. Leave blank to keep it.'
    : 'No token saved yet.';
}

// --- actions --------------------------------------------------------------

async function refresh(): Promise<void> {
  const response = await send({ type: 'GET_STATE' });
  if (response.ok && response.type === 'STATE') {
    render(response.state);
  } else if (!response.ok) {
    ui.error.hidden = false;
    ui.errorMessage.textContent = response.error;
  }
}

ui.syncButton.addEventListener('click', () => {
  ui.error.hidden = true;
  ui.result.hidden = true;
  void send({ type: 'START_SYNC' }).then(refresh);
});

/*
 * Resume continues with the same policy; the stored per-item freshness makes
 * the already-read pages cheap to skip. Start again forces a full reread.
 */
ui.resumeButton.addEventListener('click', () => {
  ui.error.hidden = true;
  ui.resume.hidden = true;
  void send({ type: 'START_SYNC' }).then(refresh);
});

ui.restartButton.addEventListener('click', () => {
  ui.error.hidden = true;
  ui.resume.hidden = true;
  void send({ type: 'START_SYNC', mode: 'deep_reconcile' }).then(refresh);
});

ui.cancelButton.addEventListener('click', () => {
  ui.cancelButton.disabled = true;
  void send({ type: 'CANCEL_SYNC' });
});

ui.openApp.addEventListener('click', () => {
  void send({ type: 'GET_STATE' }).then((response) => {
    // The dashboard lives beside the API in dev; the API URL's host with the
    // web port is the best guess we can make without another setting.
    const apiUrl =
      response.ok && response.type === 'STATE'
        ? response.state.settings.apiUrl
        : 'http://localhost:4000';
    let webUrl = 'http://localhost:3000';
    try {
      const parsed = new URL(apiUrl);
      parsed.port = parsed.port === '4000' ? '3000' : parsed.port;
      webUrl = `${parsed.protocol}//${parsed.host}`;
    } catch {
      // Keep the default.
    }
    void chrome.tabs.create({ url: webUrl });
  });
});

ui.warningsToggle.addEventListener('click', () => {
  ui.warnings.hidden = !ui.warnings.hidden;
  ui.warningsToggle.textContent = ui.warnings.hidden ? 'View details' : 'Hide details';
});

ui.settingsToggle.addEventListener('click', () => {
  const opening = ui.settingsPanel.hidden;
  ui.settingsPanel.hidden = !opening;
  ui.mainPanel.hidden = opening;
  ui.settingsToggle.setAttribute('aria-expanded', String(opening));
  ui.settingsToggle.textContent = opening ? 'Back' : 'Settings';
});

ui.saveSettings.addEventListener('click', () => {
  ui.saveSettings.disabled = true;
  const previousLabel = ui.saveSettings.textContent;
  ui.saveSettings.textContent = 'Saving…';

  void (async () => {
    const response = await send({
      type: 'SAVE_SETTINGS',
      apiUrl: ui.apiUrl.value,
      apiToken: ui.apiToken.value,
    });

    ui.saveSettings.disabled = false;
    ui.saveSettings.textContent = previousLabel;

    if (!response.ok) {
      ui.tokenHint.textContent = response.error;
      return;
    }
    if (response.type === 'CONNECTION') {
      ui.tokenHint.textContent = describeConnection(response.connection).text;
      // Clear the field so the secret is not left sitting in the DOM.
      ui.apiToken.value = '';
    }
    await refresh();
  })();
});

ui.captureDiagnostics.addEventListener('click', () => {
  ui.captureDiagnostics.disabled = true;
  void (async () => {
    const response = await send({
      type: 'CAPTURE_DIAGNOSTICS',
      includeText: ui.includeText.checked,
    });
    ui.captureDiagnostics.disabled = false;

    if (!response.ok) {
      ui.diagnosticsOutput.value = response.error;
    } else if (response.type === 'DIAGNOSTICS') {
      ui.diagnosticsOutput.value = JSON.stringify(response.report, null, 2);
    }
    ui.diagnosticsOutput.hidden = false;
    ui.copyDiagnostics.hidden = false;
  })();
});

ui.copyDiagnostics.addEventListener('click', () => {
  void navigator.clipboard.writeText(ui.diagnosticsOutput.value).then(() => {
    ui.copyDiagnostics.textContent = 'Copied';
    setTimeout(() => {
      ui.copyDiagnostics.textContent = 'Copy to clipboard';
    }, 1500);
  });
});

// Live progress pushed from the background worker.
chrome.runtime.onMessage.addListener((message: ProgressBroadcast) => {
  if (message?.type === 'SYNC_PROGRESS') render(message.state);
  return false;
});

void refresh();
