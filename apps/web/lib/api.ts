import type {
  AssignmentDto,
  ClassDto,
  MeDto,
  PaginatedDto,
  SyncStatusDto,
} from '@classpilot/shared';

/**
 * Server-side API client.
 *
 * Every page fetches through here, on the server, using the API token from
 * the environment. Three consequences worth stating:
 *
 *   - the token never reaches the browser;
 *   - the dashboard holds no database connection, so `userId` scoping stays
 *     enforced in exactly one place (the API);
 *   - swapping dev-token auth for real per-user sessions means changing this
 *     file and nothing else.
 *
 * A failure here is never allowed to crash a page. Callers get a typed
 * result and render an explanatory empty state instead of a stack trace.
 */

const API_URL = process.env.CLASSPILOT_API_URL ?? 'http://localhost:4000';
const API_TOKEN = process.env.CLASSPILOT_API_TOKEN ?? '';

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: ApiFailure; message: string };

export type ApiFailure = 'unconfigured' | 'unauthorized' | 'unreachable' | 'error';

/** Human sentences for each failure, shown directly in the UI. */
export const FAILURE_MESSAGES: Record<ApiFailure, string> = {
  unconfigured:
    'CLASSPILOT_API_TOKEN is not set. Copy your DEV_EXTENSION_TOKEN from .env into CLASSPILOT_API_TOKEN and restart the web app.',
  unauthorized:
    'The ClassPilot API rejected this token. Check that CLASSPILOT_API_TOKEN matches DEV_EXTENSION_TOKEN.',
  unreachable: `Could not reach the ClassPilot API at ${API_URL}. Is it running?`,
  error: 'The ClassPilot API returned an error. Check the API logs.',
};

async function get<T>(path: string): Promise<ApiResult<T>> {
  if (API_TOKEN === '') {
    return { ok: false, kind: 'unconfigured', message: FAILURE_MESSAGES.unconfigured };
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${API_TOKEN}` },
      // The dashboard must reflect a sync that finished seconds ago, so this
      // data is never cached.
      cache: 'no-store',
    });
  } catch {
    return { ok: false, kind: 'unreachable', message: FAILURE_MESSAGES.unreachable };
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: false, kind: 'unauthorized', message: FAILURE_MESSAGES.unauthorized };
  }
  if (response.status === 404) {
    return { ok: false, kind: 'error', message: 'Not found.' };
  }
  if (!response.ok) {
    const kind: ApiFailure = response.status === 503 ? 'unreachable' : 'error';
    return { ok: false, kind, message: FAILURE_MESSAGES[kind] };
  }

  try {
    return { ok: true, data: (await response.json()) as T };
  } catch {
    return { ok: false, kind: 'error', message: FAILURE_MESSAGES.error };
  }
}

export const api = {
  /** The API base URL, for display only. */
  url: API_URL,
  configured: API_TOKEN !== '',

  me: () => get<MeDto>('/api/v1/me'),

  classes: () => get<PaginatedDto<ClassDto>>('/api/v1/classes?limit=200'),

  classById: (id: string) => get<ClassDto>(`/api/v1/classes/${encodeURIComponent(id)}`),

  assignments: (params: {
    classId?: string;
    dueAfter?: string;
    sort?: 'dueAt' | 'lastSyncedAt' | 'title';
    order?: 'asc' | 'desc';
    limit?: number;
  } = {}) => {
    const query = new URLSearchParams();
    if (params.classId) query.set('classId', params.classId);
    if (params.dueAfter) query.set('dueAfter', params.dueAfter);
    query.set('sort', params.sort ?? 'dueAt');
    query.set('order', params.order ?? 'asc');
    query.set('limit', String(params.limit ?? 200));
    return get<PaginatedDto<AssignmentDto>>(`/api/v1/assignments?${query.toString()}`);
  },

  assignmentById: (id: string) =>
    get<AssignmentDto>(`/api/v1/assignments/${encodeURIComponent(id)}`),

  syncStatus: () => get<SyncStatusDto>('/api/v1/sync/status'),
};
