import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Shared empty and error states.
 *
 * A dashboard with nothing in it is the DEFAULT experience before the first
 * sync, so these are first-class screens, not afterthoughts. Each one says
 * what happened and what to do next.
 */

export function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <Card className="border-destructive/40">
      <CardContent className="space-y-2 pt-6">
        <p className="font-medium text-destructive">{title}</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  title,
  message,
  showSetup = false,
}: {
  title: string;
  message: string;
  showSetup?: boolean;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="space-y-1.5">
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>

        {showSetup ? (
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>
              Load the extension: <code className="text-xs">chrome://extensions</code>{' '}
              &rarr; Developer mode &rarr; Load unpacked &rarr;{' '}
              <code className="text-xs">apps/extension/dist</code>
            </li>
            <li>
              Open the ClassPilot popup &rarr; Settings, and paste your{' '}
              <code className="text-xs">DEV_EXTENSION_TOKEN</code>
            </li>
            <li>Sign in to Google Classroom in this browser</li>
            <li>
              Click <strong>Sync Classroom</strong>
            </li>
          </ol>
        ) : null}

        <Link
          href="/"
          className="inline-block text-sm text-accent underline underline-offset-4"
        >
          Setup instructions
        </Link>
      </CardContent>
    </Card>
  );
}
