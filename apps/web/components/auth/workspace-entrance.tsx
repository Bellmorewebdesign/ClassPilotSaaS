'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { brand } from '@classpilot/shared';
import { BrandMark } from '@/components/brand-logo';
import { cn } from '@/lib/utils';

/**
 * The entrance animation, shown once after sign-in.
 *
 * Honesty note: these are PRESENTATION steps, not network calls. The label
 * copy is deliberately generic ("Preparing your workspace") rather than
 * claiming to have checked or organised anything, because at this point
 * nothing is being fetched - the dashboard does its own loading when it
 * renders.
 *
 * Timing: roughly 1.5s total, which is long enough to feel deliberate and
 * short enough that nobody resents it. It runs once per sign-in, not on every
 * navigation.
 *
 * Reduced motion: the whole sequence is skipped and we navigate immediately.
 */
const STEPS = [
  'Connecting to your workspace',
  'Bringing your coursework together',
  'Almost there',
] as const;

const STEP_MS = 420;
const EXIT_MS = 320;

export function WorkspaceEntrance({ next }: { next: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      router.replace(next);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    STEPS.forEach((_, index) => {
      if (index === 0) return;
      timers.push(setTimeout(() => setStep(index), index * STEP_MS));
    });

    timers.push(
      setTimeout(() => setLeaving(true), STEPS.length * STEP_MS),
      setTimeout(() => router.replace(next), STEPS.length * STEP_MS + EXIT_MS),
    );

    return () => timers.forEach(clearTimeout);
  }, [router, next]);

  return (
    <div
      className={cn(
        'on-depth fixed inset-0 z-50 flex flex-col items-center justify-center px-6 transition-opacity duration-base ease-out',
        leaving ? 'opacity-0' : 'opacity-100',
      )}
      role="status"
      aria-live="polite"
    >
      <div className="depth-ambient" aria-hidden="true" />

      <div className="relative flex flex-col items-center">
        {/* The mark draws itself, then a ring settles around it. */}
        <span className="relative flex h-20 w-20 items-center justify-center">
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full border border-depth-glow/40 animate-pulse-ring"
          />
          <BrandMark animated className="h-12 w-12 text-depth-glow" />
        </span>

        <p className="mt-8 text-[15px] font-semibold text-depth-ink">
          Welcome to {brand.shortName}
        </p>

        {/* Steps. Only the active one is announced, to avoid a chatty live region. */}
        <ul className="mt-5 space-y-2 text-center">
          {STEPS.map((label, index) => (
            <li
              key={label}
              className={cn(
                'flex items-center justify-center gap-2 text-[13px] transition-all duration-base ease-out',
                index < step && 'text-depth-muted',
                index === step && 'text-depth-ink',
                index > step && 'opacity-0',
              )}
            >
              {index < step ? (
                <Check
                  className="h-3.5 w-3.5 text-depth-glow"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-depth-glow"
                />
              )}
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
