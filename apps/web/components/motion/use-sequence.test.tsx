// @vitest-environment jsdom
import { StrictMode, useRef } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSequence } from './use-sequence';

/**
 * The homepage animation regression suite.
 *
 * The bug these guard against: `useSequence` scheduled its next `setTimeout`
 * from inside the `setStep` updater. React calls updaters during render and
 * StrictMode calls them twice, so every tick created two timers and kept one
 * handle. The orphan ran `advance` itself and leaked another, doubling each
 * loop - 12 live timers at 6s, 2,930 at 20s, 204,982 at 40s - until the step
 * interval collapsed from 1500ms to under 50ms and the page thrashed.
 *
 * Nothing about that throws, logs or fails a type check. The only way to
 * catch it is to count timers, so that is what these tests do.
 */

/**
 * Counts live timer handles the way the browser would see them.
 *
 * Wraps the (already faked) timer functions so a handle leaves the set when
 * it is cleared OR when it fires. What remains is what a leak looks like.
 */
type TimerFn = (...args: unknown[]) => unknown;

function trackTimers() {
  const live = new Set<unknown>();
  const realSet = globalThis.setTimeout as unknown as TimerFn;
  const realClear = globalThis.clearTimeout as unknown as TimerFn;

  const set = vi
    .spyOn(globalThis, 'setTimeout')
    .mockImplementation(((fn: TimerFn, ms?: number, ...rest: unknown[]) => {
      const id: unknown = realSet(
        (...args: unknown[]) => {
          live.delete(id);
          return fn(...args);
        },
        ms,
        ...rest,
      );
      live.add(id);
      return id;
    }) as unknown as typeof globalThis.setTimeout);

  const clear = vi
    .spyOn(globalThis, 'clearTimeout')
    .mockImplementation(((id: unknown) => {
      live.delete(id);
      return realClear(id);
    }) as unknown as typeof globalThis.clearTimeout);

  return {
    get live() {
      return live.size;
    },
    restore() {
      set.mockRestore();
      clear.mockRestore();
    },
  };
}

/** Records every step the hook reports, so cadence can be measured. */
const seen: number[] = [];

function Probe({ withRef = false }: { withRef?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { step } = useSequence(4, {
    stepDurationMs: 1500,
    holdMs: 2600,
    ref: withRef ? ref : undefined,
  });
  seen.push(step);
  return <div ref={ref} data-testid="root" />;
}

let observers: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = [];
let timers: ReturnType<typeof trackTimers>;

beforeEach(() => {
  seen.length = 0;
  observers = [];
  // jsdom ships no matchMedia. Default to "motion is fine"; the reduced-motion
  // test overrides it.
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
  class FakeObserver {
    private fire: (entries: Array<{ isIntersecting: boolean }>) => void;
    constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
      this.fire = cb;
      observers.push(this.fire);
    }
    observe() {}
    // A disconnected observer never calls back again. StrictMode mounts the
    // effect twice, so without this the FIRST (already cleaned up) closure
    // keeps receiving entries and schedules a timer nothing will clear.
    disconnect() {
      observers = observers.filter((f) => f !== this.fire);
    }
    unobserve() {}
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = '';
    thresholds = [];
  }
  vi.stubGlobal('IntersectionObserver', FakeObserver);
  vi.useFakeTimers();
  timers = trackTimers();
});

afterEach(() => {
  timers.restore();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  cleanup();
});

/**
 * Advance through `loops` full cycles.
 *
 * In slices, not one jump: advancing past two scheduled ticks in a single
 * `act` lets React batch both setState calls into one render, which would
 * make the sequence look like it skipped a step.
 */
const CYCLE_MS = 1500 * 3 + 2600;
async function runLoops(loops: number) {
  const slices = Math.ceil((CYCLE_MS * loops) / 250);
  for (let i = 0; i < slices; i += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
  }
}

