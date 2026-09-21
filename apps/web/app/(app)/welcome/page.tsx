import type { Metadata } from 'next';
import { WorkspaceEntrance } from '@/components/auth/workspace-entrance';

export const metadata: Metadata = { title: 'Opening your workspace' };

/**
 * Post-sign-in transition.
 *
 * A dedicated route rather than an overlay, so it is skippable by navigating
 * away and never blocks a direct link to /dashboard. Middleware already
 * requires a session to reach it.
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

  return <WorkspaceEntrance next={next} />;
}
