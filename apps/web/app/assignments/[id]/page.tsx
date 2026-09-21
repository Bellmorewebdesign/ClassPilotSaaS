import { brand } from '@classpilot/shared';
import { AssistantCard } from '@/components/assistant-card';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  NOT_CAPTURED,
  formatAttachmentType,
  formatDateTime,
  formatRelative,
  formatStatus,
  formatType,
  isOverdue,
} from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * Full assignment detail.
 *
 * Shows every field ClassPilot extracted, and says explicitly when a field
 * was not present on the Classroom page. That distinction matters: "no due
 * date" and "we could not read the due date" are different problems, and the
 * page should never let one masquerade as the other.
 */
export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const assignment = await api.assignmentById(id);

  if (!assignment.ok) {
    if (assignment.kind === 'error') notFound();
    return (
      <ErrorState
        title="Could not load this assignment"
        message={assignment.message}
      />
    );
  }

  const item = assignment.data;
  const due = formatDateTime(item.dueAt);
  const overdue =
    isOverdue(item.dueAt) &&
    item.status !== 'submitted' &&
    item.status !== 'returned';

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href={`/classes/${item.classId}`}
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          &larr; {item.className ?? 'Back to class'}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{item.title}</h1>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge variant="outline">{formatType(item.assignmentType)}</Badge>
          <Badge
            variant={item.status === 'missing' ? 'destructive' : 'secondary'}
          >
            {formatStatus(item.status)}
          </Badge>
          {item.topic ? <Badge variant="outline">{item.topic}</Badge> : null}
        </div>
      </div>

      {/* --- Key facts --- */}
      <Card>
        <CardContent className="grid gap-x-8 gap-y-4 pt-6 sm:grid-cols-2">
          <Fact
            label="Due"
            value={due}
            fallback={item.dueLabel ?? 'No due date shown in Classroom'}
            tone={overdue ? 'destructive' : 'default'}
          />
          <Fact
            label="Points"
            value={
              item.pointsPossible !== null ? `${item.pointsPossible}` : null
            }
          />
          <Fact label="Class" value={item.className} />
          <Fact label="Topic" value={item.topic} />
          <Fact
            label="Grade"
            value={
              item.grade?.raw ??
              (item.grade?.earned !== null && item.grade?.earned !== undefined
                ? String(item.grade.earned)
                : null)
            }
            fallback="Not graded, or not shown"
          />
          <Fact label="Last synced" value={formatRelative(item.lastSyncedAt)} />
        </CardContent>
      </Card>

      {/* --- Instructions --- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          {item.instructions ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {item.instructions}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No instructions were found on this assignment&rsquo;s Classroom
              page.
            </p>
          )}
        </CardContent>
      </Card>

      {/* --- Attachments --- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Attachments
            {item.attachments.length > 0 ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {item.attachments.length}
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {item.attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No attachments were found on this assignment.
            </p>
          ) : (
            <ul className="space-y-2">
              {item.attachments.map((attachment) => (
                <li key={attachment.url}>
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm transition-colors hover:bg-secondary/60"
                  >
                    <span className="min-w-0 truncate">
                      {attachment.name ?? attachment.url}
                    </span>
                    <Badge variant="outline" className="shrink-0">
                      {formatAttachmentType(attachment.attachmentType)}
                    </Badge>
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {brand.shortName} records an attachment&rsquo;s name, link and type.
            It does not open or read the file.
          </p>
        </CardContent>
      </Card>

      {/* --- Provenance --- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Source</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <dl className="space-y-1.5">
            <SourceRow
              label="First seen"
              value={formatDateTime(item.firstSeenAt)}
            />
            <SourceRow
              label="Last seen"
              value={formatDateTime(item.lastSeenAt)}
            />
            <SourceRow
              label="Due date read as"
              value={item.dueLabel}
              hint={`The literal text ${brand.shortName} read from Classroom.`}
            />
          </dl>
          {item.canonicalUrl ? (
            <a
              href={item.canonicalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block pt-1 text-accent underline underline-offset-4"
            >
              Open in Google Classroom
            </a>
          ) : null}
        </CardContent>
      </Card>

      <AssistantCard />
    </div>
  );
}

function Fact({
  label,
  value,
  fallback = NOT_CAPTURED,
  tone = 'default',
}: {
  label: string;
  value: string | null;
  fallback?: string;
  tone?: 'default' | 'destructive';
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={
          value
            ? tone === 'destructive'
              ? 'mt-1 font-medium text-destructive'
              : 'mt-1 font-medium'
            : 'mt-1 text-sm text-muted-foreground'
        }
      >
        {value ?? fallback}
      </p>
    </div>
  );
}

function SourceRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | null;
  hint?: string;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">
        {label}
        {hint ? <span className="block text-xs">{hint}</span> : null}
      </dt>
      <dd className={value ? 'text-right' : 'text-right text-muted-foreground'}>
        {value ?? NOT_CAPTURED}
      </dd>
    </div>
  );
}
