import Link from 'next/link';
import type { Metadata } from 'next';
import { brand } from '@classpilot/shared';
import { CoursenIcon } from '@/components/coursen-icon';
import { AuthCard, GoogleButtonPreview } from '@/components/auth/auth-card';

export const metadata: Metadata = { title: 'Get started' };

/**
 * Sign-up.
 *
 * Presentational on purpose. Account creation does not exist in this build,
 * so nothing here pretends to create one: the Google button is disabled, the
 * email field is disabled, and the only working path is the development
 * sign-in, which is offered honestly at the bottom.
 */
const INCLUDED = [
  'Google Classroom sync',
  'Assignments, due dates and status in one view',
  'Your workspace stays private to you',
] as const;

export default function SignUpPage() {
  return (
    <AuthCard
      title="Get started."
      lede={`Account creation opens when ${brand.shortName} leaves early preview.`}
      footer={
        <>
          Already set up?{' '}
          <Link
            href="/signin"
            className="font-semibold text-primary underline underline-offset-4"
          >
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <ul className="space-y-2.5">
          {INCLUDED.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2.5 text-small-body text-muted-foreground"
            >
              <CoursenIcon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              {item}
            </li>
          ))}
        </ul>

        <GoogleButtonPreview label="Sign up with Google" />

        <div>
          <label
            htmlFor="signup-email"
            className="mb-1.5 block text-label text-foreground"
          >
            Or sign up with email
          </label>
          <input
            id="signup-email"
            type="email"
            disabled
            placeholder="you@school.edu"
            aria-describedby="signup-email-note"
            className="min-h-12 w-full cursor-not-allowed rounded-md border border-border bg-disabled-fill px-4 text-body text-disabled placeholder:text-disabled/70"
          />
          <p id="signup-email-note" className="mt-2 text-metadata text-muted-foreground">
            Email sign-up is not available in this build.
          </p>
        </div>

        <div className="rounded-lg bg-secondary p-4">
          <p className="text-label text-foreground">
            Running {brand.shortName} locally?
          </p>
          <p className="mt-1.5 text-small-body text-muted-foreground">
            Development mode opens the workspace without an account.
          </p>
          <Link
            href="/signin"
            className="mt-3 inline-flex min-h-11 items-center text-label text-primary underline underline-offset-4"
          >
            Open the development workspace &rarr;
          </Link>
        </div>
      </div>
    </AuthCard>
  );
}
