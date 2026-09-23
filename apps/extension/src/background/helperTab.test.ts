import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HelperTab, HelperTabClosedError, sendToTab } from './helperTab.js';
import type { ContentResponse } from '../lib/messages.js';

/**
 * Helper tab tests.
 *
 * The bug these defend against had a very misleading symptom. When the user
 * closed the Classroom helper tab mid-sync, every subsequent navigation threw
 * immediately, the sync engine caught each throw as a recoverable per-item
 * failure, and `assignmentsDone` climbed through the entire remaining queue
 * in milliseconds. The popup showed a sync racing to completion while
 * nothing at all was being read.
 *
 * The distinction the code now has to hold: ONE BAD ASSIGNMENT is
 * recoverable; THE BROWSER MACHINERY DISAPPEARING is not.
 */

interface FakeTab {
  id: number;
  status: string;
  url: string;
}

let tabs: Map<number, FakeTab>;
let nextTabId: number;
let removedListeners: Array<(tabId: number) => void>;
let respond: (request: { type: string }) => ContentResponse | undefined;
let lastError: { message: string } | undefined;
let createdWindows: Array<Record<string, unknown>>;

function ready(): ContentResponse {
  return {
    ok: true,
    type: 'READY',
    readiness: {
      state: 'ready',
      target: 'home',
      url: 'https://classroom.google.com/h',
      waitedMs: 10,
      mutations: 1,
      documentHidden: false,
      signals: [],
    },
  };
}

beforeEach(() => {
  tabs = new Map();
  nextTabId = 100;
  removedListeners = [];
  createdWindows = [];
  lastError = undefined;
  respond = (request) => {
    if (request.type === 'PING') {
      return { ok: true, type: 'PONG', url: 'https://x', readyState: 'complete' };
    }
    if (request.type === 'AWAIT_READY') return ready();
    return { ok: true, type: 'ACK' } as unknown as ContentResponse;
  };

  vi.stubGlobal('chrome', {
    runtime: {
      get lastError() {
        return lastError;
      },
    },
    tabs: {
      create: vi.fn(async ({ url }: { url: string }) => {
        const tab = { id: nextTabId++, status: 'complete', url };
        tabs.set(tab.id, tab);
        return tab;
      }),
      update: vi.fn(async (id: number, { url }: { url: string }) => {
        const tab = tabs.get(id);
        if (!tab) throw new Error('No tab with id: ' + id);
        tab.url = url;
        return tab;
      }),
      get: vi.fn(async (id: number) => {
        const tab = tabs.get(id);
        if (!tab) throw new Error('No tab with id: ' + id);
        return tab;
      }),
      remove: vi.fn(async (id: number) => {
        tabs.delete(id);
      }),
      sendMessage: vi.fn(
        (
          id: number,
          request: { type: string },
          callback: (response: ContentResponse | undefined) => void,
        ) => {
          if (!tabs.has(id)) {
            lastError = { message: 'No tab with id: ' + id };
            callback(undefined);
            lastError = undefined;
            return;
          }
          callback(respond(request));
        },
      ),
      onRemoved: {
        addListener: (fn: (tabId: number) => void) => removedListeners.push(fn),
        removeListener: (fn: (tabId: number) => void) => {
          removedListeners = removedListeners.filter((f) => f !== fn);
        },
      },
    },
    windows: {
      create: vi.fn(async (options: Record<string, unknown>) => {
        createdWindows.push(options);
        return { id: 900 };
      }),
      remove: vi.fn(async () => {}),
    },
  });
});

afterEach(() => vi.unstubAllGlobals());

/** Simulate the user closing the helper tab. */
function userClosesTab(id: number): void {
  tabs.delete(id);
  removedListeners.forEach((fn) => fn(id));
}

