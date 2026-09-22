import { parseClassroomUrl } from '@classpilot/shared';
import { isAriaHidden, links, mainRegion } from './dom.js';

/**
 * Classroom readiness.
 *
 * THE PROBLEM THIS REPLACES
 *
 * The helper tab used to decide a page was extractable when
 * `tab.status === 'complete'`, a content script answered PING, and a flat
 * 1200ms had elapsed. None of those say anything about what is RENDERED.
 * Google Classroom is a client-rendered app: the document finishes loading,
 * the content script boots, the settle timer expires - and the class cards
 * may still not exist. The extractor then reads an empty DOM and the sync
 * honestly reports zero classes.
 *
 * WHAT READINESS MEANS INSTEAD
 *
 * Each page type declares the SEMANTIC STATE its extractor needs, and the
 * wait ends when the page reaches it - or when it reaches a legitimate
 * terminal state that is not an error:
 *
 *   home        signed-in shell with class links, OR a recognisable empty
 *               Classroom, OR a signed-out page (terminal, reported)
 *   classwork   coursework item links, OR a recognisable empty classwork page
 *   assignment  an assignment/material detail shell with a title
 *   stream      stream posts, OR a recognisable empty stream
 *
 * Every wait is bounded, every outcome is structured, and "not ready yet" is
 * never confused with "nothing there".
 *
 * WHY THE WAIT IS DRIVEN BY MutationObserver
 *
 * Chrome throttles `setTimeout` in hidden tabs - to once a second after 30s,
 * and far harder under intensive throttling. A polling loop in a background
 * tab is therefore both slow and unreliable. MutationObserver callbacks are
 * delivered on the microtask checkpoint and are NOT timer-throttled, so the
 * observer does the work and the timer is only a bounded backstop.
 */

export type ReadinessTarget = 'home' | 'classwork' | 'assignment' | 'stream';

export type ReadinessState =
  /** The extractor's required content is present. */
  | 'ready'
  /** The page rendered, and it legitimately has nothing to extract. */
  | 'empty'
  /** The browser session is not signed into Classroom. */
  | 'signed_out'
  /** The URL is not the page kind we asked for. */
  | 'wrong_page'
  /** Bounded wait elapsed without reaching any of the above. */
  | 'timeout';

export interface ReadinessSignal {
  /** Stable name, so a diagnostic report names the check that failed. */
  readonly name: string;
  /** What the check looks at, in one line. */
  readonly describes: string;
  readonly found: boolean;
  /** Count, where the signal is a population rather than a flag. */
  readonly count?: number;
}

export interface ReadinessResult {
  readonly state: ReadinessState;
  readonly target: ReadinessTarget;
  readonly url: string;
  /** How long the wait actually took. */
  readonly waitedMs: number;
  /** How many DOM mutation batches were observed while waiting. */
  readonly mutations: number;
  /** Was the tab hidden for the whole wait? Explains a slow or failed wait. */
  readonly documentHidden: boolean;
  readonly signals: ReadinessSignal[];
}

/** A single evaluation of the page against one target's requirements. */
interface Probe {
  state: Exclude<ReadinessState, 'timeout'> | null;
  signals: ReadinessSignal[];
}

// ---------------------------------------------------------------------------
// Signals
// ---------------------------------------------------------------------------

/**
 * Classroom redirects a signed-out visitor to accounts.google.com, so a
 * signed-out state is usually invisible to us - we simply are not on
 * classroom.google.com any more. This catches the in-page variant.
 */
function signedOutSignal(document: Document, url: string): ReadinessSignal {
  const parsed = parseClassroomUrl(url);
  const offClassroom = !parsed.isClassroom;
  const signInLink =
    document.querySelector('a[href*="accounts.google.com"], form[action*="accounts.google.com"]') !==
    null;
  return {
    name: 'signedOut',
    describes: 'url left classroom.google.com, or an accounts.google.com form is present',
    found: offClassroom || signInLink,
  };
}

/** Anchors to a class, which is how the home page exposes enrolment. */
function classLinkCount(document: Document): number {
  let count = 0;
  const seen = new Set<string>();
  for (const anchor of links(document)) {
    if (isAriaHidden(anchor)) continue;
    const parsed = parseClassroomUrl(anchor.getAttribute('href'));
    if (parsed.courseId && !parsed.courseWorkId && !seen.has(parsed.courseId)) {
      seen.add(parsed.courseId);
      count += 1;
    }
  }
  return count;
}

/** Anchors to a coursework item, which is how classwork exposes its items. */
function courseWorkLinkCount(document: Document): number {
  const seen = new Set<string>();
  for (const anchor of links(document)) {
    if (isAriaHidden(anchor)) continue;
    const parsed = parseClassroomUrl(anchor.getAttribute('href'));
    if (parsed.courseWorkId) seen.add(parsed.courseWorkId);
  }
  return seen.size;
}

