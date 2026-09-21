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
  const inView = useRef(true);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReducedMotion(true);
      setStep(stepCount - 1);
      return;
    }

    let timer: ReturnType<typeof setTimeout>;

    const advance = () => {
      setStep((current) => {
        const next = (current + 1) % stepCount;
        timer = setTimeout(advance, next === stepCount - 1 ? holdMs : stepDurationMs);
        return next;
      });
    };

    const start = () => {
      clearTimeout(timer);
      timer = setTimeout(advance, stepDurationMs);
    };
    const stop = () => clearTimeout(timer);

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);

    let observer: IntersectionObserver | undefined;
    const node = ref?.current;
    if (node && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        ([entry]) => {
          inView.current = entry?.isIntersecting ?? true;
          if (inView.current && !document.hidden) start();
          else stop();
        },
        { threshold: 0.25 },
      );
      observer.observe(node);
    } else {
      start();
    }

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
    };
  }, [stepCount, stepDurationMs, holdMs, ref]);

  return { step, reducedMotion };
}
