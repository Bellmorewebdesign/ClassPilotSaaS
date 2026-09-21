import type { ReactNode } from 'react';
import { Reveal } from '@/components/motion/reveal';
import { cn } from '@/lib/utils';

/**
 * Section scaffolding for the marketing page.
 *
 * Exists so every section shares the same rhythm - width, vertical padding,
 * eyebrow/heading/lede hierarchy - instead of each one re-deciding. Keeping
 * this consistent is most of what makes a landing page feel designed rather
 * than assembled.
 */
export function Section({
  id,
  children,
  className,
  bleed = false,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  /** Skip the inner max-width, for full-bleed content. */
  bleed?: boolean;
}) {
  return (
    <section id={id} className={cn('scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28', className)}>
      <div className={bleed ? undefined : 'mx-auto max-w-6xl'}>{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lede,
  align = 'left',
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <Reveal
      className={cn(
        'max-w-2xl',
        align === 'center' && 'mx-auto text-center',
        className,
      )}
    >
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-depth-ink sm:text-[2.5rem] sm:leading-[1.1]">
        {title}
      </h2>
      {lede ? (
        <p className="mt-4 text-[15px] leading-relaxed text-depth-muted sm:text-base">
          {lede}
        </p>
      ) : null}
    </Reveal>
  );
}
