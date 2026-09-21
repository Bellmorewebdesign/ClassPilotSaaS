import { brand } from '@classpilot/shared';
import type {
  MeDto,
  SyncClassroomBatchRequest,
  SyncResultDto,
} from '@classpilot/shared';
import type { Settings } from './settings.js';

/**
 * The extension's HTTP client for the ClassPilot API.
 *
 * Every failure mode the acceptance criteria call out is turned into a typed
 * error with a message the popup can show verbatim: the API being unreachable,
 * a 401, a 429, a 5xx. The sync engine decides what to do; this layer never
 * swallows a problem silently.
 *
 * The token is attached here and nowhere else, and is never logged.
 */

export type ApiErrorKind =
  | 'unconfigured'
  | 'unauthorized'
  | 'unreachable'
  | 'rate_limited'
  | 'server_error'
  | 'bad_request';

export class ApiClientError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly statusCode: number | null = null,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }

  /** A sentence safe to show directly in the popup. */
  get userMessage(): string {
    switch (this.kind) {
      case 'unconfigured':
        return `${brand.shortName} is not connected yet. Open Settings and paste your API token.`;
      case 'unauthorized':
        return `${brand.shortName} rejected this token. Check the token in Settings.`;
      case 'unreachable':
        return `Could not reach ${brand.shortName}. Is the API running at the configured URL?`;
      case 'rate_limited':
        return `${brand.shortName} is rate limiting this client. Wait a moment and try again.`;
      case 'server_error':
        return `${brand.shortName} had a server error. Check the API logs.`;
      case 'bad_request':
        return `${brand.shortName} rejected the data: ${this.message}`;
    }
  }
}

const REQUEST_TIMEOUT_MS = 30_000;

export class ApiClient {
  constructor(private readonly settings: Settings) {}

  get apiUrl(): string {
    return this.settings.apiUrl;
  }

  /** Verify the token. Cheap, and gives a clear error before a long sync. */
  async whoAmI(): Promise<MeDto> {
    return this.request<MeDto>('GET', '/api/v1/me');
  }

  /** Upload one batch of a sync. */
  async postSyncBatch(payload: SyncClassroomBatchRequest): Promise<SyncResultDto> {
    return this.request<SyncResultDto>('POST', '/api/v1/sync/classroom/batch', payload);
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    if (this.settings.apiToken === '') {
      throw new ApiClientError('unconfigured', 'No API token configured.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${this.settings.apiUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.settings.apiToken}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      // Network failure, DNS failure, CORS rejection, or our own timeout.
      const detail =
        error instanceof Error && error.name === 'AbortError'
          ? 'the request timed out'
          : 'the request could not be sent';
      throw new ApiClientError('unreachable', detail);
    } finally {
      clearTimeout(timeout);
    }

    if (response.ok) {
      return (await response.json()) as T;
    }

    if (response.status === 401 || response.status === 403) {
      throw new ApiClientError('unauthorized', 'Token rejected.', response.status);
    }
    if (response.status === 429) {
      throw new ApiClientError('rate_limited', 'Too many requests.', 429);
    }
    if (response.status >= 500) {
      throw new ApiClientError(
        response.status === 503 ? 'unreachable' : 'server_error',
        await readErrorMessage(response),
        response.status,
      );
    }

    throw new ApiClientError(
      'bad_request',
      await readErrorMessage(response),
      response.status,
    );
  }
}

/** Pull the message out of the API's error envelope, defensively. */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string; details?: Array<{ path: string; message: string }> };
    };
    const message = body.error?.message ?? `HTTP ${response.status}`;
    const firstDetail = body.error?.details?.[0];
    return firstDetail ? `${message} (${firstDetail.path}: ${firstDetail.message})` : message;
  } catch {
    return `HTTP ${response.status}`;
  }
}
