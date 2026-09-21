'use server';

import { redirect } from 'next/navigation';
import { signIn, signOut } from '@/lib/session';

/**
 * Server actions for the auth screens.
 *
 * Sign-in genuinely verifies against the API before granting a session, so a
 * misconfigured token or a stopped API surfaces as a real error on the form
 * rather than a broken workspace two clicks later.
 */

export type SignInState = { error: string | null };

export async function signInAction(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const result = await signIn();

  if (!result.ok) {
    return { error: result.reason };
  }

  // Only accept a same-site relative path, so `?next=` cannot be used as an
  // open redirect to another origin.
  const requested = formData.get('next');
  const next =
    typeof requested === 'string' &&
    requested.startsWith('/') &&
    !requested.startsWith('//')
      ? requested
      : '/dashboard';

  redirect(`/welcome?next=${encodeURIComponent(next)}`);
}

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect('/');
}
