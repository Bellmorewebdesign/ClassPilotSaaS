'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { brand } from '@classpilot/shared';
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

      <div className="rounded-xl border border-depth-line bg-white/[0.03] p-4">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-depth-ink">
          <ShieldCheck
            className="h-4 w-4 shrink-0 text-depth-glow"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          Development workspace
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-depth-muted">
          This build runs in development mode with a single workspace.
          Continuing verifies the connection to your {brand.shortName} API and
          opens it.
        </p>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-[var(--brand-errorSurface)] p-3.5 text-[13px] leading-relaxed text-destructive"
        >
          <TriangleAlert
            className="mt-px h-4 w-4 shrink-0"
            strokeWidth={2}
            aria-hidden="true"
          />
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
      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-depth-ink px-4 text-[15px] font-semibold text-depth-base shadow-low transition-[transform,box-shadow,opacity] duration-fast ease-out hover:-translate-y-px hover:shadow-mid active:translate-y-0 disabled:translate-y-0 disabled:opacity-70"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Checking connection&hellip;
        </>
      ) : (
        'Continue to workspace'
      )}
    </button>
  );
}
