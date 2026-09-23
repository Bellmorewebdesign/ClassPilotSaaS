import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { brand, brandMarkup } from '@classpilot/shared';
import type {
  ExtensionState,
  PopupRequest,
  ProgressBroadcast,
} from '../lib/messages.js';

const state: ExtensionState = {
  settings: { apiUrl: 'http://localhost:4000', hasToken: true },
  connection: {
    state: 'ok',
    email: 'student@example.test',
    apiUrl: 'http://localhost:4000',
  },
  classroomDetected: true,
  syncing: false,
  progress: {
    phase: 'idle',
    mode: 'incremental',
    classesDone: 0,
    classesTotal: 0,
    assignmentsDone: 0,
    assignmentsTotal: 0,
    announcementsFound: 0,
    currentLabel: null,
    waitingForClassroom: false,
  },
  lastSummary: null,
  lastError: null,
  sync: {
    lastSuccessfulSyncAt: null,
    lastDeepScanAt: null,
    nextMode: 'incremental',
    interrupted: null,
  },
};

const sendMessage = vi.fn(async (request: PopupRequest) => {
  if (request.type === 'GET_STATE') return { ok: true, type: 'STATE', state };
  if (request.type === 'SAVE_SETTINGS')
    return { ok: true, type: 'CONNECTION', connection: state.connection };
  return { ok: true, type: 'ACK' };
});
const createTab = vi.fn();
let onProgress: (message: ProgressBroadcast) => void;
const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  document.documentElement.innerHTML = brandMarkup(
    readFileSync('public/popup.html', 'utf8').replace(/<link[^>]*>/g, '').replace(/<script[^>]*><\/script>/g, ''),
  );
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage,
      onMessage: {
        addListener: (listener: typeof onProgress) => {
          onProgress = listener;
        },
      },
    },
    tabs: { create: createTab },
  });
  await import('./main.js');
});
afterEach(() => vi.unstubAllGlobals());

describe('branded popup keeps the existing extension protocol', () => {
  it('hydrates connection state and sends the unchanged sync request', async () => {
    // The header is the official Brand Kit v2 Sync lockup, not a hand-set
    // approximation. Its alt text still carries the accessible name.
    const lockup = document.querySelector<HTMLImageElement>('h1 img.lockup');
    expect(lockup?.getAttribute('src')).toBe('coursen-sync.svg');
    expect(lockup?.alt).toBe(brand.extensionName);
    await vi.waitFor(() =>
      expect(element('status-connection').textContent).toContain(
        'student@example.test',
      ),
    );
    element('sync-button').click();
    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({ type: 'START_SYNC' }),
    );
  });

  it('saves settings, clears the secret, and opens the configured local app', async () => {
    element('settings-toggle').click();
    expect(element('settings-panel').hidden).toBe(false);
    expect(element('settings-toggle').getAttribute('aria-expanded')).toBe(
      'true',
    );
    element<HTMLInputElement>('api-token').value = 'test-only-secret';
    element('save-settings').click();
    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({
        type: 'SAVE_SETTINGS',
        apiUrl: state.settings.apiUrl,
        apiToken: 'test-only-secret',
      }),
    );
    await vi.waitFor(() =>
      expect(element<HTMLInputElement>('api-token').value).toBe(''),
    );
    element('open-app').click();
    await vi.waitFor(() =>
      expect(createTab).toHaveBeenCalledWith({ url: 'http://localhost:3000' }),
    );
  });

  it('renders live progress with the shared brand and preserves cancellation', () => {
    onProgress({
      type: 'SYNC_PROGRESS',
      state: {
        ...state,
        syncing: true,
        progress: {
          ...state.progress,
          phase: 'uploading',
          classesDone: 1,
          classesTotal: 2,
        },
      },
    });
    expect(element('progress').hidden).toBe(false);
    expect(element('progress-phase').textContent).toBe(
      `Saving to ${brand.shortName}…`,
    );
    expect(element('bar-classes').style.width).toBe('50%');
    element('cancel-button').click();
    expect(sendMessage).toHaveBeenCalledWith({ type: 'CANCEL_SYNC' });
  });
});
