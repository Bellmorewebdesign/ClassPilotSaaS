'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Drives a looping, stepped animation sequence.
 *
 * Used by the hero product demo, where a fixed choreography ("assignment
 * arrives" -> "deadline recognised" -> "calendar updates" -> "assistant is
 * context-aware") has to stay in lockstep across several sibling components.
 * A CSS animation alone cannot do that because the steps need to drive React
 * state, not just style.
 *
 * Behaviour that keeps it from being annoying:
 *
 *  - Pauses when the tab is hidden, so it is not burning frames in a
 *    background tab.
 *  - Pauses when scrolled out of view.
 *  - Honours prefers-reduced-motion by jumping straight to the final,
 *    fully-resolved step and stopping there - the end state is the most
 *    informative one, so reduced motion loses nothing but the movement.
 *
 * ---------------------------------------------------------------------------
 * WHY THE TIMER LIVES IN A REF AND THE STEP IS COMPUTED OUTSIDE setState
 *
 * The previous version scheduled the next tick from inside the state updater:
 *
 *     setStep((current) => {
 *       const next = (current + 1) % stepCount;
 *       timer = setTimeout(advance, ...);   // <- side effect, inside a render
 *       return next;
 *     });
 *
 * A state updater must be pure. React calls it during render, and in
 * StrictMode it calls it TWICE to surface exactly this kind of impurity. Each
 * invocation scheduled a timeout; only the last id was kept, so every tick
 * leaked one orphan that nothing could ever clear. Each orphan then ran
 * `advance` itself, leaking another.
 *
 * Measured on the homepage before the fix: 12 live timers at 6s, 2,930 at
 * 20s, 204,982 at 40s, with the step interval collapsing from 1500ms to under
 * 50ms. That is the "it speeds up and the page shakes" report - the shaking
 * is the render storm.
 *
 * The rules this version holds to, all covered by tests:
 *
 *   1. At most ONE scheduled timer exists at any moment. `schedule()` always
 *      clears before it sets, and it is the only place a timer is created.
 *   2. Nothing schedules from inside a state updater. The next step is
 *      computed from a ref, so double-invocation cannot double-schedule.
 *   3. `running` is idempotent: start() while already running is a no-op
 *      rather than a second timer, so IntersectionObserver and
 *      visibilitychange can both fire freely.
 *   4. Cleanup clears the timer, the listener and the observer.
 */
export function useSequence(
  stepCount: number,
  {
    stepDurationMs = 1400,
    /** Extra pause on the last step before looping. */
    holdMs = 1800,
    ref,
  }: {
    stepDurationMs?: number;
    holdMs?: number;
    ref?: React.RefObject<HTMLElement | null>;
  } = {},
): { step: number; reducedMotion: boolean } {
  const [step, setStep] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  /** The authoritative step. State mirrors it; this drives the schedule. */
  const stepRef = useRef(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReducedMotion(true);
      stepRef.current = stepCount - 1;
      setStep(stepCount - 1);
      return;
    }

    // The single timer handle. Nothing else in this effect holds one.
    let timer: ReturnType<typeof setTimeout> | null = null;
    let running = false;
    let inView = true;

    const schedule = (delayMs: number): void => {
      // Clear-before-set is what caps the population at one.
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(tick, delayMs);
    };

    const tick = (): void => {
      timer = null;
      const next = (stepRef.current + 1) % stepCount;
      stepRef.current = next;
      // setState with a plain value: no updater, so StrictMode's double
      // invocation has nothing impure to double.
      setStep(next);
      if (running) {
        schedule(next === stepCount - 1 ? holdMs : stepDurationMs);
      }
    };

    const start = (): void => {
      // Idempotent on purpose. The observer fires on every threshold
      // crossing and visibilitychange fires on every tab switch; neither
      // should be able to add a timer while one is already pending.
      if (running) return;
      running = true;
      const atHold = stepRef.current === stepCount - 1;
      schedule(atHold ? holdMs : stepDurationMs);
    };

    const stop = (): void => {
      running = false;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    /** One place decides whether the sequence should be running. */
    const sync = (): void => {
      if (inView && !document.hidden) start();
      else stop();
    };

    const onVisibility = (): void => sync();
    document.addEventListener('visibilitychange', onVisibility);

    let observer: IntersectionObserver | undefined;
    const node = ref?.current;
    if (node && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        ([entry]) => {
          inView = entry?.isIntersecting ?? true;
          sync();
        },
        { threshold: 0.25 },
      );
      observer.observe(node);
    } else {
      sync();
    }

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
    };
  }, [stepCount, stepDurationMs, holdMs, ref]);

  return { step, reducedMotion };
}