describe('helper tab lifecycle', () => {
  it('opens in the background and never asks for focus', async () => {
    const helper = new HelperTab();
    await helper.goTo('https://classroom.google.com/h', 'home');

    expect(chrome.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({ active: false }),
    );
  });

  it('reuses one tab across navigations', async () => {
    const helper = new HelperTab();
    await helper.goTo('https://classroom.google.com/h', 'home');
    await helper.goTo('https://classroom.google.com/w/Njk5MjMxMjM/t/all', 'classwork');
    await helper.goTo('https://classroom.google.com/w/MTIzNDU2Nzg5/t/all', 'classwork');

    expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
    expect(chrome.tabs.update).toHaveBeenCalledTimes(2);
    expect(tabs.size).toBe(1);
  });

  it('returns the readiness result rather than assuming success', async () => {
    const helper = new HelperTab();
    const outcome = await helper.goTo('https://classroom.google.com/h', 'home');
    expect(outcome.readiness.state).toBe('ready');
    expect(outcome.escalated).toBe(false);
  });

  it('closes the tab on close()', async () => {
    const helper = new HelperTab();
    await helper.goTo('https://classroom.google.com/h', 'home');
    await helper.close();
    expect(tabs.size).toBe(0);
  });

  it('close() is safe to call twice', async () => {
    const helper = new HelperTab();
    await helper.goTo('https://classroom.google.com/h', 'home');
    await helper.close();
    await expect(helper.close()).resolves.toBeUndefined();
  });
});

describe('the helper tab being closed is fatal, not a per-item failure', () => {
  it('throws HelperTabClosedError from goTo once the tab is gone', async () => {
    const helper = new HelperTab();
    const unwatch = helper.watchForClosure();
    await helper.goTo('https://classroom.google.com/h', 'home');

    userClosesTab(100);

    await expect(
      helper.goTo('https://classroom.google.com/c/Njk5MjMxMjM/a/NTQzMjE5OA/details', 'assignment'),
    ).rejects.toBeInstanceOf(HelperTabClosedError);
    unwatch();
  });

  it('carries the helper_tab_closed code the UI keys off', async () => {
    const helper = new HelperTab();
    helper.watchForClosure();
    await helper.goTo('https://classroom.google.com/h', 'home');
    userClosesTab(100);

    await expect(helper.goTo('https://classroom.google.com/h', 'home')).rejects.toMatchObject({
      code: 'helper_tab_closed',
    });
  });

  it('throws from ask() too, not only from navigation', async () => {
    const helper = new HelperTab();
    helper.watchForClosure();
    await helper.goTo('https://classroom.google.com/h', 'home');
    userClosesTab(100);

    await expect(helper.ask({ type: 'EXTRACT_HOME' })).rejects.toBeInstanceOf(
      HelperTabClosedError,
    );
  });

  it('reports closure through wasClosedByUser', async () => {
    const helper = new HelperTab();
    helper.watchForClosure();
    await helper.goTo('https://classroom.google.com/h', 'home');
    expect(helper.wasClosedByUser()).toBe(false);
    userClosesTab(100);
    expect(helper.wasClosedByUser()).toBe(true);
  });

  it('stops listening once unwatched, so a later tab id cannot confuse it', async () => {
    const helper = new HelperTab();
    const unwatch = helper.watchForClosure();
    await helper.goTo('https://classroom.google.com/h', 'home');
    unwatch();
    userClosesTab(100);
    expect(helper.wasClosedByUser()).toBe(false);
  });

  it('translates Chrome’s "no tab with id" into the closed error', async () => {
    const helper = new HelperTab();
    await helper.goTo('https://classroom.google.com/h', 'home');
    tabs.delete(100); // gone, but no onRemoved event delivered

    await expect(helper.ask({ type: 'EXTRACT_HOME' })).rejects.toBeInstanceOf(
      HelperTabClosedError,
    );
  });
});

