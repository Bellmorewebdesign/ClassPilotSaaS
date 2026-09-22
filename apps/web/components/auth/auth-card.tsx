import type { ReactNode } from 'react';
import { Reveal } from '@/components/motion/reveal';

/**
 * Sign-in / sign-up frame.
 *
 * Per the kit concept this is not a card on a card: the form sits directly on
 * the surface, with the heading doing the containing. Fewer boxes, calmer
 * page.
 */
export function AuthCard({
  title,
  lede,
  children,
  footer,
}: {
  title: string;
  lede: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Reveal>
      <h1 className="text-h1 text-foreground">{title}</h1>
      <p className="mt-2 text-body text-muted-foreground">{lede}</p>
      <div className="mt-8">{children}</div>
      {footer ? (
        <div className="mt-8 border-t pt-6 text-small-body text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </Reveal>
  );
}

/**
 * The Google button.
 *
 * Disabled everywhere it appears, because Google OAuth does not exist in this
 * build. Shown rather than hidden so the intended flow is legible, and styled
 * with the kit's Disabled-fill role so it cannot read as available.
 */
export function GoogleButtonPreview({ label }: { label: string }) {
  return (
    <div>
      <button
        type="button"
        disabled
        aria-describedby="google-preview-note"
        className="disabled-link w-full"
      >
        <GoogleGlyph />
        {label}
      </button>
      <p id="google-preview-note" className="mt-2 text-metadata text-muted-foreground">
        Google sign-in is not available in this build.
      </p>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 18 18" className="h-4 w-4 opacity-60" aria-hidden="true">
      <path
        fill="currentColor"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="currentColor"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
        opacity=".8"
      />
      <path
        fill="currentColor"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
        opacity=".6"
      />
      <path
        fill="currentColor"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.42 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
        opacity=".9"
      />
    </svg>
  );
}
