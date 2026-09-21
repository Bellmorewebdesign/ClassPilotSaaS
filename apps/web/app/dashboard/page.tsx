import Link from 'next/link';
import { api } from '@/lib/api';
import { AssignmentRow } from '@/components/assignment-row';
import { EmptyState, ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime, formatRelative } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * Dashboard.
 *
 * Answers the four questions a student actually has when they open this:
 * how many classes do I have, what is due soon, what changed in the last
 * sync, and is the extension still working?
 */
export default async function DashboardPage() {
  const [classes, dueSoon, recent, status] = await Promise.all([
    api.classes(),
    api.assignments({ dueAfter: new Date().toISOString(), sort: 'dueAt', order: 'asc', limit: 10 }),
    api.assignments({ sort: 'lastSyncedAt', order: 'desc', limit: 8 }),
    api.syncStatus(),
  ]);

  if (!classes.ok) {
    return <ErrorState title="Could not load your dashboard" message={classes.message} />;
  }

  const totalClasses = classes.data.total;
  const lastSync = status.ok ? status.data.lastSync : null;
  const activeSync = status.ok ? status.data.activeSync : null;
  const totalAssignments = status.ok ? status.data.totals.assignments : 0;

  if (totalClasses === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <EmptyState
          title="No classes synced yet"
          message="Once you run your first sync from the ClassPilot extension, your classes and assignments will appear here."
          showSetup
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        {activeSync ? <Badge variant="secondary">Sync in progress&hellip;</Badge> : null}
      </div>

      {/* --- Summary tiles --- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Classes" value={totalClasses} href="/classes" />
        <StatCard label="Assignments" value={totalAssignments} href="/assignments" />
        <StatCard
          label="Due in the next 7 days"
          value={dueSoon.ok ? dueSoon.data.items.filter(withinSevenDays).length : 0}
        />
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last Classroom sync</CardDescription>
          </CardHeader>
          <CardContent>
            {lastSync ? (
              <>
                <p className="text-sm font-medium">
                  {formatDateTime(lastSync.finishedAt ?? lastSync.startedAt) ?? 'unknown'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatRelative(lastSync.finishedAt ?? lastSync.startedAt)}
                  {lastSync.status === 'completed_with_warnings'
                    ? ' · completed with warnings'
                    : ''}
                  {lastSync.status === 'failed' ? ' · failed' : ''}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Never</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* --- Extension connection --- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Extension connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm text-muted-foreground">
          {lastSync ? (
            <>
              <p>
                Last sync reported {lastSync.classesSeen} classes and{' '}
                {lastSync.assignmentsSeen} assignments &mdash;{' '}
                {lastSync.assignmentsCreated} new, {lastSync.assignmentsUpdated} updated,{' '}
                {lastSync.assignmentsUnchanged} unchanged.
              </p>
              {lastSync.clientVersion ? (
                <p className="text-xs">Extension version {lastSync.clientVersion}</p>
              ) : null}
              {lastSync.warnings.length > 0 ? (
                <details className="pt-2">
                  <summary className="cursor-pointer text-xs text-foreground">
                    {lastSync.warnings.length}{' '}
                    {lastSync.warnings.length === 1 ? 'item' : 'items'} could not be read
                  </summary>
                  <ul className="mt-2 space-y-1.5 border-l-2 border-border pl-3 text-xs">
                    {lastSync.warnings.map((warning, index) => (
                      <li key={`${warning.code}-${index}`}>{warning.message}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </>
          ) : (
            <p>No sync has run yet. Open the ClassPilot extension and click Sync Classroom.</p>
          )}
        </CardContent>
      </Card>

      {/* --- Due soon --- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Due soon</h2>
          <Link href="/assignments" className="text-sm text-accent underline underline-offset-4">
            All assignments
          </Link>
        </div>
        {dueSoon.ok && dueSoon.data.items.length > 0 ? (
          <div className="space-y-2">
            {dueSoon.data.items.map((assignment) => (
              <AssignmentRow key={assignment.id} assignment={assignment} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing with an upcoming due date. Classroom may not show due dates for
            everything.
          </p>
        )}
      </section>

      {/* --- Recently synced --- */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recently synced</h2>
        {recent.ok && recent.data.items.length > 0 ? (
          <div className="space-y-2">
            {recent.data.items.map((assignment) => (
              <AssignmentRow key={assignment.id} assignment={assignment} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing synced yet.</p>
        )}
      </section>
    </div>
  );
}

function withinSevenDays(assignment: { dueAt: string | null }): boolean {
  if (!assignment.dueAt) return false;
  const diff = new Date(assignment.dueAt).getTime() - Date.now();
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
}

function StatCard({ label, value, href }: { label: string; value: number; href?: string }) {
  const body = (
    <Card className={href ? 'transition-colors hover:bg-secondary/60' : undefined}>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
