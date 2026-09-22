import Link from 'next/link';
import { redirect } from 'next/navigation';
import { brand } from '@classpilot/shared';
import { BrandLogo, BrandMark } from '@/components/brand-logo';
import { WorkspaceNav } from '@/components/workspace-nav';
import { UserMenu } from '@/components/app/user-menu';
import { currentSession } from '@/lib/session';

/**
 * Workspace shell.
 *
 * Light surface, deliberately calmer than the marketing site - this is where
 * someone reads for twenty minutes, so contrast and quiet matter more than
 * atmosphere. The shared type scale, radii, motion tokens and the Coursen
 * mark keep it recognisably the same product.
 *
 * Middleware already redirects unauthenticated requests; the check here is
 * defence in depth for anything that bypasses the matcher.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await currentSession();
  if (!session) redirect('/signin');

  return (
    <div className="min-h-screen bg-background">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      {/* --- Desktop sidebar --- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[15rem] flex-col border-r bg-card px-4 py-6 lg:flex">
        <Link
          href="/dashboard"
          aria-label={`${brand.name} workspace`}
          className="mb-8 rounded-lg px-2"
        >
          <BrandLogo />
        </Link>

        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Workspace
        </p>
        <WorkspaceNav />

        <div className="mt-auto space-y-4">
          <div className="rounded-xl border bg-secondary/50 p-4">
            <BrandMark size={24} className="mb-2 h-6 w-6" />
            <p className="text-[13px] font-semibold">{brand.extensionName}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              Sync Classroom from your own browser session.
            </p>
            <Link
              href="/integrations"
              className="mt-3 inline-flex min-h-9 items-center text-[12px] font-semibold text-primary underline underline-offset-4"
            >
              Manage integrations &rarr;
            </Link>
          </div>

          <div className="border-t pt-4">
            <UserMenu email={session.email} />
          </div>
        </div>
      </aside>

      {/* --- Main column --- */}
      <div className="lg:pl-[15rem]">
        <header className="sticky top-0 z-20 border-b bg-card/85 backdrop-blur-glass">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-5 sm:px-8">
            <Link
              href="/dashboard"
              className="rounded-lg lg:hidden"
              aria-label={`${brand.name} workspace`}
            >
              <BrandLogo />
            </Link>
            <span className="hidden rounded-full border bg-background px-3 py-1.5 text-[11px] font-medium text-muted-foreground lg:ml-auto lg:inline-flex">
              Early preview
            </span>
            <div className="lg:hidden">
              <UserMenu email={session.email} />
            </div>
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-5xl animate-rise-in px-5 pb-28 pt-8 sm:px-8 lg:pb-16 lg:pt-10"
        >
          {children}
        </main>
      </div>

      {/* --- Mobile tab bar --- */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-glass lg:hidden">
        <WorkspaceNav mobile />
      </div>
    </div>
  );
}
