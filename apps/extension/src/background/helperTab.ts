import type { ContentRequest, ContentResponse } from '../lib/messages.js';
import type { ReadinessResult, ReadinessTarget } from '../extractors/readiness.js';

/**
 * The inactive helper tab.
 *
 * Classroom is client-rendered, so reading an assignment means actually
 * loading its page. This class owns exactly ONE background tab that is
 * navigated from page to page, sequentially.
 *
 * Design constraints this enforces:
 *
 *   - The user's focus is never taken. The tab opens with `active: false`
 *     and the window it lives in is never focused.
 *   - One tab, reused. Opening a tab per assignment would hammer Google and
 *     bury the user in tabs.
 *   - Sequential navigation with a polite pause, so we look like a person
 *     reading their own coursework rather than a crawler.
 *   - Every wait is bounded.
 *   - The tab disappearing is FATAL, not a per-item failure. See
 *     HelperTabClosedError.
 *
 * ---------------------------------------------------------------------------
 * READINESS
 *
 * The previous version considered a page extractable when
 * `tab.status === 'complete'`, the content script answered PING, and a flat
 * 1200ms had passed. On a client-rendered app that combination says nothing
 * about what is rendered, which is why syncs returned zero classes unless the
 * user happened to click the helper tab. `goTo` now additionally asks the
 * content script to wait for the SEMANTIC state the extractor needs, and
 * returns the structured result.
 *
 * ---------------------------------------------------------------------------
 * BACKGROUND TAB THROTTLING - WHAT IS AND IS NOT TRUE
 *
 * Chromium deprioritises hidden tabs in ways that matter here:
 *
 *   - `setTimeout`/`setInterval` are throttled (to ~1/second after 30s
 *     hidden, harder under intensive throttling after 5 minutes).
 *   - `requestAnimationFrame` callbacks do not run at all while hidden.
 *   - Rendering work is deprioritised, and IntersectionObserver-driven lazy
 *     loading may therefore never trigger.
 *
 * MutationObserver is NOT throttled, which is why the readiness wait is built
 * on it. That covers the throttling half of the problem.
 *
 * What it cannot cover: if Classroom defers rendering to rAF or to
 * viewport-intersection, the content genuinely never appears while the tab is
 * hidden, and no amount of patient waiting in that tab will change it.
 *
 * The escalation for that case deliberately does NOT call
 * `chrome.tabs.update({active: true})` on the user's window, which would
 * steal focus. Instead the helper tab is moved into its own unfocused window,
 * where it is that window's active tab. Chromium reports `visibilityState`
 * as "visible" for the active tab of a non-focused window, so rendering and
 * rAF proceed while the user's own window keeps focus. The window is closed
 * with the tab.
 *
 * This escalation only happens after a readiness timeout, it is reported in
 * the sync warnings, and it is bounded like everything else.
 */

export interface HelperTabOptions {
  /** How long to wait for a page to reach readyState complete. */
  loadTimeoutMs?: number;
  /** How long to wait for the page to become semantically extractable. */
  readyTimeoutMs?: number;
  /** Polite pause between navigations. */
  politenessDelayMs?: number;
  /**
   * Whether a readiness timeout in a hidden tab may escalate to an unfocused
   * window. Off in tests.
   */
  allowVisibilityEscalation?: boolean;
}

const DEFAULTS = {
  loadTimeoutMs: 25_000,
  readyTimeoutMs: 20_000,
  politenessDelayMs: 600,
  allowVisibilityEscalation: true,
} as const;

/**
 * The helper tab is gone.
 *
 * This is the difference between "one assignment could not be read" and "the
 * machinery that reads assignments no longer exists". The sync engine treats
 * it as fatal: continuing would march through the remaining queue failing
 * instantly, which looks like rapid progress and is a lie.
 */
export class HelperTabClosedError extends Error {
  readonly code = 'helper_tab_closed';
  constructor(message = 'The Classroom sync tab was closed.') {
    super(message);
    this.name = 'HelperTabClosedError';
  }
}

