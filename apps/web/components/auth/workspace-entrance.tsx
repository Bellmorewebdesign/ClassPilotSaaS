'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { brand, motion } from '@classpilot/shared';
import { BrandMark } from '@/components/brand-logo';
import { cn } from '@/lib/utils';

/**
 * The opening moment, shown once after sign-in.
 *
 * Two kit studies, in sequence:
 *
 *  1. The logo reveal (motion/coursen-logo-reveal-light): curve, waypoint,
 *     name. Its schedule comes from `motion.reveal`, which is transcribed
 *     from the kit's animated SVG - 1.35s of active motion.
 *  2. The workspace-loading language: the C goes still and a highlight moves
 *     around it. "Keep the C still. Let the work move."
 *
 * Honesty. The kit is explicit that this is "an opening moment, not an
 * obstacle", and that loading must not fabricate a percentage. So there is no
 * progress bar, no step list implying network calls, and no invented counts -
 * just one honest line. Nothing is being fetched here; the dashboard does its
 * own loading when it renders.
 *
 * Total on screen is the reveal plus a short settle, then it leaves.
 */

const SETTLE_MS = 260;
const EXIT_MS = 320;

export function WorkspaceEntrance({ next }: { next: string }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // Reduced motion: the opening moment is decoration, so skip it entirely
    // rather than holding someone on a static screen.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      router.replace(next);
      return;
    }

    const timers = [
      setTimeout(() => setLeaving(true), motion.reveal.total + SETTLE_MS),
      setTimeout(() => router.replace(next), motion.reveal.total + SETTLE_MS + EXIT_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, [router, next]);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6 transition-opacity duration-base ease-out',
        leaving ? 'opacity-0' : 'opacity-100',
      )}
      role="status"
      aria-live="polite"
    >
      {/* The lockup, drawn the way the kit draws it. */}
      <span className="flex items-center">
        <BrandMark
          size={64}
          animated
          className="h-16 w-16"
          style={{ marginRight: 16 }}
        />
        <span className="mark-wordmark text-h1 font-semibold tracking-[-0.025em] text-foreground">
          {brand.shortName}
        </span>
      </span>

      <p className="entrance-line mt-6 text-body text-muted-foreground">
        Preparing your workspace
      </p>
    </div>
  );
}
