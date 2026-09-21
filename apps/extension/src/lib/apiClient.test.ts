import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiClientError } from './apiClient.js';

/**
 * Failure-mode mapping.
 *
 * The acceptance criteria require that "basic failures produce understandable
 * messages instead of crashing". These tests pin each HTTP failure to the
 * sentence the popup will show.
 */

const settings = { apiUrl: 'http://localhost:4000', apiToken: 'test-token-value' };

function mockFetch(response: Partial<Response> & { jsonBody?: unknown }): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: response.ok ?? false,
      status: response.status ?? 200,
      json: async () => response.jsonBody ?? {},
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ApiClient error mapping', () => {
  it('refuses to send a request with no token configured', async () => {
    const client = new ApiClient({ ...settings, apiToken: '' });
    await expect(client.whoAmI()).rejects.toMatchObject({ kind: 'unconfigured' });
  });

  it('maps 401 to a "check your token" message', async () => {
    mockFetch({ ok: false, status: 401 });
    await expect(new ApiClient(settings).whoAmI()).rejects.toMatchObject({
      kind: 'unauthorized',
    });
  });

  it('maps 429 to a rate-limit message', async () => {
    mockFetch({ ok: false, status: 429 });
    await expect(new ApiClient(settings).whoAmI()).rejects.toMatchObject({
      kind: 'rate_limited',
    });
  });

  it('maps 503 to unreachable, since the database being down is transient', async () => {
    mockFetch({
      ok: false,
      status: 503,
      jsonBody: { error: { code: 'service_unavailable', message: 'db down' } },
    });
    await expect(new ApiClient(settings).whoAmI()).rejects.toMatchObject({
      kind: 'unreachable',
    });
  });

  it('maps 500 to a server error', async () => {
    mockFetch({ ok: false, status: 500, jsonBody: { error: { message: 'boom' } } });
    await expect(new ApiClient(settings).whoAmI()).rejects.toMatchObject({
      kind: 'server_error',
    });
  });

  it('surfaces the field that failed validation on a 400', async () => {
    mockFetch({
      ok: false,
      status: 400,
      jsonBody: {
        error: {
          message: 'Invalid sync payload.',
          details: [{ path: 'assignments.0.title', message: 'Required' }],
        },
      },
    });

    await expect(new ApiClient(settings).whoAmI()).rejects.toMatchObject({
      kind: 'bad_request',
      message: 'Invalid sync payload. (assignments.0.title: Required)',
    });
  });

  it('maps a network failure to unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    await expect(new ApiClient(settings).whoAmI()).rejects.toMatchObject({
      kind: 'unreachable',
    });
  });

  it('returns the parsed body on success', async () => {
    mockFetch({
      ok: true,
      status: 200,
      jsonBody: { id: '1', email: 'dev@classpilot.local', displayName: null, authMode: 'dev' },
    });
    await expect(new ApiClient(settings).whoAmI()).resolves.toMatchObject({
      email: 'dev@classpilot.local',
    });
  });

  it('sends the token as a Bearer header and nowhere else', async () => {
    const spy = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    vi.stubGlobal('fetch', spy);

    await new ApiClient(settings).whoAmI();

    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/api/v1/me');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-token-value',
    );
    // A GET must not carry a body, and the token must not be in the URL.
    expect(init.body).toBeUndefined();
    expect(url).not.toContain('test-token-value');
  });
});

describe('ApiClientError.userMessage', () => {
  it('gives every failure kind a sentence a student can act on', () => {
    const kinds = [
      'unconfigured',
      'unauthorized',
      'unreachable',
      'rate_limited',
      'server_error',
      'bad_request',
    ] as const;

    for (const kind of kinds) {
      const message = new ApiClientError(kind, 'detail').userMessage;
      expect(message.length).toBeGreaterThan(10);
      expect(message).not.toContain('undefined');
    }
  });
});