export interface NavigationOutcome {
  readonly readiness: ReadinessResult;
  /** True when the helper had to be made visible to finish rendering. */
  readonly escalated: boolean;
}

export class HelperTab {
  private tabId: number | null = null;
  /** Set when the helper lives in its own window, so it can be cleaned up. */
  private ownWindowId: number | null = null;
  private closedByUser = false;
  private readonly options: Required<HelperTabOptions>;

  constructor(options: HelperTabOptions = {}) {
    this.options = {
      loadTimeoutMs: options.loadTimeoutMs ?? DEFAULTS.loadTimeoutMs,
      readyTimeoutMs: options.readyTimeoutMs ?? DEFAULTS.readyTimeoutMs,
      politenessDelayMs: options.politenessDelayMs ?? DEFAULTS.politenessDelayMs,
      allowVisibilityEscalation:
        options.allowVisibilityEscalation ?? DEFAULTS.allowVisibilityEscalation,
    };
  }

  /**
   * Start watching for the user closing the helper tab.
   *
   * Without this we only find out when the next navigation fails, by which
   * point the engine has to infer the cause from an error message.
   */
  watchForClosure(): () => void {
    const onRemoved = (removedId: number): void => {
      if (this.tabId !== null && removedId === this.tabId) {
        this.closedByUser = true;
        this.tabId = null;
      }
    };
    chrome.tabs.onRemoved.addListener(onRemoved);
    return () => chrome.tabs.onRemoved.removeListener(onRemoved);
  }

  /** Has the user closed the helper tab out from under us? */
  wasClosedByUser(): boolean {
    return this.closedByUser;
  }

  /**
   * Navigate the helper tab to a URL and wait until it is actually
   * extractable for `target`. Creates the tab on first use.
   *
   * @throws HelperTabClosedError when the tab no longer exists.
   */
  async goTo(url: string, target: ReadinessTarget): Promise<NavigationOutcome> {
    this.assertAlive();

    if (this.tabId === null) {
      // active: false is the whole point - the tab opens in the background
      // and the user's current tab keeps focus.
      const tab = await chrome.tabs.create({ url, active: false });
      if (tab.id === undefined) {
        throw new Error('Chrome did not return an id for the helper tab');
      }
      this.tabId = tab.id;
    } else {
      try {
        await chrome.tabs.update(this.tabId, { url, active: false });
      } catch {
        throw new HelperTabClosedError();
      }
    }

    await this.waitForLoad(this.tabId);

    let readiness = await this.awaitReady(target);
    let escalated = false;

    /*
     * The one case worth escalating: we timed out, the tab was hidden for the
     * entire wait, and the page never reached a terminal state. That is the
     * signature of rendering that Chromium is holding back, not of a page
     * with nothing on it.
     */
    if (
      readiness.state === 'timeout' &&
      readiness.documentHidden &&
      this.options.allowVisibilityEscalation
    ) {
      await this.makeVisibleWithoutFocus();
      escalated = true;
      readiness = await this.awaitReady(target);
    }

    return { readiness, escalated };
  }

  /** Send an extraction request to the helper tab's content script. */
  async ask(request: ContentRequest): Promise<ContentResponse> {
    this.assertAlive();
    if (this.tabId === null) {
      throw new HelperTabClosedError('Helper tab has not been opened');
    }
    return sendToTab(this.tabId, request);
  }

  /** Polite pause before the next navigation. */
  async pause(): Promise<void> {
    await delay(this.options.politenessDelayMs);
  }

  /** Close the helper tab, and its window if it has one. Safe to call twice. */
  async close(): Promise<void> {
    const id = this.tabId;
    const windowId = this.ownWindowId;
    this.tabId = null;
    this.ownWindowId = null;

    if (windowId !== null) {
      try {
        await chrome.windows.remove(windowId);
        return;
      } catch {
        // Fall through and try the tab directly.
      }
    }
    if (id === null) return;
    try {
      await chrome.tabs.remove(id);
    } catch {
      // Already gone (user closed it, or the browser did). Nothing to do.
    }
  }

