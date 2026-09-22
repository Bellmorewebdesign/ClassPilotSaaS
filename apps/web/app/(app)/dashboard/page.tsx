import Link from 'next/link';
import { ClassBadge } from '@/components/class-badge';
import { CoursenIcon } from '@/components/coursen-icon';
import { brand } from '@classpilot/shared';
import type { AssignmentDto, PaginatedDto } from '@classpilot/shared';
import { api } from '@/lib/api';
import type { ApiResult } from '@/lib/api';
import { AssignmentRow } from '@/components/assignment-row';
import { AssistantCard } from '@/components/assistant-card';
import { EmptyState, ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatDateTime, formatRelative } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const [classes, upcoming, missing, recent, status] = await Promise.all([
    api.classes(),
    api.assignments({
      dueAfter: now.toISOString(),
      dueBefore: weekEnd.toISOString(),
      sort: 'dueAt',
      order: 'asc',
      limit: 6,
    }),
    api.assignments({
      status: 'missing',
      sort: 'dueAt',
      order: 'asc',
      limit: 4,
    }),
    api.assignments({ sort: 'lastSyncedAt', order: 'desc', limit: 4 }),
    api.syncStatus(),
  ]);

  if (!classes.ok)
    return (
      <ErrorState
        title="Could not load your workspace"
        message={classes.message}
      />
    );
  const lastSync = status.ok ? status.data.lastSync : null;
  const activeSync = status.ok ? status.data.activeSync : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Your overview</p>
          <h1 className="page-heading">{brand.tagline}</h1>
          {/* The kit's dashboard leads with the date - it is the cheapest
              possible answer to "what matters right now". */}
          <p className="mt-2 text-body text-muted-foreground">
            {now.toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        {activeSync ? (
          <Badge variant="secondary">Sync in progress…</Badge>
        ) : (
          <Link href="/integrations" className="quiet-link">
            Sync setup
            <CoursenIcon name="arrow" className="h-4 w-4" />
          </Link>
        )}
      </div>
      {classes.data.total === 0 ? (
        <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
          <EmptyState
            title="Your classes will feel at home here."
            message={`Connect Classroom with ${brand.extensionName} to start seeing your coursework. Your classes and assignments will appear after your first sync.`}
            showSetup
          />
          <AssistantCard />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Upcoming"
              value={upcoming.ok ? upcoming.data.total : null}
              detail="Next 7 days, after today"
              icon={<CoursenIcon name="calendar" className="h-5 w-5" />}
            />
            <StatCard
              label="Missing"
              value={missing.ok ? missing.data.total : null}
              detail="As marked in Classroom"
              icon={<CoursenIcon name="attention" className="h-5 w-5" />}
            />
            <StatCard
              label="Your classes"
              value={classes.data.total}
              detail="Synced from Classroom"
              href="/classes"
              icon={<CoursenIcon name="classes" className="h-5 w-5" />}
            />
          </div>
          <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
            <div className="min-w-0 space-y-7">
              {!missing.ok || missing.data.total > 0 ? (
                <CourseworkSection
                  title="Needs your attention"
                  result={missing}
                  empty="No coursework marked missing."
                />
              ) : null}
              <CourseworkSection
                title="Upcoming"
                result={upcoming}
                empty="No upcoming deadlines in your synced coursework for the next 7 days."
              />
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-lg font-semibold">Your classes</h2>
                  <Link
                    href="/classes"
                    className="text-xs font-semibold text-primary underline underline-offset-4"
                  >
                    View all
                  </Link>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {classes.data.items.slice(0, 4).map((klass) => (
                    <Link
                      key={klass.id}
                      href={`/classes/${klass.id}`}
                      className="rounded-lg border bg-card p-5 transition-colors hover:border-primary/40"
                    >
                      {/* The kit identifies a class by a two-letter tile. */}
                      <ClassBadge name={klass.name} className="mb-4" />
                      <h3 className="break-words text-h3 text-foreground">
                        {klass.name}
                      </h3>
                      <p className="mt-2 text-small-body text-muted-foreground">
                        {klass.assignmentCount}{' '}
                        {klass.assignmentCount === 1 ? 'item' : 'items'} synced
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
              <details className="rounded-lg border bg-card p-5">
                <summary className="text-sm font-semibold">
                  Recently synced coursework
                </summary>
                <div className="mt-4">
                  <CourseworkSection
                    title="Recently synced"
                    result={recent}
                    empty="No coursework has been synced yet."
                  />
                </div>
              </details>
            </div>
            <div className="min-w-0 space-y-6">
              <AssistantCard />
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Classroom sync</CardTitle>
                  <CardDescription>
                    A snapshot from your own session.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {!status.ok ? (
                    <p className="text-muted-foreground">
                      Sync status is unavailable.{' '}
                      <Link
                        href="/integrations"
                        className="text-primary underline"
                      >
                        Review connection
                      </Link>
                      .
                    </p>
                  ) : lastSync ? (
                    <>
                      <Badge
                        variant={
                          lastSync.status === 'failed'
                            ? 'destructive'
                            : lastSync.status === 'completed_with_warnings'
                              ? 'warning'
                              : lastSync.status === 'completed'
                                ? 'success'
                                : 'secondary'
                        }
                      >
                        {lastSync.status === 'failed'
                          ? 'Last sync failed'
                          : lastSync.status === 'completed_with_warnings'
                            ? 'Synced with warnings'
                            : lastSync.status === 'completed'
                              ? 'Sync completed'
                              : 'Sync in progress'}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        Last run:{' '}
                        {formatDateTime(
                          lastSync.finishedAt ?? lastSync.startedAt,
                        ) ?? 'Time unavailable'}
                        <br />
                        {formatRelative(
                          lastSync.finishedAt ?? lastSync.startedAt,
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {status.data.totals.assignments} assignments stored.
                      </p>
                      <details className="border-t pt-3">
                        <summary className="text-xs text-muted-foreground">
                          Sync details
                          {lastSync.warnings.length
                            ? ` · ${lastSync.warnings.length} warnings`
                            : ''}
                        </summary>
                        <div className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
                          <p>
                            Last run reported {lastSync.classesSeen} classes and{' '}
                            {lastSync.assignmentsSeen} assignments:{' '}
                            {lastSync.assignmentsCreated} new,{' '}
                            {lastSync.assignmentsUpdated} updated,{' '}
                            {lastSync.assignmentsUnchanged} unchanged.
                          </p>
                          {lastSync.clientVersion ? (
                            <p>Extension version {lastSync.clientVersion}</p>
                          ) : null}
                          <ul className="space-y-2">
                            {lastSync.warnings.map((warning, i) => (
                              <li key={`${warning.code}-${i}`}>
                                {warning.message}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </details>
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      No sync has run yet. Open {brand.extensionName} and choose
                      Sync Classroom.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CourseworkSection({
  title,
  result,
  empty,
}: {
  title: string;
  result: ApiResult<PaginatedDto<AssignmentDto>>;
  empty: string;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Link
          href="/assignments"
          className="text-xs font-semibold text-primary underline underline-offset-4"
        >
          All assignments
        </Link>
      </div>
      {!result.ok ? (
        <ErrorState
          title={`Could not load ${title.toLowerCase()}`}
          message={result.message}
        />
      ) : result.data.items.length ? (
        <>
          <div className="space-y-3">
            {result.data.items.map((assignment) => (
              <AssignmentRow key={assignment.id} assignment={assignment} />
            ))}
          </div>
          {result.data.total > result.data.items.length ? (
            <p className="text-xs text-muted-foreground">
              Showing {result.data.items.length} of {result.data.total}. Open
              all assignments to see more.
            </p>
          ) : null}
        </>
      ) : (
        <div className="rounded-lg border bg-card p-7">
          <p className="text-sm font-medium">{empty}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            This reflects your last sync. Some coursework may not show a due
            date.
          </p>
        </div>
      )}
    </section>
  );
}

function StatCard({
  label,
  value,
  detail,
  href,
  icon,
}: {
  label: string;
  value: number | null;
  detail: string;
  href?: string;
  icon: React.ReactNode;
}) {
  const content = (
    <Card
      className={href ? 'transition-colors hover:border-primary/40' : undefined}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardDescription>{label}</CardDescription>
          <span className="text-primary" aria-hidden="true">
            {icon}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {/* Kit tile: the number carries the weight, the detail sits beside
            it rather than beneath, so the tile stays short. */}
        <div className="flex items-baseline gap-3">
          <p className="text-h1 tabular-nums text-foreground">{value ?? '—'}</p>
          <p className="text-small-body text-muted-foreground">
            {value === null ? 'Could not load this count' : detail}
          </p>
        </div>
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="rounded-lg">
      {content}
    </Link>
  ) : (
    content
  );
}
