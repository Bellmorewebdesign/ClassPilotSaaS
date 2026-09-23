import { NextResponse } from 'next/server';
import { currentSession } from '@/lib/session';

/**
 * Create a calendar event.
 *
 * The browser cannot call the ClassPilot API directly: the API token lives in
 * the server environment and must never reach client JavaScript. This handler
 * is the only bridge, and it checks the session before forwarding anything.
 *
 * It deliberately does NOT validate the body. The API owns validation, and
 * duplicating a Zod schema here would give two places for the rules to drift.
 * What this layer owns is authentication and not leaking the token.
 */

const API_URL = process.env.CLASSPILOT_API_URL ?? 'http://localhost:4000';
const API_TOKEN = process.env.CLASSPILOT_API_TOKEN ?? '';

export async function POST(request: Request): Promise<Response> {
  const session = await currentSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const response = await fetch(`${API_URL}/api/v1/calendar/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  }).catch(() => null);

  if (!response) {
    return NextResponse.json({ error: 'unreachable' }, { status: 503 });
  }
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
