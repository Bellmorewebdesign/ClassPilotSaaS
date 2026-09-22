import Link from 'next/link';
import type { AssignmentDto } from '@classpilot/shared';
import {
  formatDateTime,
  formatStatus,
  isDueSoon,
  isOverdue,
} from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * One assignment, following the kit's component sheet exactly:
 *
 *   title first, class second, precise due date and source status next,
 *   status badge bottom-right.
 *
 * Deliberately absent, per the same sheet: "No decorative grade claims or
 * completion controls." A grade is shown only where the source actually
 * reported one, and there is no checkbox pretending Coursen can mark work done.
 */
export function AssignmentRow({
  assignment,
  showClass = true,
}: {
  assignment: AssignmentDto;
  showClass?: boolean;
}) {
  const due = formatDateTime(assignment.dueAt);
  const overdue =
    isOverdue(assignment.dueAt) &&
    assignment.status !== 'submitted' &&
    assignment.status !== 'returned';

  return (
    <Link
      href={`/assignments/${assignment.id}`}
      className="block rounded-lg border bg-card p-4 transition-colors duration-fast ease-out hover:border-primary/40 sm:p-5"
    >
      <p className="break-words text-h3 text-foreground">{assignment.title}</p>

      {showClass && assignment.className ? (
        <p className="mt-1 truncate text-small-body text-muted-foreground">
          {assignment.className}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <p
          className={cn(
            'text-small-body',
            overdue ? 'text-error-text' : 'text-muted-foreground',
          )}
        >
          {due ? (
            <>
              Due {due}
              {isDueSoon(assignment.dueAt) && !overdue ? ' · soon' : ''}
            </>
          ) : (
            (assignment.dueLabel ?? 'No due date in Classroom')
          )}
        </p>

        <div className="flex shrink-0 items-center gap-2">
          {assignment.pointsPossible !== null ? (
            <span className="text-metadata text-muted-foreground">
              {assignment.pointsPossible} pts
            </span>
          ) : null}
          {/* Only shown when Classroom actually reported a grade. */}
          {assignment.grade?.raw ? (
            <span className="rounded-full bg-success-surface px-2.5 py-1 text-metadata font-semibold text-success">
              {assignment.grade.raw}
            </span>
          ) : null}
          <StatusBadge status={assignment.status} />
        </div>
      </div>
    </Link>
  );
}

/**
 * Status pill.
 *
 * "Meaning comes with words and shape" (guide page 18): each status carries
 * its own surface AND its own word, so it never relies on colour alone.
 */
export function StatusBadge({ status }: { status: AssignmentDto['status'] }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2.5 py-1 text-metadata font-semibold',
        status === 'missing' && 'bg-error-surface text-error-text',
        status === 'returned' && 'bg-success-surface text-success',
        status === 'submitted' && 'bg-success-surface text-success',
        status === 'assigned' && 'bg-secondary text-primary',
        status === 'unknown' && 'bg-neutral text-muted-foreground',
      )}
    >
      {formatStatus(status)}
    </span>
  );
}
