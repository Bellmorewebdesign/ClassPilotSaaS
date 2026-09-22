import { Window } from 'happy-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { awaitReady, probeReadiness } from './readiness.js';

/**
 * Readiness protocol tests.
 *
 * What these defend: the helper tab used to call a page extractable when the
 * document had loaded, a content script answered PING, and 1200ms had
 * elapsed. On a client-rendered app that is three facts about the browser and
 * none about the page, which is why a sync in a hidden tab returned zero
 * classes unless the user happened to click the tab.
 *
 * The contract now is semantic: the wait ends when the extractor's required
 * content exists, when the page is legitimately empty, or at the bound.
 */

const HOME = 'https://classroom.google.com/h';
// Classroom ids are long base64url tokens - the URL parser requires >= 4
// characters, so short placeholders would not parse as ids at all.
const COURSE = 'Njk5MjMxMjM';
const COURSE_B = 'MTIzNDU2Nzg5';
const WORK = 'NTQzMjE5OA';
const MATERIAL = 'ODc2NTQzMjE';
const CLASSWORK = `https://classroom.google.com/w/${COURSE}/t/all`;
const ASSIGNMENT = `https://classroom.google.com/c/${COURSE}/a/${WORK}/details`;
const STREAM = `https://classroom.google.com/c/${COURSE}`;

/** An isolated document, so one test's DOM cannot leak into another. */
function build(html: string): Document {
  const window = new Window();
  window.document.body.innerHTML = html;
  return window.document as unknown as Document;
}

/** A shell that has booted but rendered no data yet. */
const LOADING_SHELL = '<main><div role="progressbar" aria-label="Loading"></div></main>';
/** A shell that has finished and genuinely has nothing. */
const EMPTY_SHELL = '<main><p>No classes yet</p></main>';

describe('probeReadiness - home', () => {
  it('is ready once a class link exists', () => {
    const doc = build(`<main><a href="/c/${COURSE}">Chemistry</a></main>`);
    expect(probeReadiness(doc, HOME, 'home').state).toBe('ready');
  });

  it('is not ready while the shell is still busy', () => {
    expect(probeReadiness(build(LOADING_SHELL), HOME, 'home').state).toBeNull();
  });

  it('distinguishes a rendered, genuinely empty Classroom from a loading one', () => {
    expect(probeReadiness(build(EMPTY_SHELL), HOME, 'home').state).toBe('empty');
  });

  it('is not ready when nothing has rendered at all', () => {
    expect(probeReadiness(build(''), HOME, 'home').state).toBeNull();
  });

  it('reports signed_out when the page left classroom.google.com', () => {
    const doc = build(`<main><a href="/c/${COURSE}">Chemistry</a></main>`);
    const probe = probeReadiness(doc, 'https://accounts.google.com/signin', 'home');
    expect(probe.state).toBe('signed_out');
  });

  it('counts unique classes, not anchors', () => {
    const doc = build(
      `<main><a href="/c/${COURSE}">Chem</a><a href="/c/${COURSE}">Chem again</a><a href="/c/${COURSE_B}">Bio</a></main>`,
    );
    const signal = probeReadiness(doc, HOME, 'home').signals.find(
      (s) => s.name === 'classLinks',
    );
    expect(signal?.count).toBe(2);
  });

  it('ignores aria-hidden class links', () => {
    const doc = build(
      `<main><div aria-hidden="true"><a href="/c/${COURSE}">x</a></div></main>`,
    );
    const signal = probeReadiness(doc, HOME, 'home').signals.find(
      (s) => s.name === 'classLinks',
    );
    expect(signal?.count).toBe(0);
  });
});

describe('probeReadiness - classwork', () => {
  it('is ready once coursework links exist', () => {
    const doc = build(`<main><a href="/c/${COURSE}/a/${WORK}/details">Lab</a></main>`);
    expect(probeReadiness(doc, CLASSWORK, 'classwork').state).toBe('ready');
  });

  it('counts material links too', () => {
    const doc = build(
      `<main><a href="/c/${COURSE}/m/${MATERIAL}/details">Syllabus</a></main>`,
    );
    expect(probeReadiness(doc, CLASSWORK, 'classwork').state).toBe('ready');
  });

  it('treats a rendered classwork page with no items as empty, not broken', () => {
    expect(probeReadiness(build(EMPTY_SHELL), CLASSWORK, 'classwork').state).toBe('empty');
  });

  it('reports wrong_page when Classroom redirected elsewhere', () => {
    const doc = build(`<main><a href="/c/${COURSE}/a/${WORK}/details">Lab</a></main>`);
    expect(probeReadiness(doc, HOME, 'classwork').state).toBe('wrong_page');
  });

  it('keeps waiting while the list is still loading', () => {
    expect(probeReadiness(build(LOADING_SHELL), CLASSWORK, 'classwork').state).toBeNull();
  });
});

