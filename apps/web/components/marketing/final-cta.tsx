import Link from 'next/link';
import { CoursenIcon } from '@/components/coursen-icon';
import { brand } from '@classpilot/shared';
import { BrandMark } from '@/components/brand-logo';
import { Reveal } from '@/components/motion/reveal';

export function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-depth-line px-5 py-24 sm:px-8 sm:py-32">
      <div className="depth-ambient" aria-hidden="true" />

      <Reveal className="relative mx-auto max-w-2xl text-center">
        <BrandMark size={44} className="mx-auto h-11 w-11 text-depth-accent" />
        <h2 className="mt-7 text-3xl font-semibold tracking-[-0.04em] text-depth-ink sm:text-[2.75rem] sm:leading-[1.08]">
          Put your whole school week in one place
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-depth-muted sm:text-base">
          {brand.name} is an early preview. Classroom sync works today; more
          sources are on the way.
        </p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-depth-ink px-6 text-[15px] font-semibold text-depth-base shadow-mid transition-[transform,box-shadow] duration-fast ease-out hover:-translate-y-0.5 hover:shadow-high active:translate-y-0"
          >
            Get started
            <CoursenIcon name="arrow" className="h-4 w-4" />
          </Link>
          <Link href="/signin" className="quiet-link min-h-12 px-6 text-[15px]">
            Sign in
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
