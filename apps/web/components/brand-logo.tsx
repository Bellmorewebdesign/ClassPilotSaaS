import { brand } from '@classpilot/shared';
import { cn } from '@/lib/utils';

/**
 * The Waypoint C - Brand Kit v2.
 *
 * Geometry comes from `brand.mark`, which is transcribed from the kit's
 * construction sheet and pinned by tests. It is never redrawn here.
 *
 * Two kit rules are enforced structurally rather than by convention:
 *
 *  - The small-size optical master. Below 32px the kit specifies a 9-unit
 *    stroke and 9-unit waypoint, because the thinner stroke closes the
 *    aperture and the C stops reading as a C. `size` selects it.
 *  - The waypoint is never omitted. It is part of the mark, and removing it
 *    is documented misuse.
 *
 * Pale-on-white is also documented misuse, which is why there is no "sky"
 * tone: Signature sky is a large-accent colour and is only ever used for the
 * mark on the dark ink surface, where the kit's own dark reveal uses it.
 *
 * ---------------------------------------------------------------------------
 * WHY `width` AND `height` ATTRIBUTES ARE NOT OPTIONAL HERE
 *
 * An <svg> with a viewBox and no width/height has no intrinsic size. CSS
 * normally supplies one, but there is a window where CSS has not arrived
 * yet: a client-side route change commits the new DOM before the route's
 * stylesheet chunk loads. In that window the mark falls back to `width:100%`
 * of its containing block - and on the sign-in page, where the brand panel's
 * `hidden lg:flex` has not applied either, that block is the whole document.
 *
 * Measured navigating home -> /signin before this fix: a 1440x1440px Waypoint
 * C, larger than the viewport, for 12 frames. Presentation attributes are in
 * the markup itself, so they hold from the very first paint and CSS still
 * wins whenever it does arrive.
 */
export function BrandMark({
  className,
  /**
   * Rendered size in px. Drives the optical master only - the SVG still
   * scales fluidly via its viewBox, so this is a hint, not a hard size.
   */
  size = 32,
  animated = false,
  style,
}: {
  className?: string;
  size?: number;
  animated?: boolean;
  style?: React.CSSProperties;
}) {
  const optical = size <= 32 ? brand.mark.small : brand.mark;

  return (
    <svg
      viewBox="0 0 64 64"
      // Intrinsic size, so the mark is never unbounded before CSS applies.
      // A `className` or `style` still overrides it.
      width={size}
      height={size}
      aria-hidden="true"
      className={cn('shrink-0 text-primary', className)}
      style={style}
    >
      <path
        d={brand.mark.path}
        fill="none"
        stroke="currentColor"
        strokeWidth={optical.strokeWidth}
        strokeLinecap="round"
        className={animated ? 'mark-curve' : undefined}
      />
      <circle
        cx={brand.mark.dotX}
        cy={brand.mark.dotY}
        r={optical.dotRadius}
        fill="currentColor"
        className={animated ? 'mark-waypoint' : undefined}
      />
    </svg>
  );
}

/**
 * The primary lockup: mark, then name.
 *
 * "Coursen leads. AI stays secondary" (guide page 06), so the wordmark is
 * "Coursen" and the AI / Sync descriptors are opt-in and deliberately small -
 * enlarging a descriptor is documented misuse.
 *
 * The gap is the kit's clear space, expressed in waypoint diameters so it
 * scales with the mark rather than being a fixed pixel value.
 */
export function BrandLogo({
  className,
  tone = 'default',
  descriptor,
  showWordmark = true,
  size = 32,
  animated = false,
}: {
  className?: string;
  /** `depth` is the dark ink surface, where the mark takes Signature sky. */
  tone?: 'default' | 'depth';
  descriptor?: 'AI' | 'Sync';
  showWordmark?: boolean;
  size?: number;
  animated?: boolean;
}) {
  const depth = tone === 'depth';

  return (
    <span className={cn('inline-flex items-center', className)}>
      <BrandMark
        size={size}
        animated={animated}
        className={cn(depth && 'text-depth-accent')}
        // 1x waypoint diameter of clear space between mark and name.
        style={{ width: size, height: size, marginRight: size * 0.25 }}
      />
      {showWordmark ? (
        <span
          className={cn(
            'font-semibold tracking-[-0.025em]',
            depth ? 'text-depth-ink' : 'text-foreground',
            animated && 'mark-wordmark',
          )}
          style={{ fontSize: size * 0.56 }}
        >
          {brand.shortName}
          {descriptor ? (
            <span
              className={cn(
                'ml-1.5 align-baseline font-semibold',
                depth ? 'text-depth-muted' : 'text-muted-foreground',
              )}
              // Descriptors stay small on purpose - see logo misuse.
              style={{ fontSize: size * 0.3 }}
            >
              {descriptor}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
