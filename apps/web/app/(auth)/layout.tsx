import Link from 'next/link';
import { brand } from '@classpilot/shared';
import { BrandLogo, BrandMark } from '@/components/brand-logo';

/**
 * Auth shell - the kit's sign-in concept.
 *
 * A split surface: Light brand on the left carrying the brand statement and a
 * large Waypoint C, Background on the right carrying the form. Both are light,
 * per V2 - "Blue is the signature. White does the work."
 *
 * The brand panel collapses below `lg`; on a phone the form is the whole job
 * and a decorative half-screen would only push it below the fold.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-2">
      {/* --- Brand panel --- */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-secondary p-10 lg:flex xl:p-14">
        <Link href="/" aria-label={`${brand.name} home`} className="inline-flex w-fit rounded-md">
          <BrandLogo size={36} />
        </Link>

        <div className="relative">
          <p className="max-w-md text-h1 text-foreground">
            A little clarity.
            <br />
            Room to focus.
          </p>
          {/* The mark as brand presence, at a size where the aperture reads. */}
          <BrandMark
            size={200}
            className="mt-12 h-40 w-40 text-primary xl:h-52 xl:w-52"
          />
        </div>

        <p className="text-metadata uppercase tracking-[0.12em] text-muted-foreground">
          {brand.tagline}
        </p>
      </aside>

      {/* --- Form panel --- */}
      <main className="flex min-h-screen flex-col justify-center px-5 py-12 sm:px-10 lg:min-h-0 lg:px-14">
        <div className="mx-auto w-full max-w-[26rem]">
          {/* On narrow screens the brand panel is gone, so the lockup leads. */}
          <Link
            href="/"
            aria-label={`${brand.name} home`}
            className="mb-9 inline-flex rounded-md lg:mb-10"
          >
            <BrandLogo size={34} />
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
