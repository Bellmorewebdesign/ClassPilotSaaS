import type { ReactNode } from 'react';
import { Reveal } from '@/components/motion/reveal';

/** Shared frame for the sign-in and sign-up screens. */
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
    <Reveal className="w-full max-w-[26rem]">
      <div className="glass-dark rounded-2xl p-7 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-depth-ink">
          {title}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-depth-muted">{lede}</p>
        <div className="mt-7">{children}</div>
      </div>
      {footer ? (
        <div className="mt-5 text-center text-[13px] text-depth-muted">{footer}</div>
      ) : null}
    </Reveal>
  );
}

/**
 * The Google button.
 *
 * Rendered disabled everywhere it appears, because Google OAuth does not
 * exist in this build. It is shown rather than hidden so the intended flow is
 * legible, but it must never look clickable - a button that silently does
 * nothing is worse than one that says why.
 */
export function GoogleButtonPreview({ label }: { label: string }) {
  return (
    <div>
      <button
        type="button"
        disabled
        aria-describedby="google-preview-note"
        className="flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl border border-depth-line bg-white/[0.03] px-4 text-[14px] font-semibold text-depth-muted"
      >
        <GoogleGlyph />
        {label}
      </button>
      <p
        id="google-preview-note"
        className="mt-2 text-center text-[12px] text-depth-muted"
      >
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
