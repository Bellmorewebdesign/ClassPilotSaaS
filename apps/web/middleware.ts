import { NextResponse, type NextRequest } from 'next/server';

/**
 * Route gating.
 *
 * The workspace is only reachable once the browser has completed the
 * development sign-in (see lib/session.ts). Everything else - the marketing
 * site, the auth screens - stays public.
 *
 * Middleware runs on the Edge runtime, so it only reads the cookie's
 * presence. Anything that needs the API lives in lib/session.ts on the Node
 * runtime.
 */

const SESSION_COOKIE = 'coursen_dev_session';

/** Prefixes that require a session. */
const PROTECTED = ['/dashboard', '/classes', '/assignments', '/integrations', '/welcome'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const needsSession = PROTECTED.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!needsSession) return NextResponse.next();

  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  // Send them to sign-in, remembering where they were headed so the sign-in
  // can return them there.
  const signIn = new URL('/signin', request.url);
  signIn.searchParams.set('next', pathname);
  return NextResponse.redirect(signIn);
}

export const config = {
  // Everything except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/|robots.txt).*)'],
};