describe('a page failure is NOT fatal', () => {
  it('surfaces an ordinary extraction failure as a normal response', async () => {
    respond = (request) => {
      if (request.type === 'PING') {
        return { ok: true, type: 'PONG', url: 'https://x', readyState: 'complete' };
      }
      if (request.type === 'AWAIT_READY') return ready();
      return { ok: false, code: 'assignment_extract_failed', error: 'no title' };
    };

    const helper = new HelperTab();
    await helper.goTo('https://classroom.google.com/h', 'home');
    const response = await helper.ask({ type: 'EXTRACT_ASSIGNMENT' });

    // A normal failed response, not a thrown fatal error.
    expect(response.ok).toBe(false);
    expect(helper.wasClosedByUser()).toBe(false);
  });

  it('a page that does not answer is an ordinary error, not a closure', async () => {
    const helper = new HelperTab();
    await helper.goTo('https://classroom.google.com/h', 'home');
    respond = () => undefined;

    await expect(helper.ask({ type: 'EXTRACT_HOME' })).rejects.not.toBeInstanceOf(
      HelperTabClosedError,
    );
  });
});

describe('visibility escalation', () => {
  it('does not escalate when the page becomes ready normally', async () => {
    const helper = new HelperTab();
    const outcome = await helper.goTo('https://classroom.google.com/h', 'home');
    expect(outcome.escalated).toBe(false);
    expect(chrome.windows.create).not.toHaveBeenCalled();
  });

  it('escalates to an UNFOCUSED window when a hidden tab times out', async () => {
    let call = 0;
    respond = (request) => {
      if (request.type === 'PING') {
        return { ok: true, type: 'PONG', url: 'https://x', readyState: 'complete' };
      }
      if (request.type === 'AWAIT_READY') {
        call += 1;
        // First attempt: hidden and timed out. Second: fine.
        if (call === 1) {
          return {
            ok: true,
            type: 'READY',
            readiness: {
              state: 'timeout',
              target: 'home',
              url: 'https://classroom.google.com/h',
              waitedMs: 20_000,
              mutations: 0,
              documentHidden: true,
              signals: [],
            },
          };
        }
        return ready();
      }
      return { ok: true, type: 'ACK' } as unknown as ContentResponse;
    };

    const helper = new HelperTab();
    const outcome = await helper.goTo('https://classroom.google.com/h', 'home');

    expect(outcome.escalated).toBe(true);
    expect(outcome.readiness.state).toBe('ready');
    // The whole point: the user's focus is never taken.
    expect(createdWindows[0]).toMatchObject({ focused: false });
  });

  it('does not escalate when the timeout happened in a VISIBLE tab', async () => {
    respond = (request) => {
      if (request.type === 'PING') {
        return { ok: true, type: 'PONG', url: 'https://x', readyState: 'complete' };
      }
      if (request.type === 'AWAIT_READY') {
        return {
          ok: true,
          type: 'READY',
          readiness: {
            state: 'timeout',
            target: 'home',
            url: 'https://classroom.google.com/h',
            waitedMs: 20_000,
            mutations: 12,
            documentHidden: false,
            signals: [],
          },
        };
      }
      return { ok: true, type: 'ACK' } as unknown as ContentResponse;
    };

    const helper = new HelperTab();
    const outcome = await helper.goTo('https://classroom.google.com/h', 'home');
    // A visible tab that still could not render is a page problem, not a
    // throttling problem. Opening a window would not help.
    expect(outcome.escalated).toBe(false);
    expect(chrome.windows.create).not.toHaveBeenCalled();
  });

  it('can be disabled entirely', async () => {
    respond = (request) => {
      if (request.type === 'PING') {
        return { ok: true, type: 'PONG', url: 'https://x', readyState: 'complete' };
      }
      return {
        ok: true,
        type: 'READY',
        readiness: {
          state: 'timeout',
          target: 'home',
          url: 'https://classroom.google.com/h',
          waitedMs: 20_000,
          mutations: 0,
          documentHidden: true,
          signals: [],
        },
      };
    };

    const helper = new HelperTab({ allowVisibilityEscalation: false });
    const outcome = await helper.goTo('https://classroom.google.com/h', 'home');
    expect(outcome.escalated).toBe(false);
    expect(chrome.windows.create).not.toHaveBeenCalled();
  });
});

describe('sendToTab error classification', () => {
  it('rejects with HelperTabClosedError for a missing tab', async () => {
    await expect(sendToTab(999, { type: 'PING' })).rejects.toBeInstanceOf(
      HelperTabClosedError,
    );
  });
});
