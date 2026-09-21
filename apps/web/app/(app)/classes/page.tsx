import { brand } from '@classpilot/shared';
import Link from 'next/link';
import { api } from '@/lib/api';
import { EmptyState, ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { NOT_CAPTURED, formatRelative } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ClassesPage() {
  const classes = await api.classes();

  if (!classes.ok) {
    return (
      <ErrorState
        title="Could not load your classes"
        message={classes.message}
      />
    );
  }

  if (classes.data.items.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="page-heading">Classes</h1>
        <EmptyState
          title="No classes synced yet"
          message={`Run a sync with ${brand.extensionName} and your enrolled classes will appear here.`}
          showSetup
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="page-heading">Classes</h1>
        <p className="text-sm text-muted-foreground">
          {classes.data.total} {classes.data.total === 1 ? 'class' : 'classes'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {classes.data.items.map((klass) => (
          <Card key={klass.id} className="flex min-w-0 flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="break-words text-base leading-snug">
                    <Link
                      href={`/classes/${klass.id}`}
                      className="hover:underline"
                    >
                      {klass.name}
                    </Link>
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {klass.section ?? NOT_CAPTURED}
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {klass.assignmentCount}{' '}
                  {klass.assignmentCount === 1 ? 'item' : 'items'}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="mt-auto space-y-2 text-sm">
              <dl className="space-y-1.5">
                <Row label="Teacher" value={klass.teacherName} />
                <Row label="Room" value={klass.room} />
                <Row
                  label="Last synced"
                  value={formatRelative(klass.lastSyncedAt) ?? 'never'}
                />
              </dl>

              <div className="flex flex-wrap gap-3 pt-1 text-xs">
                <Link
                  href={`/classes/${klass.id}`}
                  className="text-accent underline underline-offset-4"
                >
                  View assignments
                </Link>
                {klass.canonicalUrl ? (
                  <a
                    href={klass.canonicalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground underline underline-offset-4"
                  >
                    Open in Classroom
                  </a>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/** A label/value pair that states plainly when a value was never captured. */
function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={value ? 'text-right' : 'text-right text-muted-foreground'}>
        {value ?? NOT_CAPTURED}
      </dd>
    </div>
  );
}
