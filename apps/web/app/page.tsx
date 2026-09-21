import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * Landing / setup page.
 *
 * Doubles as the connection check: it reports whether the web app can reach
 * the API, so a misconfigured .env is visible immediately rather than as a
 * mysteriously empty dashboard.
 */
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [me, status] = await Promise.all([api.me(), api.syncStatus()]);
  const connected = me.ok;
  const totals = status.ok ? status.data.totals : { classes: 0, assignments: 0 };

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          Your Classroom, in one place
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          ClassPilot syncs your Google Classroom classes and assignments from the
          session you are already signed into. It never asks for your school
          password, and it only reads pages you can already open yourself.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link
            href="/dashboard"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Open dashboard
          </Link>
          <Link
            href="/classes"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium"
          >
            View classes
          </Link>
        </div>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>API connection</CardTitle>
              <CardDescription className="mt-1">{api.url}</CardDescription>
            </div>
            <Badge variant={connected ? 'default' : 'destructive'}>
              {connected ? 'Connected' : 'Not connected'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {connected ? (
            <>
              <p className="text-muted-foreground">
                Signed in as <strong className="text-foreground">{me.data.email}</strong>{' '}
                ({me.data.authMode} mode).
              </p>
              <p className="text-muted-foreground">
                {totals.classes} {totals.classes === 1 ? 'class' : 'classes'} and{' '}
                {totals.assignments}{' '}
                {totals.assignments === 1 ? 'assignment' : 'assignments'} stored.
              </p>
            </>
          ) : (
            <p className="text-destructive">{me.message}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
          <CardDescription>Four steps, once.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-3 pl-5 text-sm text-muted-foreground">
            <li>
              Build the extension with <code className="text-xs">pnpm build:extension</code>,
              then load <code className="text-xs">apps/extension/dist</code> at{' '}
              <code className="text-xs">chrome://extensions</code> with Developer mode on
              (&ldquo;Load unpacked&rdquo;).
            </li>
            <li>
              Open the ClassPilot popup, go to <strong>Settings</strong>, set the API URL to{' '}
              <code className="text-xs">{api.url}</code> and paste your{' '}
              <code className="text-xs">DEV_EXTENSION_TOKEN</code>. Click{' '}
              <strong>Save &amp; test</strong>.
            </li>
            <li>
              Sign in to{' '}
              <a
                href="https://classroom.google.com"
                className="text-accent underline underline-offset-4"
                target="_blank"
                rel="noreferrer"
              >
                Google Classroom
              </a>{' '}
              in this browser, as you normally would.
            </li>
            <li>
              Click <strong>Sync Classroom</strong> in the popup, then come back to the{' '}
              <Link href="/dashboard" className="text-accent underline underline-offset-4">
                dashboard
              </Link>
              .
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ask ClassPilot</CardTitle>
          <CardDescription>Coming in a later milestone.</CardDescription>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-md border border-dashed border-border px-4 py-3 text-left text-sm text-muted-foreground"
          >
            Ask ClassPilot about your coursework&hellip;
            <span className="ml-2 text-xs">(not enabled yet)</span>
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