  private assertAlive(): void {
    if (this.closedByUser) throw new HelperTabClosedError();
  }

  /**
   * Give the helper tab a visible rendering context without taking focus.
   *
   * Chromium reports visibilityState "visible" for the ACTIVE tab of a window
   * even when that window is not the focused one. Moving the helper into its
   * own unfocused window therefore restores full rendering while the user
   * keeps working in theirs. `focused: false` is the load-bearing part.
   */
  private async makeVisibleWithoutFocus(): Promise<void> {
    if (this.tabId === null) throw new HelperTabClosedError();
    if (this.ownWindowId !== null) return;

    try {
      const window = await chrome.windows.create({
        tabId: this.tabId,
        focused: false,
        type: 'normal',
        width: 1024,
        height: 800,
      });
      if (window?.id !== undefined) this.ownWindowId = window.id;
    } catch {
      /*
       * Some platforms refuse `focused: false` on window creation. Rather
       * than fall back to stealing the user's focus, stay hidden and let the
       * caller report a readiness timeout. A slow sync is better than a
       * browser that jumps around while someone is typing.
       */
    }
  }

  /** Ask the content script to wait for the page to become extractable. */
  private async awaitReady(target: ReadinessTarget): Promise<ReadinessResult> {
    const response = await this.ask({
      type: 'AWAIT_READY',
      target,
      timeoutMs: this.options.readyTimeoutMs,
    });
    if (response.ok && response.type === 'READY') return response.readiness;

    // The content script could not answer at all. Report it as a timeout
    // with no signals rather than inventing a state.
    return {
      state: 'timeout',
      target,
      url: '',
      waitedMs: 0,
      mutations: 0,
      documentHidden: true,
      signals: [],
    };
  }

  /**
   * Wait for the tab to finish loading AND for its content script to answer
   * a ping.
   *
   * This is now only the FIRST half of the wait. It proves the document
   * loaded and the content script is reachable; `awaitReady` proves the page
   * is worth reading.
   */
  private async waitForLoad(tabId: number): Promise<void> {
    const deadline = Date.now() + this.options.loadTimeoutMs;

    while (Date.now() < deadline) {
      this.assertAlive();

      let tab: chrome.tabs.Tab;
      try {
        tab = await chrome.tabs.get(tabId);
      } catch {
        this.closedByUser = true;
        this.tabId = null;
        throw new HelperTabClosedError();
      }

      if (tab.status === 'complete') {
        try {
          const response = await sendToTab(tabId, { type: 'PING' });
          if (response.ok && response.type === 'PONG') return;
        } catch {
          // Content script not injected yet; keep waiting.
        }
      }

      await delay(250);
    }

    throw new Error('Timed out waiting for the page to load');
  }
}

/**
 * Promise wrapper around chrome.tabs.sendMessage.
 *
 * chrome.runtime.lastError has to be read explicitly, otherwise Chrome logs
 * "Unchecked runtime.lastError" noise for every message sent to a tab whose
 * content script is not ready -- which happens constantly during a sync.
 */
export function sendToTab(tabId: number, request: ContentRequest): Promise<ContentResponse> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, request, (response: ContentResponse | undefined) => {
      const error = chrome.runtime.lastError;
      if (error) {
        const message = error.message ?? 'Could not reach the page';
        // Chrome's wording for a tab that no longer exists. Distinguishing it
        // here is what lets the engine abort instead of logging a warning.
        if (/No tab with id|Receiving end does not exist|tab was closed/i.test(message)) {
          reject(new HelperTabClosedError());
          return;
        }
        reject(new Error(message));
        return;
      }
      if (!response) {
        reject(new Error('The page did not respond'));
        return;
      }
      resolve(response);
    });
  });
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
