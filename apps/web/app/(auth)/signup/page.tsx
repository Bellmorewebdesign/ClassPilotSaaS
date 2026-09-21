import Link from 'next/link';
import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import { brand } from '@classpilot/shared';
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
      title={`Get started with ${brand.shortName}`}
      lede="Account creation opens when Coursen leaves early preview."
      footer={
        <>
          Already set up?{' '}
          <Link
            href="/signin"
            className="font-semibold text-depth-ink underline underline-offset-4"
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
              className="flex items-start gap-2.5 text-[13px] leading-relaxed text-depth-muted"
            >
              <Check
                className="mt-0.5 h-4 w-4 shrink-0 text-depth-glow"
                strokeWidth={2.5}
                aria-hidden="true"
              />
              {item}
            </li>
          ))}
        </ul>

        <GoogleButtonPreview label="Sign up with Google" />

        <div>
          <label
            htmlFor="signup-email"
            className="mb-1.5 block text-[12px] font-medium text-depth-muted"
          >
            Or sign up with email
          </label>
          <input
            id="signup-email"
            type="email"
            disabled
            placeholder="you@school.edu"
            aria-describedby="signup-email-note"
            className="min-h-12 w-full cursor-not-allowed rounded-xl border border-depth-line bg-white/[0.02] px-4 text-[14px] text-depth-muted placeholder:text-depth-muted/60"
          />
          <p id="signup-email-note" className="mt-2 text-[12px] text-depth-muted">
            Email sign-up is not available in this build.
          </p>
        </div>

        <div className="rounded-xl border border-depth-line bg-white/[0.03] p-4">
          <p className="text-[13px] font-semibold text-depth-ink">
            Running {brand.shortName} locally?
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-depth-muted">
            Development mode opens the workspace without an account.
          </p>
          <Link
            href="/signin"
            className="mt-3 inline-flex min-h-11 items-center text-[13px] font-semibold text-depth-glow underline underline-offset-4"
          >
            Open the development workspace &rarr;
          </Link>
        </div>
      </div>
    </AuthCard>
  );
}