/**
 * Has the app shell rendered at all?
 *
 * Classroom's shell is a <main> (or role="main") with real content in it. An
 * app that has booted but not yet painted its data still has the shell, which
 * is what distinguishes "rendering" from "blank".
 */
function shellSignal(document: Document): ReadinessSignal {
  const main = mainRegion(document);
  const hasShell =
    document.querySelector('[role="main"], main') !== null &&
    (main.textContent ?? '').trim().length > 0;
  return {
    name: 'appShell',
    describes: 'role=main / <main> exists and carries text',
    found: hasShell,
  };
}

/**
 * A page that has rendered and is legitimately empty.
 *
 * Distinguishing this from "still loading" is the whole difficulty. The
 * signal we trust: the shell is present AND the app has stopped showing a
 * busy indicator. Classroom marks loading regions with aria-busy or a
 * progressbar role, both of which it maintains for accessibility.
 */
function busySignal(document: Document): ReadinessSignal {
  const busy =
    document.querySelector('[aria-busy="true"], [role="progressbar"]') !== null;
  return {
    name: 'busy',
    describes: 'aria-busy=true or role=progressbar present',
    found: busy,
  };
}

// ---------------------------------------------------------------------------
// Per-target probes
// ---------------------------------------------------------------------------

function probeHome(document: Document, url: string): Probe {
  const signedOut = signedOutSignal(document, url);
  const shell = shellSignal(document);
  const busy = busySignal(document);
  const classes = classLinkCount(document);
  const classSignal: ReadinessSignal = {
    name: 'classLinks',
    describes: 'anchors matching /c/<courseId>',
    found: classes > 0,
    count: classes,
  };
  const signals = [signedOut, shell, busy, classSignal];

  if (signedOut.found) return { state: 'signed_out', signals };
  if (classSignal.found) return { state: 'ready', signals };
  // Shell up, nothing left loading, still no classes: genuinely no enrolment.
  if (shell.found && !busy.found) return { state: 'empty', signals };
  return { state: null, signals };
}

function probeClasswork(document: Document, url: string): Probe {
  const parsed = parseClassroomUrl(url);
  const signedOut = signedOutSignal(document, url);
  const shell = shellSignal(document);
  const busy = busySignal(document);
  const items = courseWorkLinkCount(document);
  const itemSignal: ReadinessSignal = {
    name: 'courseWorkLinks',
    describes: 'anchors matching /a/<id> or /m/<id>',
    found: items > 0,
    count: items,
  };
  const onClasswork: ReadinessSignal = {
    name: 'classworkUrl',
    describes: 'url path is /w/<courseId>',
    found: parsed.kind === 'class_classwork',
  };
  const signals = [signedOut, onClasswork, shell, busy, itemSignal];

  if (signedOut.found) return { state: 'signed_out', signals };
  if (!onClasswork.found && parsed.isClassroom) return { state: 'wrong_page', signals };
  if (itemSignal.found) return { state: 'ready', signals };
  if (shell.found && !busy.found) return { state: 'empty', signals };
  return { state: null, signals };
}

function probeAssignment(document: Document, url: string): Probe {
  const parsed = parseClassroomUrl(url);
  const signedOut = signedOutSignal(document, url);
  const shell = shellSignal(document);
  const busy = busySignal(document);

  const onDetail: ReadinessSignal = {
    name: 'detailUrl',
    describes: 'url path is /c/<courseId>/a|m/<workId>',
    found: parsed.courseWorkId !== null,
  };

  /*
   * The detail shell. A heading is the thing the extractor cannot work
   * without, and Classroom renders the assignment title as a heading for
   * accessibility. `role=heading` covers the div-based variant.
   */
  const heading = document.querySelector('h1, h2, [role="heading"]');
  const headingText = (heading?.textContent ?? '').trim();
  const titleSignal: ReadinessSignal = {
    name: 'detailHeading',
    describes: 'a heading with text is rendered',
    found: headingText.length > 0,
  };

  const signals = [signedOut, onDetail, shell, busy, titleSignal];

  if (signedOut.found) return { state: 'signed_out', signals };
  if (!onDetail.found && parsed.isClassroom) return { state: 'wrong_page', signals };
  if (titleSignal.found) return { state: 'ready', signals };
  // An assignment page with no title is never legitimately "empty" - it is
  // either still rendering or broken. Keep waiting until the bound.
  return { state: null, signals };
}

