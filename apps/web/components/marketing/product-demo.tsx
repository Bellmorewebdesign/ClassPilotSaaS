'use client';

import { useRef } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { brand } from '@classpilot/shared';
import { BrandMark } from '@/components/brand-logo';
import { useSequence } from '@/components/motion/use-sequence';
import { DEMO_ASSIGNMENTS, DEMO_SOURCES } from '@/app/(marketing)/_data/demo';
import { cn } from '@/lib/utils';

/**
 * The hero product demonstration.
 *
 * Tells the product story as a four-beat loop rather than a screenshot:
 *
 *   0  sources idle
 *   1  Classroom emits an assignment -> it travels into Coursen
 *   2  Coursen reads the deadline -> the card lands in Today
 *   3  the assistant becomes context-aware
 *
 * Honesty: the three not-yet-built sources are visibly marked "Soon", and the
 * whole panel carries a "Product preview" label. It demonstrates the intended
 * product without claiming the integrations work today.
 *
 * Performance: every moving part animates transform/opacity only. The
 * sequence pauses when scrolled away or when the tab is hidden, and
 * prefers-reduced-motion jumps straight to the resolved final state.
 */
export function ProductDemo() {
  const root = useRef<HTMLDivElement>(null);
  const { step, reducedMotion } = useSequence(4, {
    stepDurationMs: 1500,
    holdMs: 2400,
    ref: root,
  });

  return (
    <div ref={root} className="relative mx-auto w-full max-w-[560px] lg:max-w-none">
      {/* Accent glow behind the panel. Sits under everything, never over text. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-8 -top-10 bottom-0 rounded-[3rem] opacity-70"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 0%, rgba(127,178,240,0.22), transparent 70%)',
        }}
      />

      <div className="glass-dark relative overflow-hidden rounded-2xl p-4 sm:p-5">
        {/* Panel chrome */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BrandMark className="h-5 w-5 text-depth-glow" />
            <span className="text-[13px] font-semibold text-depth-ink">
              {brand.shortName}
            </span>
          </div>
          <span className="rounded-full border border-depth-line px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-depth-muted">
            Product preview
          </span>
        </div>

        {/* --- Sources row --------------------------------------------- */}
        <ul className="grid grid-cols-4 gap-2">
          {DEMO_SOURCES.map((source, index) => {
            const emitting = step >= 1 && index === 0;
            return (
              <li
                key={source.id}
                className={cn(
                  'relative flex flex-col items-center gap-1.5 rounded-lg border px-1.5 py-2.5 transition-[border-color,background-color,transform] duration-base ease-out',
                  emitting
                    ? 'border-depth-line-strong bg-white/[0.07]'
                    : 'border-depth-line bg-white/[0.02]',
                )}
              >
                <source.icon
                  className={cn(
                    'h-[18px] w-[18px] transition-colors duration-base',
                    emitting ? 'text-depth-glow' : 'text-depth-muted',
                  )}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <span className="text-[10px] font-medium leading-none text-depth-muted">
                  {source.label}
                </span>
                {!source.live ? (
                  <span className="text-[8px] font-semibold uppercase tracking-wide text-depth-muted/70">
                    Soon
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>

        {/* --- Connector ------------------------------------------------ */}
        <Connector active={step >= 1} reducedMotion={reducedMotion} />

        {/* --- Coursen core --------------------------------------------- */}
        <div className="relative mx-auto -mt-1 mb-1 flex h-12 w-12 items-center justify-center">
          {step >= 2 && !reducedMotion ? (
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full border border-depth-glow/50 animate-pulse-ring"
            />
          ) : null}
          <span className="relative flex h-11 w-11 items-center justify-center rounded-full border border-depth-line-strong bg-depth-panel shadow-glow">
            <BrandMark className="h-6 w-6 text-depth-glow" />
          </span>
        </div>

        {/* --- Resulting workspace ------------------------------------- */}
        <div className="rounded-xl border border-depth-line bg-depth-base/60 p-3">
          <div className="mb-2.5 flex items-baseline justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-depth-muted">
              Today
            </p>
            <span
              className={cn(
                'text-[10px] font-medium transition-opacity duration-base',
                step >= 2 ? 'text-depth-glow opacity-100' : 'opacity-0',
              )}
            >
              Deadline found
            </span>
          </div>

          <ul className="space-y-1.5">
            {DEMO_ASSIGNMENTS.map((item, index) => {
              // The first card is the one that "arrives" at step 2; the rest
              // are already settled so the panel never looks empty.
              const arrived = index === 0 ? step >= 2 : true;
              return (
                <li
                  key={item.id}
                  // Without JS the sequence never advances, so the arriving
                  // card would leave a gap. See the html:not(.js) rule in
                  // globals.css, which settles it instead.
                  data-demo-pending={index === 0 ? 'true' : undefined}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg border border-depth-line bg-white/[0.03] px-3 py-2.5 transition-all duration-slow ease-out',
                    arrived
                      ? 'translate-y-0 opacity-100'
                      : '-translate-y-2 opacity-0',
                  )}
                  style={{ transitionDelay: index === 0 ? '0ms' : `${index * 60}ms` }}
                >
                  <span
                    aria-hidden="true"
                    className={cn('h-7 w-[3px] shrink-0 rounded-full', item.accent)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-depth-ink">
                      {item.title}
                    </span>
                    <span className="block truncate text-[11px] text-depth-muted">
                      {item.course} &middot; {item.due}
                    </span>
                  </span>
                  {index === 0 && step >= 2 ? (
                    <Check
                      className="h-4 w-4 shrink-0 text-depth-glow"
                      strokeWidth={2.5}
                      aria-hidden="true"
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>

          {/* --- Assistant becomes context-aware ----------------------- */}
          <div
            className={cn(
              'mt-2.5 flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-all duration-slow ease-out',
              step >= 3
                ? 'border-depth-line-strong bg-depth-glow/10 opacity-100'
                : 'border-depth-line bg-white/[0.02] opacity-60',
            )}
          >
            <Sparkles
              className={cn(
                'h-4 w-4 shrink-0 transition-colors duration-base',
                step >= 3 ? 'text-depth-glow' : 'text-depth-muted',
              )}
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate text-[12px] text-depth-muted">
              {step >= 3
                ? '"What should I work on first?"'
                : brand.assistantPlaceholder}
            </span>
          </div>
        </div>
      </div>

      {/* A screen-reader summary, since the visual story is decorative. */}
      <p className="sr-only">
        A product preview showing Google Classroom, Calendar, Drive and Docs
        feeding into {brand.shortName}, which recognises an assignment
        deadline, places it in Today, and makes the assistant aware of it.
        Calendar, Drive and Docs integrations are not yet available.
      </p>
    </div>
  );
}

/**
 * The connector between the sources row and the Coursen core.
 *
 * Three static hairlines plus one travelling packet on the Classroom lane.
 * The packet is a plain translated dot rather than an SVG offset-path
 * animation, because offset-path still lacks reliable support in some
 * browsers and a transform translate is cheaper anyway.
 */
function Connector({
  active,
  reducedMotion,
}: {
  active: boolean;
  reducedMotion: boolean;
}) {
  return (
    <div aria-hidden="true" className="relative mx-auto h-12 w-full">
      <svg
        viewBox="0 0 320 48"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        {/* Lanes from each source column down into the centre. */}
        {[40, 120, 200, 280].map((x, index) => (
          <path
            key={x}
            d={`M${x} 0 C ${x} 22, 160 20, 160 46`}
            fill="none"
            stroke="var(--depth-line)"
            strokeWidth="1"
            className={cn(
              'transition-[stroke] duration-base',
              active && index === 0 && 'stroke-[var(--depth-lineStrong)]',
            )}
          />
        ))}
      </svg>

      {/* The travelling packet. Only on the live Classroom lane. The dot
          rides a full-width track so its percentage translate resolves
          against the container - see .packet-track in globals.css. */}
      {active && !reducedMotion ? (
        <span className="packet-track">
          <span className="packet-dot" />
        </span>
      ) : null}
    </div>
  );
}
