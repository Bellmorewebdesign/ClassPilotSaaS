import type { ContentRequest, ContentResponse } from '../lib/messages.js';

/**
 * The inactive helper tab.
 *
 * Classroom is client-rendered, so reading an assignment means actually
 * loading its page. This class owns exactly ONE background tab that is
 * navigated from page to page, sequentially.
 *
 * Design constraints this enforces:
 *
 *   - `active: false` on create, and never `chrome.tabs.update({active:true})`.
 *     The user keeps working in Chrome; we never steal focus.
 *   - One tab, reused. Opening a tab per assignment would hammer Google and
 *     bury the user in tabs.
 *   - Sequential navigation with a settle delay, so we look like a person
 *     reading their own coursework rather than a crawler.
 *   - Every wait is bounded. A page that never finishes loading fails that
 *     one item and the sync continues.
 */

export interface HelperTabOptions {
  /** How long to wait for a page to reach readyState complete. */
  loadTimeoutMs?: number;
  /** Extra settle time after load for client-side rendering to finish. */
  settleMs?: number;
  /** Polite pause between navigations. */
  politenessDelayMs?: number;
}

const DEFAULTS = {
  loadTimeoutMs: 25_000,
  settleMs: 1_200,
  politenessDelayMs: 600,
} as const;

export class HelperTab {
  private tabId: number | null = null;
  private readonly options: Required<HelperTabOptions>;

  constructor(options: HelperTabOptions = {}) {
    this.options = {
      loadTimeoutMs: options.loadTimeoutMs ?? DEFAULTS.loadTimeoutMs,
      settleMs: options.settleMs ?? DEFAULTS.settleMs,
      politenessDelayMs: options.politenessDelayMs ?? DEFAULTS.politenessDelayMs,
    };
  }

  /**
   * Navigate the helper tab to a URL and wait until it is extractable.
   * Creates the tab on first use.
   */
  async goTo(url: string): Promise<void> {
    if (this.tabId === null) {
      // active: false is the whole point -- the tab opens in the background
      // and the user's current tab keeps focus.
      const tab = await chrome.tabs.create({ url, active: false });
      if (tab.id === undefined) {
        throw new Error('Chrome did not return an id for the helper tab');
      }
      this.tabId = tab.id;
    } else {
      await chrome.tabs.update(this.tabId, { url, active: false });
    }

    await this.waitForLoad(this.tabId);
    await delay(this.options.settleMs);
  }

  /** Send an extraction request to the helper tab's content script. */
  async ask(request: ContentRequest): Promise<ContentResponse> {
    if (this.tabId === null) {
      throw new Error('Helper tab has not been opened');
    }
    return sendToTab(this.tabId, request);
  }

  /** Polite pause before the next navigation. */
  async pause(): Promise<void> {
    await delay(this.options.politenessDelayMs);
  }

  /** Close the helper tab. Safe to call twice. */
  async close(): Promise<void> {
    if (this.tabId === null) return;
    const id = this.tabId;
    this.tabId = null;
    try {
      await chrome.tabs.remove(id);
    } catch {
      // Already gone (user closed it, or the browser did). Nothing to do.
    }
  }

  /**
   * Wait for the tab to finish loading AND for its content script to answer
   * a ping.
   *
   * Both halves matter: `status === 'complete'` only means the document
   * loaded, and on a client-rendered app the content script may still be
   * starting up. Polling for a PONG is what makes the wait meaningful.
   */
  private async waitForLoad(tabId: number): Promise<void> {
    const deadline = Date.now() + this.options.loadTimeoutMs;

    while (Date.now() < deadline) {
      let tab: chrome.tabs.Tab;
      try {
        tab = await chrome.tabs.get(tabId);
      } catch {
        throw new Error('The helper tab was closed during the sync');
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
        reject(new Error(error.message ?? 'Could not reach the page'));
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