function probeStream(document: Document, url: string): Probe {
  const parsed = parseClassroomUrl(url);
  const signedOut = signedOutSignal(document, url);
  const shell = shellSignal(document);
  const busy = busySignal(document);

  const onStream: ReadinessSignal = {
    name: 'streamUrl',
    describes: 'url path is /c/<courseId>',
    found: parsed.kind === 'class_stream',
  };

  /*
   * Stream posts. Classroom builds the stream as a list of articles; both
   * roles are accessibility structure rather than styling, so they are the
   * most durable signal available.
   */
  const posts = document.querySelectorAll(
    '[role="article"], [role="listitem"], article',
  ).length;
  const postSignal: ReadinessSignal = {
    name: 'streamPosts',
    describes: 'role=article / role=listitem / <article> elements',
    found: posts > 0,
    count: posts,
  };

  const signals = [signedOut, onStream, shell, busy, postSignal];

  if (signedOut.found) return { state: 'signed_out', signals };
  if (!onStream.found && parsed.isClassroom) return { state: 'wrong_page', signals };
  if (postSignal.found) return { state: 'ready', signals };
  if (shell.found && !busy.found) return { state: 'empty', signals };
  return { state: null, signals };
}

const PROBES: Record<ReadinessTarget, (document: Document, url: string) => Probe> = {
  home: probeHome,
  classwork: probeClasswork,
  assignment: probeAssignment,
  stream: probeStream,
};

/**
 * Evaluate the page once, without waiting.
 * Exported for tests and for the diagnostics report.
 */
export function probeReadiness(
  document: Document,
  url: string,
  target: ReadinessTarget,
): Probe {
  return PROBES[target](document, url);
}

// ---------------------------------------------------------------------------
// The bounded wait
// ---------------------------------------------------------------------------

export interface AwaitReadyOptions {
  /** Hard ceiling on the whole wait. */
  timeoutMs?: number;
  /**
   * Once a terminal-looking state is reached, wait this long for the DOM to
   * stop changing before trusting it. Classroom renders in several passes;
   * reading during one produces a partial list.
   */
  settleMs?: number;
  /** Injected for tests. */
  now?: () => number;
}

const DEFAULTS = {
  timeoutMs: 20_000,
  settleMs: 400,
} as const;

/**
 * Wait until `document` reaches the semantic state `target` requires.
 *
 * Resolves - never rejects. A timeout is a result, not an exception, because
 * the caller has to be able to tell a timeout apart from a crash.
 */
export function awaitReady(
  document: Document,
  getUrl: () => string,
  target: ReadinessTarget,
  options: AwaitReadyOptions = {},
): Promise<ReadinessResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
  const settleMs = options.settleMs ?? DEFAULTS.settleMs;
  const now = options.now ?? (() => Date.now());

  const startedAt = now();
  let mutations = 0;
  // Only interesting when it held for the WHOLE wait: a tab that was hidden
  // throughout is the situation that used to need a user click.
  let stayedHidden = document.hidden === true;

  return new Promise<ReadinessResult>((resolve) => {
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let done = false;

    const finish = (state: ReadinessState, signals: ReadinessSignal[]): void => {
      if (done) return;
      done = true;
      observer.disconnect();
      if (settleTimer !== undefined) clearTimeout(settleTimer);
      clearInterval(pollTimer);
      clearTimeout(deadlineTimer);
      resolve({
        state,
        target,
        url: getUrl(),
        waitedMs: now() - startedAt,
        mutations,
        documentHidden: stayedHidden,
        signals,
      });
    };

    /**
     * Re-check, and if the page looks terminal hold it for `settleMs` of DOM
     * quiet before accepting. Any mutation inside that window restarts the
     * hold, which is what stops a half-rendered list being read as complete.
     */
    const evaluate = (): void => {
      if (done) return;
      if (!document.hidden) stayedHidden = false;

      const probe = PROBES[target](document, getUrl());
      if (probe.state === null) {
        if (settleTimer !== undefined) {
          clearTimeout(settleTimer);
          settleTimer = undefined;
        }
        return;
      }

      // signed_out and wrong_page are decisions about the URL, not about
      // rendering, so they need no settle.
      if (probe.state === 'signed_out' || probe.state === 'wrong_page') {
        finish(probe.state, probe.signals);
        return;
      }

      if (settleTimer !== undefined) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        const confirmed = PROBES[target](document, getUrl());
        finish(confirmed.state ?? probe.state ?? 'timeout', confirmed.signals);
      }, settleMs);
    };

    const observer = new MutationObserver((records) => {
      mutations += records.length;
      evaluate();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-busy', 'href', 'role'],
    });

    /*
     * A backstop, not the mechanism. Some renders finish before the observer
     * is installed, and a page can reach its terminal state through something
     * the observer filter does not see. Chrome throttles this in a hidden
     * tab - which is exactly why it is not what we depend on.
     */
    const pollTimer = setInterval(evaluate, 500);

    const deadlineTimer = setTimeout(() => {
      const probe = PROBES[target](document, getUrl());
      finish(probe.state ?? 'timeout', probe.signals);
    }, timeoutMs);

    // The page may already be there.
    evaluate();
  });
}