describe('probeReadiness - assignment', () => {
  it('is ready once a heading with text is rendered', () => {
    const doc = build('<main><h1>Titration Lab</h1></main>');
    expect(probeReadiness(doc, ASSIGNMENT, 'assignment').state).toBe('ready');
  });

  it('accepts role=heading as well as a real heading element', () => {
    const doc = build('<main><div role="heading" aria-level="1">Titration Lab</div></main>');
    expect(probeReadiness(doc, ASSIGNMENT, 'assignment').state).toBe('ready');
  });

  it('never calls a titleless assignment page "empty"', () => {
    // An assignment with no title is broken or still rendering, never a
    // legitimate terminal state. It must keep waiting until the bound.
    expect(probeReadiness(build(EMPTY_SHELL), ASSIGNMENT, 'assignment').state).toBeNull();
  });

  it('reports wrong_page when the URL is not a detail page', () => {
    const doc = build('<main><h1>Something</h1></main>');
    expect(probeReadiness(doc, HOME, 'assignment').state).toBe('wrong_page');
  });
});

describe('probeReadiness - stream', () => {
  it('is ready once posts are rendered', () => {
    const doc = build('<main><div role="article">Quiz Friday</div></main>');
    expect(probeReadiness(doc, STREAM, 'stream').state).toBe('ready');
  });

  it('treats a rendered empty stream as empty', () => {
    expect(probeReadiness(build(EMPTY_SHELL), STREAM, 'stream').state).toBe('empty');
  });
});

describe('awaitReady', () => {
  let window: Window;

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function mount(html: string): Document {
    window = new Window();
    window.document.body.innerHTML = html;
    // awaitReady constructs a MutationObserver against the document it is
    // given, so that window's implementation has to be the global one.
    vi.stubGlobal('MutationObserver', window.MutationObserver);
    return window.document as unknown as Document;
  }

  it('resolves immediately when the page is already ready', async () => {
    const doc = mount(`<main><a href="/c/${COURSE}">Chem</a></main>`);
    const promise = awaitReady(doc, () => HOME, 'home', { settleMs: 100 });
    await vi.advanceTimersByTimeAsync(150);
    const result = await promise;
    expect(result.state).toBe('ready');
  });

  /*
   * The two mutation-driven tests run on REAL timers.
   *
   * happy-dom delivers MutationObserver records through its own async task
   * queue, which vitest's fake timers do not drive. Faking time here would
   * test the 500ms polling backstop instead of the observer - the opposite of
   * the point. Real timers with small values keep these honest and fast.
   */
  it('resolves when content arrives later, driven by the observer', async () => {
    vi.useRealTimers();
    const doc = mount('<main></main>');
    const promise = awaitReady(doc, () => HOME, 'home', {
      settleMs: 20,
      // Shorter than the 500ms poll interval, so only the observer can
      // possibly satisfy this.
      timeoutMs: 400,
    });

    const link = doc.createElement('a');
    link.setAttribute('href', `/c/${COURSE}`);
    link.textContent = 'Chemistry';
    doc.querySelector('main')!.append(link);

    const result = await promise;
    expect(result.state).toBe('ready');
    expect(result.mutations).toBeGreaterThan(0);
  });

  it('waits for the DOM to settle before accepting, so a partial list is not read', async () => {
    vi.useRealTimers();
    const doc = mount('<main></main>');
    const main = doc.querySelector('main')!;
    const promise = awaitReady(doc, () => HOME, 'home', {
      settleMs: 80,
      timeoutMs: 3_000,
    });

    const addClass = (href: string) => {
      const a = doc.createElement('a');
      a.setAttribute('href', href);
      main.append(a);
    };
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

    addClass(`/c/${COURSE}`);
    await wait(30); // inside the settle window
    addClass(`/c/${COURSE_B}`);
    await wait(30); // restarts it again
    addClass(`/c/${WORK}`);

    const result = await promise;
    expect(result.state).toBe('ready');
    const classes = result.signals.find((s) => s.name === 'classLinks');
    // All three, not just the one that existed when the first check fired.
    expect(classes?.count).toBe(3);
  });

  it('is bounded: a page that never renders times out rather than hanging', async () => {
    const doc = mount(LOADING_SHELL);
    const promise = awaitReady(doc, () => HOME, 'home', {
      settleMs: 100,
      timeoutMs: 3_000,
    });
    await vi.advanceTimersByTimeAsync(3_500);
    const result = await promise;
    expect(result.state).toBe('timeout');
    expect(result.waitedMs).toBeGreaterThanOrEqual(3_000);
  });

  it('reports whether the tab stayed hidden, which explains a timeout', async () => {
    const doc = mount(LOADING_SHELL);
    Object.defineProperty(doc, 'hidden', { value: true, configurable: true });
    const promise = awaitReady(doc, () => HOME, 'home', {
      settleMs: 100,
      timeoutMs: 1_000,
    });
    await vi.advanceTimersByTimeAsync(1_500);
    const result = await promise;
    expect(result.documentHidden).toBe(true);
  });

  it('never rejects - a timeout is a result the caller can reason about', async () => {
    const doc = mount('');
    const promise = awaitReady(doc, () => 'not-a-url', 'assignment', {
      settleMs: 10,
      timeoutMs: 500,
    });
    await vi.advanceTimersByTimeAsync(800);
    await expect(promise).resolves.toBeDefined();
  });

  it('stops observing once it resolves', async () => {
    const doc = mount(`<main><a href="/c/${COURSE}">Chem</a></main>`);
    const promise = awaitReady(doc, () => HOME, 'home', { settleMs: 50 });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;
    const before = result.mutations;

    // Further DOM churn must not be attributed to a finished wait.
    doc.querySelector('main')!.append(doc.createElement('div'));
    await vi.advanceTimersByTimeAsync(500);
    expect(result.mutations).toBe(before);
  });
});