describe('useSequence timer population', () => {
  it('keeps exactly one timer alive through many loops, under StrictMode', async () => {
    render(
      <StrictMode>
        <Probe />
      </StrictMode>,
    );
    await act(async () => {});

    const samples: number[] = [];
    for (let loop = 0; loop < 30; loop += 1) {
      await runLoops(1);
      samples.push(timers.live);
    }

    // The original bug doubled this every loop. One is the whole contract.
    expect(Math.max(...samples)).toBeLessThanOrEqual(1);
  });

  it('does not accelerate: step changes stay on cadence after 40 loops', async () => {
    render(<Probe />);
    await act(async () => {});

    // Steps 0..2 last stepDurationMs; step 3 holds for holdMs.
    const advanceOne = async (ms: number) => {
      const before = seen.length;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms - 1);
      });
      const early = seen.length;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      return { movedEarly: early > before, movedOnTime: seen.length > early };
    };

    for (let loop = 0; loop < 40; loop += 1) {
      for (const step of [0, 1, 2, 3]) {
        const expected = step === 3 ? 2600 : 1500;
        const { movedEarly, movedOnTime } = await advanceOne(expected);
        expect(movedEarly, `loop ${loop} step ${step} fired early`).toBe(false);
        expect(movedOnTime, `loop ${loop} step ${step} did not fire`).toBe(true);
      }
    }
  });

  it('visits every step in order and wraps, never skipping', async () => {
    render(<Probe />);
    await act(async () => {});
    await runLoops(6);

    const changes = seen.filter((value, index) => index === 0 || value !== seen[index - 1]);
    for (let i = 1; i < changes.length; i += 1) {
      expect(changes[i]).toBe((changes[i - 1]! + 1) % 4);
    }
    expect(changes.length).toBeGreaterThan(12);
  });
});

describe('useSequence pause and resume', () => {
  it('does not add a timer when the observer reports visible repeatedly', async () => {
    render(<Probe withRef />);
    await act(async () => {});

    for (let i = 0; i < 25; i += 1) {
      await act(async () => {
        observers.forEach((fire) => fire([{ isIntersecting: true }]));
      });
    }
    expect(timers.live).toBeLessThanOrEqual(1);

    await runLoops(5);
    expect(timers.live).toBeLessThanOrEqual(1);
  });

  it('does not add a timer across repeated visibilitychange events', async () => {
    render(<Probe />);
    await act(async () => {});

    for (let i = 0; i < 25; i += 1) {
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
    }
    expect(timers.live).toBeLessThanOrEqual(1);
  });

  it('leaving and re-entering the viewport does not accelerate the sequence', async () => {
    render(<Probe withRef />);
    await act(async () => {});
    await act(async () => {
      observers.forEach((fire) => fire([{ isIntersecting: true }]));
    });

    for (let cycle = 0; cycle < 12; cycle += 1) {
      await act(async () => {
        observers.forEach((fire) => fire([{ isIntersecting: false }]));
      });
      expect(timers.live).toBe(0); // paused means no timer at all
      await act(async () => {
        observers.forEach((fire) => fire([{ isIntersecting: true }]));
      });
      expect(timers.live).toBeLessThanOrEqual(1);
    }

    // And the cadence is still the original one, not a faster one.
    const before = seen.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1499);
    });
    expect(seen.length).toBe(before);
  });

  it('holds still while the document is hidden', async () => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    render(<Probe />);
    await act(async () => {});
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    const before = seen.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(seen.length).toBe(before);
    expect(timers.live).toBe(0);
    hidden.mockRestore();
  });
});

describe('useSequence cleanup', () => {
  it('clears every timer on unmount', async () => {
    const view = render(<Probe />);
    await act(async () => {});
    await runLoops(3);

    view.unmount();
    expect(timers.live).toBe(0);
  });

  it('clears every timer on unmount under StrictMode', async () => {
    const view = render(
      <StrictMode>
        <Probe withRef />
      </StrictMode>,
    );
    await act(async () => {});
    await act(async () => {
      observers.forEach((fire) => fire([{ isIntersecting: true }]));
    });
    await runLoops(3);

    view.unmount();
    expect(timers.live).toBe(0);
  });

  it('stops reporting steps after unmount', async () => {
    const view = render(<Probe />);
    await act(async () => {});
    await runLoops(2);
    view.unmount();

    const after = seen.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(seen.length).toBe(after);
  });
});

describe('useSequence reduced motion', () => {
  it('settles on the final step and schedules nothing', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    render(<Probe />);
    await act(async () => {});

    expect(seen.at(-1)).toBe(3);
    expect(timers.live).toBe(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(seen.at(-1)).toBe(3);
    expect(timers.live).toBe(0);
  });
});
