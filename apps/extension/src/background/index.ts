import { isClassroomUrl } from '@classpilot/shared';
import { ApiClient, ApiClientError } from '../lib/apiClient.js';
import type {
  ConnectionStatus,
  ExtensionState,
  PopupRequest,
  PopupResponse,
  ProgressBroadcast,
  SyncProgress,
  SyncSummary,
} from '../lib/messages.js';
import { loadSettings, saveSettings, normalizeApiUrl } from '../lib/settings.js';
import { sendToTab } from './helperTab.js';
import { SyncAbortedError, runSync } from './syncEngine.js';

/**
 * MV3 service worker: the extension's coordinator.
 *
 * It owns the sync lifecycle and is the only context that talks to the API.
 * The popup is a thin view over the state published here, which is what
 * lets the user close the popup mid-sync without interrupting anything.
 *
 * A service worker can be terminated by Chrome at any time. Durable state
 * (settings, last sync summary) therefore lives in chrome.storage.local, and
 * only the in-flight sync is held in memory.
 */

const CLIENT_VERSION = chrome.runtime.getManifest().version;
const LAST_SUMMARY_KEY = 'classpilot.lastSummary';

interface RuntimeState {
  syncing: boolean;
  cancelRequested: boolean;
  progress: SyncProgress;
  lastError: { code: string; message: string } | null;
}

const runtime: RuntimeState = {
  syncing: false,
  cancelRequested: false,
  progress: idleProgress(),
  lastError: null,
};

function idleProgress(): SyncProgress {
  return {
    phase: 'idle',
    classesDone: 0,
    classesTotal: 0,
    assignmentsDone: 0,
    assignmentsTotal: 0,
    currentLabel: null,
  };
}

// ---------------------------------------------------------------------------
// State assembly
// ---------------------------------------------------------------------------

async function getLastSummary(): Promise<SyncSummary | null> {
  const stored = await chrome.storage.local.get(LAST_SUMMARY_KEY);
  return (stored[LAST_SUMMARY_KEY] as SyncSummary | undefined) ?? null;
}

async function setLastSummary(summary: SyncSummary): Promise<void> {
  await chrome.storage.local.set({ [LAST_SUMMARY_KEY]: summary });
}

/** Is the user's active tab on Google Classroom right now? */
async function isClassroomActive(): Promise<boolean> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return isClassroomUrl(tab?.url ?? null);
  } catch {
    return false;
  }
}

async function checkConnection(): Promise<ConnectionStatus> {
  const settings = await loadSettings();
  if (settings.apiToken === '') return { state: 'unconfigured' };

  try {
    const me = await new ApiClient(settings).whoAmI();
    return { state: 'ok', email: me.email, apiUrl: settings.apiUrl };
  } catch (error) {
    if (error instanceof ApiClientError && error.kind === 'unauthorized') {
      return { state: 'unauthorized', apiUrl: settings.apiUrl };
    }
    return {
      state: 'unreachable',
      apiUrl: settings.apiUrl,
      detail: error instanceof Error ? error.message : 'unknown error',
    };
  }
}

async function buildState(connection?: ConnectionStatus): Promise<ExtensionState> {
  const settings = await loadSettings();
  return {
    settings: { apiUrl: settings.apiUrl, hasToken: settings.apiToken !== '' },
    connection: connection ?? (await checkConnection()),
    classroomDetected: await isClassroomActive(),
    syncing: runtime.syncing,
    progress: runtime.progress,
    lastSummary: await getLastSummary(),
    lastError: runtime.lastError,
  };
}

/**
 * Push state to any open popup.
 *
 * The popup may be closed, in which case sendMessage rejects. That is normal
 * and must be swallowed -- it is not a sync failure.
 */
async function broadcast(): Promise<void> {
  const message: ProgressBroadcast = { type: 'SYNC_PROGRESS', state: await buildState() };
  try {
    await chrome.runtime.sendMessage(message);
  } catch {
    // No popup listening.
  }
}

// ---------------------------------------------------------------------------
// Sync lifecycle
// ---------------------------------------------------------------------------

