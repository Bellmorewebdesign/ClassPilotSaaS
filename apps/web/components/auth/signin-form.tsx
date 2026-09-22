'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { brand } from '@classpilot/shared';
import { CoursenIcon } from '@/components/coursen-icon';
import { signInAction, type SignInState } from '@/app/(auth)/actions';

/**
 * Development sign-in.
 *
 * This form does something real: submitting it calls the API's `/api/v1/me`
 * with the server-side token and only grants a session if the API answers.
 * A stopped API or a mismatched token produces the actual error here, rather
 * than an empty workspace two clicks later.
 *
 * It is not production authentication and says so on screen. There is no
 * password field because there is no password - inventing one would be
 * theatre.
 */
export function SignInForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<SignInState, FormData>(
    signInAction,
    { error: null },
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <div className="rounded-lg bg-secondary p-4">
        <p className="flex items-center gap-2 text-label text-foreground">
          <CoursenIcon name="settings" className="h-4 w-4 shrink-0 text-primary" />
          Development workspace
        </p>
        <p className="mt-2 text-small-body text-muted-foreground">
          This build runs one workspace in development mode. Continuing checks
          the connection to your {brand.shortName} API and opens it.
        </p>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-error-surface p-3.5 text-small-body text-error-text"
        >
          <CoursenIcon name="attention" className="mt-0.5 h-4 w-4 shrink-0" />
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="action-link w-full disabled:cursor-wait disabled:opacity-80"
    >
      {pending ? (
        <>
          {/* The kit's activity language: a moving highlight, not a spinner. */}
          <span className="flex h-4 w-4 items-center justify-center" aria-hidden="true">
            <svg viewBox="0 0 64 64" className="h-4 w-4">
              <path
                d="M44.73 44.73 A18 18 0 1 1 44.73 19.27"
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.35"
                strokeWidth="9"
                strokeLinecap="round"
              />
              <path
                d="M44.73 44.73 A18 18 0 1 1 44.73 19.27"
                fill="none"
                stroke="currentColor"
                strokeWidth="9"
                strokeLinecap="round"
                pathLength={100}
                className="activity-sweep"
              />
            </svg>
          </span>
          Checking connection
        </>
      ) : (
        'Continue'
      )}
    </button>
  );
}
