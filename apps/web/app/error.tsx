'use client';
import { brand } from '@classpilot/shared';
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="rounded-2xl border bg-card p-8">
      <h1 className="text-2xl font-semibold">Your workspace could not load.</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Try opening {brand.shortName} again. If this continues, check the
        connection on the setup page.
      </p>
      <button type="button" onClick={reset} className="action-link mt-6">
        Try again
      </button>
    </section>
  );
}
