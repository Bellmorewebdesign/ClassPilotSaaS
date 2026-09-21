import { brand } from '@classpilot/shared';
import { api } from '@/lib/api';
import { AssignmentRow } from '@/components/assignment-row';
import { EmptyState, ErrorState } from '@/components/states';

export const dynamic = 'force-dynamic';

export default async function AssignmentsPage() {
  const assignments = await api.assignments({ sort: 'dueAt', order: 'asc' });

  if (!assignments.ok) {
    return (
      <ErrorState
        title="Could not load assignments"
        message={assignments.message}
      />
    );
  }

  if (assignments.data.items.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="page-heading">Assignments</h1>
        <EmptyState
          title="No assignments synced yet"
          message={`Run a sync with ${brand.extensionName} to bring in your coursework.`}
          showSetup
        />
      </div>
    );
  }

  // Assignments with no due date sort last: Mongo orders null before any date,
  // but "we never saw a deadline" is not the most urgent thing on the list.
  const dated = assignments.data.items.filter((item) => item.dueAt !== null);
  const undated = assignments.data.items.filter((item) => item.dueAt === null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="page-heading">Assignments</h1>
        <p className="text-sm text-muted-foreground">
          {assignments.data.total} total
        </p>
      </div>

      <div className="space-y-2">
        {dated.map((assignment) => (
          <AssignmentRow key={assignment.id} assignment={assignment} />
        ))}
      </div>

      {undated.length > 0 ? (
        <section className="space-y-3 pt-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            No due date shown in Classroom ({undated.length})
          </h2>
          <div className="space-y-2">
            {undated.map((assignment) => (
              <AssignmentRow key={assignment.id} assignment={assignment} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
