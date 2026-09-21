import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowUpRight, Plug } from 'lucide-react';
import { brand } from '@classpilot/shared';
import { api } from '@/lib/api';
import { IntegrationCard } from '@/components/integrations/integration-card';
import { Reveal } from '@/components/motion/reveal';
import {
  INTEGRATIONS,
  resolveState,
  type IntegrationState,
} from '@/lib/integrations/registry';
import { formatRelative } from '@/lib/format';

export const metadata: Metadata = { title: 'Integrations' };
export const dynamic = 'force-dynamic';

/**
 * Integrations centre.
 *
 * Classroom's state is derived from the REAL sync record: whether a sync has
 * ever run, whether one is running now, whether the last one failed, and how
 * many classes it brought in. Everything else is locked to "Coming soon" by
 * `resolveState`, so this page cannot claim a connection that does not exist.
 */
export default async function IntegrationsPage() {
  const status = await api.syncStatus();

  const classroom = deriveClassroomState(status);

  return (
    <div className="space-y-8">
      <Reveal>
        <header>
          <p className="eyebrow">Connections</p>
          <h1 className="page-heading mt-2">Integrations</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            {brand.shortName} brings your school information together. Classroom
            works today; the rest are in development.
          </p>
        </header>
      </Reveal>

      <div className="grid gap-4 sm:grid-cols-2">
        {INTEGRATIONS.map((definition, index) => {
          const isClassroom = definition.id === 'classroom';
          const state = resolveState(
            definition,
            isClassroom ? classroom.state : 'not_connected',
          );

          return (
            <Reveal
              key={definition.id}
              step={((index % 4) + 1) as 1 | 2 | 3 | 4}
              className="h-full"
            >
              <IntegrationCard
                definition={definition}
                state={state}
                detail={isClassroom ? classroom.detail : definition.method}
                action={
                  isClassroom ? (
                    <Link
                      href="/classes"
                      className="inline-flex min-h-10 items-center gap-1.5 text-[13px] font-semibold text-primary underline underline-offset-4"
                    >
                      View synced classes
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="inline-flex min-h-10 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-[13px] font-semibold text-muted-foreground"
                    >
                      <Plug className="h-3.5 w-3.5" aria-hidden="true" />
                      Connect
                    </button>
                  )
                }
              />
            </Reveal>
          );
        })}
      </div>

      {/* Capability detail, so "coming soon" is concrete rather than vague. */}
      <Reveal step={2}>
        <section className="rounded-xl border bg-card p-6">
          <h2 className="text-[15px] font-semibold">What each connection adds</h2>
          <dl className="mt-5 grid gap-6 sm:grid-cols-2">
            {INTEGRATIONS.map((definition) => (
              <div key={definition.id}>
                <dt className="flex items-center gap-2 text-[13px] font-semibold">
                  <definition.icon
                    className={`h-4 w-4 ${definition.tint}`}
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  {definition.name}
                </dt>
                <dd>
                  <ul className="mt-2 space-y-1.5">
                    {definition.capabilities.map((capability) => (
                      <li
                        key={capability}
                        className="flex gap-2 text-[13px] leading-relaxed text-muted-foreground"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50"
                        />
                        {capability}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2.5 text-[12px] leading-relaxed text-muted-foreground/80">
                    {definition.method}
                  </p>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </Reveal>
    </div>
  );
}

/**
 * Translate the real sync record into an integration state.
 *
 * Every branch here maps to something the API actually reports. There is no
 * default-to-connected path.
 */
function deriveClassroomState(
  status: Awaited<ReturnType<typeof api.syncStatus>>,
): { state: IntegrationState; detail: string } {
  if (!status.ok) {
    return { state: 'error', detail: status.message };
  }

  const { lastSync, activeSync, totals } = status.data;

  if (activeSync) {
    return { state: 'syncing', detail: 'Sync in progress' };
  }

  if (!lastSync) {
    return {
      state: 'not_connected',
      detail: `Install ${brand.extensionName} and run your first sync.`,
    };
  }

  if (lastSync.status === 'failed') {
    return {
      state: 'error',
      detail: 'The last sync did not finish. Try running it again.',
    };
  }

  const when = formatRelative(lastSync.finishedAt ?? lastSync.startedAt);
  const classes = `${totals.classes} ${totals.classes === 1 ? 'class' : 'classes'}`;
  const warned =
    lastSync.status === 'completed_with_warnings'
      ? ` · ${lastSync.warnings.length} item${lastSync.warnings.length === 1 ? '' : 's'} needed attention`
      : '';

  return {
    state: 'connected',
    detail: `${classes} · last sync ${when ?? 'recently'}${warned}`,
  };
}
