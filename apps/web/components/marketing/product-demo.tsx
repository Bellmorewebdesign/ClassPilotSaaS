'use client';

import { useRef } from 'react';
import { brand } from '@classpilot/shared';
import { BrandMark } from '@/components/brand-logo';
import { CoursenIcon, type CoursenIconName } from '@/components/coursen-icon';
import { useSequence } from '@/components/motion/use-sequence';
import { DEMO_ASSIGNMENTS } from '@/app/(marketing)/_data/demo';
import { cn } from '@/lib/utils';

/**
 * The connected-workspace demonstration.
 *
 * Translates the kit's launch film (motion/coursen-connected-workspace) into
 * a responsive native sequence rather than embedding the eight-second video:
 * scattered school information comes together, then settles into one
 * workspace. Four beats -
 *
 *   0  sources idle
 *   1  Classroom sends classwork into Coursen
 *   2  the deadline is read and the item settles into Today
 *   3  the workspace is in order
 *
 * Rendered as a LIGHT product surface floating on the ink field, which is how
 * the kit presents the product throughout: the interface itself is calm and
 * white, and the dark ground is brand space around it.
 *
 * Honesty: the three unbuilt sources are labelled, and the panel carries the
 * kit's own "CONCEPT / SAMPLE CONTENT" marker.
 */

const SOURCES: Array<{ id: string; label: string; icon: CoursenIconName; live: boolean }> = [
  { id: 'classroom', label: 'Classroom', icon: 'classes', live: true },
  { id: 'calendar', label: 'Calendar', icon: 'calendar', live: false },
  { id: 'drive', label: 'Drive', icon: 'file', live: false },
  { id: 'docs', label: 'Docs', icon: 'assignment', live: false },
];

export function ProductDemo() {
  const root = useRef<HTMLDivElement>(null);
  const { step, reducedMotion } = useSequence(4, {
    stepDurationMs: 1500,
    holdMs: 2600,
    ref: root,
  });

  return (
    <div ref={root} className="relative mx-auto w-full max-w-[560px] lg:max-w-none">
      <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-high">
        {/* Panel chrome, mirroring the workspace header. */}
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <span className="flex items-center gap-2">
            <BrandMark size={20} className="h-5 w-5" />
            <span className="text-label text-foreground">{brand.shortName}</span>
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            Concept / sample content
          </span>
        </div>

        <div className="space-y-4 p-4">
          {/* --- Sources --- */}
          <ul className="grid grid-cols-4 gap-2">
            {SOURCES.map((source, index) => {
              const sending = step >= 1 && index === 0;
              return (
                <li
                  key={source.id}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-md border px-1.5 py-2.5 transition-colors duration-base ease-out',
                    sending
                      ? 'border-primary/40 bg-secondary'
                      : 'border-border bg-neutral',
                  )}
                >
                  <CoursenIcon
                    name={source.icon}
                    className={cn(
                      'h-[18px] w-[18px] transition-colors duration-base',
                      sending ? 'text-primary' : 'text-muted-foreground',
                    )}
                  />
                  <span className="text-metadata leading-none text-muted-foreground">
                    {source.label}
                  </span>
                  {!source.live ? (
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                      Soon
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {/* --- Information travelling into Coursen --- */}
          <ConnectedCore active={step >= 1} settled={step >= 2} reducedMotion={reducedMotion} />

          {/* --- One workspace --- */}
          <div className="rounded-lg border border-border bg-background p-3">
            <div className="mb-2.5 flex items-baseline justify-between">
              <p className="text-label text-foreground">Today</p>
              <span
                className={cn(
                  'flex items-center gap-1 text-metadata transition-opacity duration-base',
                  step >= 2 ? 'text-success opacity-100' : 'opacity-0',
                )}
              >
                <CoursenIcon name="check" className="h-3 w-3" />
                Due date read
              </span>
            </div>

            <ul className="space-y-2">
              {DEMO_ASSIGNMENTS.map((item, index) => {
                const arrived = index === 0 ? step >= 2 : true;
                return (
                  <li
                    key={item.id}
                    data-demo-pending={index === 0 ? 'true' : undefined}
                    className={cn(
                      'rounded-md border border-border bg-card px-3 py-2.5 transition-all duration-slow ease-out',
                      arrived ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0',
                    )}
                    style={{ transitionDelay: index === 0 ? '0ms' : `${index * 60}ms` }}
                  >
                    {/* Kit card anatomy: title, class, then precise due date. */}
                    <p className="truncate text-small-body font-semibold text-foreground">
                      {item.title}
                    </p>
                    <p className="truncate text-metadata text-muted-foreground">
                      {item.course}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span className="truncate text-metadata text-muted-foreground">
                        {item.due}
                      </span>
                      <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-metadata font-semibold text-primary">
                        Assigned
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      <p className="sr-only">
        A concept preview showing Google Classroom, Calendar, Drive and Docs
        coming together in {brand.shortName}: an assignment arrives, its due
        date is read, and it settles into Today. Calendar, Drive and Docs are
        not yet available.
      </p>
    </div>
  );
}

/**
 * The join between the sources and the workspace.
 *
 * Four hairlines converging on the mark, with a highlight travelling the
 * Classroom lane. The mark itself never moves - "Keep the C still. Let the
 * work move." - and once the item has settled the highlight stops, because
 * feedback animation should end when its job is done.
 */
function ConnectedCore({
  active,
  settled,
  reducedMotion,
}: {
  active: boolean;
  settled: boolean;
  reducedMotion: boolean;
}) {
  const sweeping = active && !settled && !reducedMotion;

  return (
    <div className="relative h-16" aria-hidden="true">
      <svg viewBox="0 0 320 64" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        {[40, 120, 200, 280].map((x, index) => (
          <path
            key={x}
            d={`M${x} 0 C ${x} 26, 160 24, 160 58`}
            fill="none"
            strokeWidth="1"
            stroke={active && index === 0 ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
            className="transition-[stroke] duration-base"
            strokeDasharray={active && index === 0 && !reducedMotion ? '6 8' : undefined}
          >
            {active && index === 0 && !reducedMotion ? (
              <animate
                attributeName="stroke-dashoffset"
                values="28;0"
                dur="1.2s"
                repeatCount="indefinite"
              />
            ) : null}
          </path>
        ))}
      </svg>

      {/* The mark, stationary, with the kit's activity sweep around it. */}
      <span className="absolute bottom-0 left-1/2 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card">
        {sweeping ? (
          <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full p-1.5">
            <path
              d="M44.73 44.73 A18 18 0 1 1 44.73 19.27"
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              className="activity-track"
            />
            <path
              d="M44.73 44.73 A18 18 0 1 1 44.73 19.27"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="8"
              strokeLinecap="round"
              pathLength={100}
              className="activity-sweep"
            />
          </svg>
        ) : (
          <BrandMark size={24} className="h-6 w-6" />
        )}
      </span>
    </div>
  );
}
