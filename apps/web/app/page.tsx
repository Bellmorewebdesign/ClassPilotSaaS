import Link from 'next/link';
import { ArrowRight, Check, PanelsTopLeft, RefreshCw } from 'lucide-react';
import { brand } from '@classpilot/shared';
import { api } from '@/lib/api';
import { AssistantCard } from '@/components/assistant-card';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [me, status] = await Promise.all([api.me(), api.syncStatus()]);
  const connected = me.ok;
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[28px] border border-primary/10 bg-secondary/65 p-7 sm:p-10">
        <p className="eyebrow">Welcome to {brand.name}</p>
        <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-[1.12] tracking-[-0.045em] sm:text-5xl">
          {brand.tagline}
        </h1>
        <p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground">
          See your classes and assignments together, synced from the Google
          Classroom session you already use.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/dashboard" className="action-link">
            Open workspace <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <a href="#sync-setup" className="quiet-link">
            Set up sync
          </a>
        </div>
        <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
          <Check className="h-4 w-4 text-primary" aria-hidden="true" /> No
          school password shared with {brand.shortName}.
        </p>
      </section>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
        <div className="space-y-6">
          <Card id="sync-setup" className="scroll-mt-6">
            <CardHeader>
              <p className="eyebrow mb-2">Get connected</p>
              <CardTitle>Make room for your coursework.</CardTitle>
              <CardDescription>Three steps to a clearer view.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-6">
                {[
                  [
                    'Set up your extension',
                    `Install ${brand.extensionName} and connect it to your workspace. Development setup is below.`,
                  ],
                  [
                    'Open Google Classroom',
                    'Use the browser and school account where your classes already live.',
                  ],
                  [
                    'Bring your classes into view',
                    'Choose Sync Classroom in the extension, then open your workspace.',
                  ],
                ].map(([title, copy], i) => (
                  <li key={title} className="flex gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-xs font-bold text-primary">
                      0{i + 1}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold">{title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {copy}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              <a
                href="https://classroom.google.com"
                target="_blank"
                rel="noreferrer"
                className="quiet-link mt-6"
              >
                Open Google Classroom{' '}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <details className="mt-7 border-t pt-4">
                <summary className="min-h-9 text-xs font-medium text-muted-foreground">
                  Development installation &amp; connection
                </summary>
                <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-muted-foreground">
                  <li>
                    Run <code>pnpm build:extension</code>, then load{' '}
                    <code>apps/extension/dist</code> at{' '}
                    <code>chrome://extensions</code> with Developer mode on and
                    “Load unpacked”.
                  </li>
                  <li>
                    Open {brand.extensionName} → Settings. Set the API URL to{' '}
                    <code>{api.url}</code> and paste your{' '}
                    <code>DEV_EXTENSION_TOKEN</code>. Choose{' '}
                    <strong>Save &amp; test</strong>.
                  </li>
                  <li>
                    Sign in to Classroom, choose <strong>Sync Classroom</strong>
                    , then{' '}
                    <Link
                      href="/dashboard"
                      className="text-primary underline underline-offset-4"
                    >
                      open your workspace
                    </Link>
                    .
                  </li>
                </ol>
              </details>
            </CardContent>
          </Card>
          <Card id="connection" className="scroll-mt-6">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">
                  Workspace connection
                </CardTitle>
                <Badge variant={connected ? 'success' : 'warning'}>
                  {connected ? 'Connected' : 'Setup needed'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                {connected
                  ? 'Your workspace can reach the sync service.'
                  : 'Connect the sync service to start seeing your coursework.'}
              </p>
              {status.ok ? (
                <div className="flex flex-wrap gap-5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <PanelsTopLeft className="h-4 w-4" aria-hidden="true" />{' '}
                    {status.data.totals.classes} classes
                  </span>
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />{' '}
                    {status.data.totals.assignments} assignments stored
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Coursework totals are unavailable until the connection is
                  ready.
                </p>
              )}
              <details className="border-t pt-4">
                <summary className="min-h-9 text-xs text-muted-foreground">
                  Developer connection details
                </summary>
                <div className="mt-3 space-y-2 break-words text-xs text-muted-foreground">
                  <p>API: {api.url}</p>
                  {me.ok ? (
                    <p>
                      Signed in as {me.data.email} ({me.data.authMode} mode).
                    </p>
                  ) : (
                    <p>{me.message}</p>
                  )}
                  {!status.ok ? <p>{status.message}</p> : null}
                </div>
              </details>
            </CardContent>
          </Card>
        </div>
        <AssistantCard />
      </div>
    </div>
  );
}
