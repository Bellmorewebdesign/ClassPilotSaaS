import Link from 'next/link';
import { brand } from '@classpilot/shared';
import { CoursenIcon } from '@/components/coursen-icon';
import { ProductDemo } from '@/components/marketing/product-demo';
import { Reveal } from '@/components/motion/reveal';

/**
 * Hero.
 *
 * The five-second test: headline states the outcome, the lede names the
 * things being connected, and the demo panel shows it happening. No feature
 * list, no adjectives doing work the product should do.
 */
export function Hero() {
  return (
    <div className="relative overflow-hidden px-5 pb-20 pt-28 sm:px-8 sm:pb-28 sm:pt-32">
      <div className="depth-ambient" aria-hidden="true" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
        {/* --- Copy --- */}
        {/* min-w-0: a grid child defaults to min-width:auto, which lets the
            long headline push the track past the viewport. */}
        <div className="min-w-0 max-w-xl">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-depth-line bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-depth-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-depth-accent" aria-hidden="true" />
              Early preview
            </span>
          </Reveal>

          <Reveal step={1}>
            {/*
              The kit's brand line leads. The explanatory sentence beneath it
              does the product work - "Do not sacrifice product clarity for
              minimalism" - so a visitor learns what Coursen is within a few
              seconds without the headline having to carry the whole job.
            */}
            <h1 className="display-heading mt-6 text-depth-ink">
              {brand.tagline}
            </h1>
            <p className="mt-4 text-h3 text-depth-accent">{brand.positioning}</p>
          </Reveal>

          <Reveal step={2}>
            <p className="mt-6 max-w-lg text-body text-depth-muted">
              {brand.shortName} brings your classes, assignments, deadlines,
              announcements, documents and schedule into one workspace - so
              you can see what is actually coming, not go looking for it.
            </p>
          </Reveal>

          <Reveal step={3}>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-depth-ink px-6 text-button text-depth-base transition-colors duration-fast ease-out hover:bg-sky"
              >
                Get started
                <CoursenIcon name="arrow" className="h-4 w-4" />
              </Link>
              <a href="#how-it-works" className="quiet-link min-h-12 px-6">
                See how it works
              </a>
            </div>
          </Reveal>

          <Reveal step={4}>
            <p className="mt-7 flex items-start gap-2.5 text-small-body text-depth-muted">
              <CoursenIcon
                name="check"
                className="mt-0.5 h-4 w-4 shrink-0 text-depth-accent"
              />
              Reads Google Classroom from the session you are already signed
              into. Your school password is never shared with {brand.shortName}.
            </p>
          </Reveal>
        </div>

        {/* --- Product demo --- */}
        <Reveal step={2} className="min-w-0 lg:pl-4">
          <ProductDemo />
        </Reveal>
      </div>
    </div>
  );
}