async function startSync(): Promise<void> {
  if (runtime.syncing) return;

  const settings = await loadSettings();
  if (settings.apiToken === '') {
    runtime.lastError = {
      code: 'unconfigured',
      message: 'ClassPilot is not connected yet. Open Settings and paste your API token.',
    };
    await broadcast();
    return;
  }

  runtime.syncing = true;
  runtime.cancelRequested = false;
  runtime.lastError = null;
  runtime.progress = idleProgress();
  await broadcast();

  try {
    const summary = await runSync({
      client: new ApiClient(settings),
      clientVersion: CLIENT_VERSION,
      onProgress: (progress) => {
        runtime.progress = progress;
        void broadcast();
      },
      isCancelled: () => runtime.cancelRequested,
    });

    await setLastSummary(summary);
    runtime.progress = { ...runtime.progress, phase: 'complete' };
  } catch (error) {
    runtime.progress = { ...runtime.progress, phase: 'failed' };
    runtime.lastError =
      error instanceof SyncAbortedError
        ? { code: error.code, message: error.message }
        : {
            code: 'sync_failed',
            message:
              error instanceof Error
                ? error.message
                : 'The sync stopped unexpectedly.',
          };
  } finally {
    runtime.syncing = false;
    runtime.cancelRequested = false;
    await broadcast();
  }
}

// ---------------------------------------------------------------------------
// Popup message handling
// ---------------------------------------------------------------------------

async function handlePopupRequest(request: PopupRequest): Promise<PopupResponse> {
  switch (request.type) {
    case 'GET_STATE':
      return { ok: true, type: 'STATE', state: await buildState() };

    case 'START_SYNC':
      // Deliberately not awaited: the popup gets an immediate acknowledgement
      // and follows along via SYNC_PROGRESS broadcasts, so it can be closed
      // and reopened mid-sync.
      void startSync();
      return { ok: true, type: 'ACK' };

    case 'CANCEL_SYNC':
      runtime.cancelRequested = true;
      return { ok: true, type: 'ACK' };

    case 'SAVE_SETTINGS': {
      const apiUrl = normalizeApiUrl(request.apiUrl);
      if (!apiUrl) {
        return {
          ok: false,
          code: 'invalid_api_url',
          error: 'Enter a full URL, for example http://localhost:4000',
        };
      }
      await saveSettings({ apiUrl, apiToken: request.apiToken });
      // Host permission for a custom API origin is requested lazily, so the
      // installed extension asks for the minimum up front.
      await ensureHostPermission(apiUrl);
      return { ok: true, type: 'CONNECTION', connection: await checkConnection() };
    }

    case 'TEST_CONNECTION':
      return { ok: true, type: 'CONNECTION', connection: await checkConnection() };

    case 'CAPTURE_DIAGNOSTICS': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !isClassroomUrl(tab.url ?? null)) {
        return {
          ok: false,
          code: 'not_on_classroom',
          error: 'Open a Google Classroom page first, then capture diagnostics.',
        };
      }
      const response = await sendToTab(tab.id, {
        type: 'CAPTURE_STRUCTURE',
        includeText: request.includeText,
      });
      if (!response.ok || response.type !== 'STRUCTURE') {
        return {
          ok: false,
          code: 'capture_failed',
          error: 'Could not read this page. Try reloading it first.',
        };
      }
      return { ok: true, type: 'DIAGNOSTICS', report: response.report };
    }
  }
}

/**
 * Ask for host permission for the configured API origin.
 *
 * The manifest requests only classroom.google.com up front. The API origin is
 * whatever the user configures, so it is requested here, once, at the moment
 * they save it.
 *
 * A refusal is not fatal: the API's CORS configuration allows
 * chrome-extension:// origins, so fetch still works in the common case.
 */
async function ensureHostPermission(apiUrl: string): Promise<void> {
  const origin = `${apiUrl}/*`;
  try {
    const alreadyGranted = await chrome.permissions.contains({ origins: [origin] });
    if (!alreadyGranted) {
      await chrome.permissions.request({ origins: [origin] });
    }
  } catch {
    // Chrome refuses permission requests outside a user gesture in some
    // contexts. CORS covers us, so this is not worth failing the save over.
  }
}

chrome.runtime.onMessage.addListener(
  (
    message: PopupRequest | { type: 'CONTENT_READY'; url: string },
    _sender,
    sendResponse: (response: PopupResponse) => void,
  ) => {
    if (message.type === 'CONTENT_READY') {
      // Informational only; the popup reads tab state directly.
      return false;
    }

    handlePopupRequest(message)
      .then(sendResponse)
      .catch((error: unknown) => {
        sendResponse({
          ok: false,
          code: 'background_error',
          error: error instanceof Error ? error.message : 'Unexpected error',
        });
      });

    // Returning true keeps the message channel open for the async response.
    return true;
  },
);

chrome.runtime.onInstalled.addListener(() => {
  console.info('[ClassPilot] extension installed, version', CLIENT_VERSION);
});
