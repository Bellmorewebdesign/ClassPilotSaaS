import { SiteNav } from '@/components/marketing/site-nav';
import { SiteFooter } from '@/components/marketing/site-footer';

/**
 * Public marketing shell.
 *
 * `on-depth` switches the whole subtree onto the dark surface palette and
 * retargets focus rings and selection colours so they stay visible. The
 * workspace keeps the light palette; these never mix.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="on-depth min-h-screen">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <SiteNav />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
