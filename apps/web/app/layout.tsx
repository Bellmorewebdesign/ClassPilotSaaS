import type { Metadata } from 'next';
import localFont from 'next/font/local';
import Link from 'next/link';
import { brand, brandCssVariables } from '@classpilot/shared';
import { BrandLogo, BrandMark } from '@/components/brand-logo';
import { WorkspaceNav } from '@/components/workspace-nav';
import './globals.css';

const manrope = localFont({
  src: '../../../packages/shared/assets/Manrope.woff',
  variable: '--font-sans',
  display: 'swap',
  weight: '200 800',
});

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.description,
  icons: {
    icon: '/brand/favicon-32.png',
    apple: '/brand/apple-touch-icon.png',
  },
  // No metadataBase or canonical URL: the working domain is not owned.
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={manrope.variable}
      style={brandCssVariables() as React.CSSProperties}
    >
      <body>
        <a href="#main-content" className="skip-link">
          Skip to coursework
        </a>
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-card px-5 py-7 lg:flex">
          <Link
            href="/"
            aria-label={`${brand.name} home`}
            className="mb-12 rounded-lg"
          >
            <BrandLogo />
          </Link>
          <p className="mb-4 px-4 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Your workspace
          </p>
          <WorkspaceNav />
          <div className="mt-auto rounded-2xl bg-secondary/60 p-4">
            <BrandMark className="mb-2 h-8 w-8" />
            <p className="text-sm font-semibold">{brand.extensionName}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Bring your Classroom coursework into view.
            </p>
            <Link
              href="/#sync-setup"
              className="mt-4 inline-flex min-h-11 items-center text-xs font-semibold text-primary underline underline-offset-4"
            >
              Sync setup &rarr;
            </Link>
          </div>
        </aside>
        <div className="lg:pl-60">
          <header className="border-b bg-card/90 px-5 py-4 sm:px-8 lg:px-10">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
              <Link
                href="/"
                className="rounded-lg lg:hidden"
                aria-label={`${brand.name} home`}
              >
                <BrandLogo />
              </Link>
              <p className="hidden text-sm text-muted-foreground lg:block">
                A clearer view of your schoolwork
              </p>
              <span className="rounded-full border bg-background px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                Early preview
              </span>
            </div>
          </header>
          <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10"
          >
            {children}
          </main>
          <footer className="mx-auto max-w-6xl px-5 pb-28 pt-4 text-xs leading-relaxed text-muted-foreground sm:px-8 lg:px-10 lg:pb-8">
            {brand.name} &middot; Coursework from your own Google Classroom
            session.
          </footer>
        </div>
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 lg:hidden">
          <WorkspaceNav mobile />
        </div>
      </body>
    </html>
  );
}
