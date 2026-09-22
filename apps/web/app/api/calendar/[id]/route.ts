import { NextResponse } from 'next/server';
import { currentSession } from '@/lib/session';

/**
 * Update or delete one calendar event.
 *
 * Same contract as the create handler: the session is checked here, the API
 * token stays on the server, and validation belongs to the API.
 *
 * Ownership is NOT checked here either, and deliberately so. The API filters
 * every write on the authenticated user, so a guessed id matches no row. A
 * second check in this layer would be a second place to get it wrong.
 */

const API_URL = process.env.CLASSPILOT_API_URL ?? 'http://localhost:4000';
const API_TOKEN = process.env.CLASSPILOT_API_TOKEN ?? '';

async function forward(
  id: string,
  init: { method: string; body?: string },
): Promise<Response> {
  const session = await currentSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const response = await fetch(
    `${API_URL}/api/v1/calendar/events/${encodeURIComponent(id)}`,
    {
      method: init.method,
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(init.body === undefined ? {} : { body: init.body }),
      cache: 'no-store',
    },
  ).catch(() => null);

  if (!response) {
    return NextResponse.json({ error: 'unreachable' }, { status: 503 });
  }
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  return forward(id, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return forward(id, { method: 'DELETE' });
}
