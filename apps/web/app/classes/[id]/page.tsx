import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { AssignmentRow } from '@/components/assignment-row';
import { ErrorState } from '@/components/states';
import { Card, CardContent } from '@/components/ui/card';
import { NOT_CAPTURED, formatRelative } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [klass, assignments] = await Promise.all([
    api.classById(id),
    api.assignments({ classId: id, sort: 'dueAt', order: 'asc' }),
  ]);

  if (!klass.ok) {
    // A class belonging to another user comes back as 404 from the API, which
    // is exactly what we want the page to render.
    if (klass.kind === 'error') notFound();
    return <ErrorState title="Could not load this class" message={klass.message} />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/classes"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          &larr; All classes
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{klass.data.name}</h1>
        <p className="text-sm text-muted-foreground">
          {[klass.data.section, klass.data.teacherName, klass.data.room]
            .filter(Boolean)
            .join(' · ') || NOT_CAPTURED}
        </p>
      </div>

      {klass.data.description ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {klass.data.description}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground">
          Last synced {formatRelative(klass.data.lastSyncedAt) ?? 'never'}
        </p>
        {klass.data.canonicalUrl ? (
          <a
            href={klass.data.canonicalUrl}
            target="_blank"
            rel="noreferrer"
            className="text-accent underline underline-offset-4"
          >
            Open in Google Classroom
          </a>
        ) : null}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Assignments
          {assignments.ok ? (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {assignments.data.total}
            </span>
          ) : null}
        </h2>

        {!assignments.ok ? (
          <ErrorState title="Could not load assignments" message={assignments.message} />
        ) : assignments.data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No classwork has been synced for this class yet. It may have no items, or the
            Classwork page could not be read during the last sync.
          </p>
        ) : (
          <div className="space-y-2">
            {assignments.data.items.map((assignment) => (
              <AssignmentRow key={assignment.id} assignment={assignment} showClass={false} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
