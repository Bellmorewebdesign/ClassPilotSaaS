import { cookies } from 'next/headers';
import { api } from '@/lib/api';

/**
 * Development-mode browser session.
 *
 * WHAT THIS IS
 * The API's only authentication today is a single bearer token held
 * server-side (AUTH_MODE=dev). The browser has never had a session at all.
 * This adds one, honestly:
 *
 *   1. Sign-in calls the REAL API (`GET /api/v1/me`) with the server-side
 *      token. If the API rejects it or is unreachable, sign-in fails with
 *      that reason. Nothing is faked.
 *   2. On success we set an httpOnly cookie marking this browser as signed
 *      in, and middleware gates the workspace routes on it.
 *
 * WHAT THIS IS NOT
 * This is NOT production authentication and does not pretend to be. There is
 * one user, there is no password, and the cookie asserts "this browser
 * completed the dev sign-in step" - not "this is user X". The API token never
 * reaches the browser.
 *
 * WHY IT IS STILL WORTH HAVING
 * It gives the product a real signed-in/signed-out boundary to build on, and
 * when real per-user auth arrives it replaces the body of `signIn()` and the
 * cookie payload - not the routing, not the middleware, not the UI.
 */

export const SESSION_COOKIE = 'coursen_dev_session';

/** Dev sessions are short-lived on purpose; this is not a remember-me. */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export type SignInResult =
  | { ok: true; email: string }
  | { ok: false; reason: string };

/**
 * Verify against the live API, then mark the browser as signed in.
 * Returns the failure reason rather than throwing, so the form can show it.
 */
export async function signIn(): Promise<SignInResult> {
  const me = await api.me();

  if (!me.ok) {
    return { ok: false, reason: me.message };
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, me.data.email, {
    httpOnly: true,
    sameSite: 'lax',
    // Secure in production; a plain-HTTP localhost dev server could not read
    // it back otherwise.
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return { ok: true, email: me.data.email };
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** The signed-in identity, or null. Read by the workspace layout. */
export async function currentSession(): Promise<{ email: string } | null> {
  const store = await cookies();
  const email = store.get(SESSION_COOKIE)?.value;
  return email ? { email } : null;
}
