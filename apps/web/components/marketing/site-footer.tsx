import Link from 'next/link';
import { brand } from '@classpilot/shared';
import { BrandLogo } from '@/components/brand-logo';

/**
 * Marketing footer.
 *
 * Deliberately has no external links: the working domain is not owned, so
 * there is nothing legitimate to point at yet. Better an honest short footer
 * than a row of dead links.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-depth-line px-5 py-12 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xs">
          <BrandLogo tone="depth" />
          <p className="mt-4 text-sm leading-relaxed text-depth-muted">
            {brand.description}
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap gap-x-10 gap-y-3 text-sm">
          <Link
            href="/signin"
            className="text-depth-muted transition-colors duration-fast hover:text-depth-ink"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="text-depth-muted transition-colors duration-fast hover:text-depth-ink"
          >
            Get started
          </Link>
          <a
            href="#integrations"
            className="text-depth-muted transition-colors duration-fast hover:text-depth-ink"
          >
            Integrations
          </a>
        </nav>
      </div>

      <div className="mx-auto mt-10 max-w-6xl border-t border-depth-line pt-6">
        <p className="text-xs leading-relaxed text-depth-muted">
          {brand.name} is an early preview. {brand.shortName} reads your
          Google Classroom from the session you are already signed into - it
          never asks for your school password.
        </p>
      </div>
    </footer>
  );
}
