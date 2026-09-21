import Link from 'next/link';
import type { AssignmentDto } from '@classpilot/shared';
import { Badge } from '@/components/ui/badge';
import {
  formatDateTime,
  formatRelative,
  formatStatus,
  formatType,
  isDueSoon,
  isOverdue,
} from '@/lib/format';

/**
 * One assignment in a list.
 *
 * Shows the class name only when the list spans classes; inside a single
 * class page it would be noise on every row.
 */
export function AssignmentRow({
  assignment,
  showClass = true,
}: {
  assignment: AssignmentDto;
  showClass?: boolean;
}) {
  const due = formatDateTime(assignment.dueAt);
  const overdue = isOverdue(assignment.dueAt) && assignment.status !== 'submitted';
  const soon = isDueSoon(assignment.dueAt);

  return (
    <Link
      href={`/assignments/${assignment.id}`}
      className="block rounded-lg border border-border p-4 transition-colors hover:bg-secondary/60"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate font-medium">{assignment.title}</p>
          <p className="text-xs text-muted-foreground">
            {showClass && assignment.className ? `${assignment.className} · ` : ''}
            {formatType(assignment.assignmentType)}
            {assignment.topic ? ` · ${assignment.topic}` : ''}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {assignment.pointsPossible !== null ? (
            <span className="text-xs text-muted-foreground">
              {assignment.pointsPossible} pts
            </span>
          ) : null}

          {assignment.grade?.raw ? (
            <Badge variant="secondary">{assignment.grade.raw}</Badge>
          ) : null}

          <Badge variant={assignment.status === 'missing' ? 'destructive' : 'outline'}>
            {formatStatus(assignment.status)}
          </Badge>
        </div>
      </div>

      <p className="mt-2 text-xs">
        {due ? (
          <span
            className={
              overdue
                ? 'text-destructive'
                : soon
                  ? 'text-accent'
                  : 'text-muted-foreground'
            }
          >
            Due {due}
            {formatRelative(assignment.dueAt)
              ? ` · ${formatRelative(assignment.dueAt)}`
              : ''}
          </span>
        ) : (
          <span className="text-muted-foreground">
            {assignment.dueLabel ?? 'No due date shown in Classroom'}
          </span>
        )}
        {assignment.attachments.length > 0 ? (
          <span className="text-muted-foreground">
            {' · '}
            {assignment.attachments.length}{' '}
            {assignment.attachments.length === 1 ? 'attachment' : 'attachments'}
          </span>
        ) : null}
      </p>
    </Link>
  );
}
