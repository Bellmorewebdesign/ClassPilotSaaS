import { brand } from '@classpilot/shared';
import { cn } from '@/lib/utils';

/**
 * The Coursen mark.
 *
 * The geometry comes from `brand.mark` in @classpilot/shared and is not
 * redefined here. The C reads as an open path with a single point closing
 * it - organisation arriving at a centre - which is the idea the entrance
 * animation and the hero both build on.
 */
export function BrandMark({
  className,
  /** Draws the C on mount instead of appearing at once. */
  animated = false,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn('h-9 w-9 shrink-0 text-primary', className)}
    >
      <path
        d={brand.mark.path}
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        className={animated ? 'mark-trace' : undefined}
      />
      <circle
        cx={brand.mark.dotX}
        cy={brand.mark.dotY}
        r="4"
        fill="currentColor"
        className={animated ? 'mark-dot' : undefined}
      />
    </svg>
  );
}

/**
 * Mark plus wordmark.
 *
 * `tone` exists because the lockup appears on both the light workspace and
 * the dark marketing surface, and those need different foregrounds. It is a
 * prop rather than two components so the lockup can never drift apart.
 */
export function BrandLogo({
  className,
  tone = 'default',
  showWordmark = true,
}: {
  className?: string;
  tone?: 'default' | 'depth';
  showWordmark?: boolean;
}) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <BrandMark className={cn('h-8 w-8', tone === 'depth' && 'text-depth-glow')} />
      {showWordmark ? (
        <span
          className={cn(
            'text-[17px] font-bold tracking-[-0.04em]',
            tone === 'depth' && 'text-depth-ink',
          )}
        >
          {brand.shortName}
        </span>
      ) : null}
    </span>
  );
}
