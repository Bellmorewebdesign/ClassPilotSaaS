import type { Metadata } from 'next';
import { brand } from '@classpilot/shared';
import { WorkspaceEntrance } from '@/components/auth/workspace-entrance';

export const metadata: Metadata = { title: 'Opening your workspace' };

/**
 * Post-sign-in transition.
 *
 * A dedicated route rather than an overlay, so it is skippable by navigating
 * away and never blocks a direct link to /dashboard. Middleware already
 * requires a session to reach it.
 *
 * It sits OUTSIDE the (app) group deliberately. The workspace shell animates
 * its <main> in, and an element mid-transform becomes the containing block
 * for `position: fixed` children - which trapped this full-screen moment
 * inside the content column. A transition that covers the workspace should
 * not be rendered by the workspace.
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next =
    params.next?.startsWith('/') && !params.next.startsWith('//')
      ? params.next
      : '/dashboard';

  return (
    <>
      <WorkspaceEntrance next={next} />
      {/*
        The reveal itself is pure CSS, so it plays with scripts off - but the
        redirect that follows it does not. Without this the page would be a
        dead end. It sits below the moment rather than over it, so the brand
        entrance is still the thing you see.
      */}
      <noscript>
        <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-6 pb-14">
          <a href={next} className="action-link">
            Open {brand.shortName}
          </a>
        </div>
      </noscript>
    </>
  );
}
