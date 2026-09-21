'use client';

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Scroll-reveal.
 *
 * Deliberately not a motion library. This is an IntersectionObserver that
 * toggles one data attribute; the actual transition is the `.reveal` rule in
 * globals.css, which runs on the compositor (transform + opacity only).
 *
 * Two properties that matter more than the animation:
 *
 *  - It fires ONCE and then disconnects. Elements that re-animate every time
 *    you scroll past them are the fastest way to make a site feel cheap.
 *  - Content is never trapped. If the observer never runs - no JS, an old
 *    browser, a prerender - the element is marked visible on mount, so the
 *    page reads correctly regardless.
 */
export function Reveal({
  children,
  as: Tag = 'div',
  className,
  /** Stagger index; maps to the .delay-step-N utilities. Max 5. */
  step,
  /** How far into the viewport before releasing. Negative pulls it earlier. */
  rootMargin = '0px 0px -12% 0px',
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  step?: 1 | 2 | 3 | 4 | 5;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;

    // No observer support, or the user prefers reduced motion: show it now.
    if (
      !node ||
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setVisible(true);
      return;
    }

    // Already on screen at mount (above the fold): release immediately so
    // the first paint is not a blank hero.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin, threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <Tag
      ref={ref}
      data-visible={visible}
      className={cn('reveal', step && `delay-step-${step}`, className)}
    >
      {children}
    </Tag>
  );
}
