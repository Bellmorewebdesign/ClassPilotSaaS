import Link from 'next/link';
import { brand } from '@classpilot/shared';
import { CoursenIcon } from '@/components/coursen-icon';
import { BrandMark } from '@/components/brand-logo';
import { Card, CardContent } from '@/components/ui/card';

export function ErrorState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <Card className="border-destructive/30">
      <CardContent className="space-y-4 pt-6">
        <CoursenIcon name="attention" className="h-7 w-7 text-error-text" />
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your coursework could not be loaded. Check the connection and try
            again.
          </p>
        </div>
        <Link
          href="/integrations"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4"
        >
          Check integrations
        </Link>
        <details className="border-t pt-3">
          <summary className="text-xs text-muted-foreground">
            Connection details
          </summary>
          <p className="mt-3 break-words text-xs leading-relaxed text-muted-foreground">
            {message}
          </p>
        </details>
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
      <CardContent className="space-y-5 px-6 py-9 sm:px-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-secondary">
          <BrandMark className="h-12 w-12" />
        </div>
        <div className="max-w-lg space-y-2">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {message}
          </p>
        </div>
        {showSetup ? (
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs text-muted-foreground">
            <span>01 &nbsp; Set up {brand.extensionName}</span>
            <span>02 &nbsp; Open Classroom</span>
            <span>03 &nbsp; Sync your classes</span>
          </div>
        ) : null}
        <Link href="/integrations" className="action-link">
          Set up Classroom sync{' '}
          <CoursenIcon name="arrow" className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
}
