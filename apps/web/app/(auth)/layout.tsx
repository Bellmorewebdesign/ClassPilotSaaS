import Link from 'next/link';
import { brand } from '@classpilot/shared';
import { BrandLogo } from '@/components/brand-logo';

/**
 * Auth shell.
 *
 * Shares the marketing surface so signing in feels like staying inside the
 * same product rather than jumping to an admin login. No nav, no footer - a
 * single job per screen.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="on-depth relative flex min-h-screen flex-col">
      <div className="depth-ambient" aria-hidden="true" />

      <header className="relative px-5 py-6 sm:px-8">
        <Link href="/" aria-label={`${brand.name} home`} className="inline-block rounded-lg">
          <BrandLogo tone="depth" />
        </Link>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-5 pb-16 pt-4 sm:px-8">
        {children}
      </main>
    </div>
  );
}
