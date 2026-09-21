import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { loadEnv, type AppEnv } from '../config/env.js';
import { buildServer } from '../server.js';
import { silentLogger } from './helpers/mongo.js';

/**
 * Server behaviour that does NOT depend on a database.
 *
 * These tests deliberately run with MongoDB disconnected, which is exactly
 * the failure mode the acceptance criteria call out: "MongoDB unavailable"
 * must produce an understandable message, not a crash or a hang.
 */

const env: AppEnv = loadEnv({
  MONGODB_URI: 'mongodb://localhost:27017/classpilot-unused',
  DEV_EXTENSION_TOKEN: 'a'.repeat(64),
  CORS_ORIGINS: 'http://localhost:3000',
} as NodeJS.ProcessEnv);

let app: FastifyInstance;

beforeAll(async () => {
  // silentLogger satisfies the structural logging surface Fastify needs here.
  app = await buildServer(env, silentLogger());
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('GET /health', () => {
  it('is reachable without a token', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect([200, 503]).toContain(response.statusCode);
    expect(response.json()).toMatchObject({
      database: { connected: expect.any(Boolean) },
      uptimeSeconds: expect.any(Number),
    });
  });

  it('reports degraded while the database is unreachable', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(503);
    expect(response.json().status).toBe('degraded');
    expect(response.json().database.connected).toBe(false);
  });
});

describe('database readiness guard', () => {
  it('turns an unreachable database into an honest 503, not a hang', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/classes',
      headers: { authorization: 'Bearer anything' },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: {
        code: 'service_unavailable',
        message: expect.stringContaining('database is unavailable'),
      },
    });
  });

  it('applies to sync endpoints too', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/sync/classroom',
      headers: { authorization: 'Bearer anything' },
      payload: { syncId: 'abcdefgh' },
    });
    expect(response.statusCode).toBe(503);
  });
});

describe('error envelope', () => {
  it('returns the standard shape for an unknown route', async () => {
    const response = await app.inject({ method: 'GET', url: '/does-not-exist' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: 'not_found', message: expect.stringContaining('/does-not-exist') },
    });
  });

  it('returns a 400 envelope for malformed JSON', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/sync/classroom',
      headers: { 'content-type': 'application/json', authorization: 'Bearer x' },
      payload: '{ not json',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatchObject({ message: expect.any(String) });
  });
});

describe('CORS', () => {
  it('allows the configured web app origin', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/classes',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'GET',
      },
    });
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('allows chrome-extension origins when ALLOW_EXTENSION_ORIGINS is on', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/classes',
      headers: {
        origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop',
        'access-control-request-method': 'POST',
      },
    });
    expect(response.headers['access-control-allow-origin']).toBe(
      'chrome-extension://abcdefghijklmnopabcdefghijklmnop',
    );
  });

  it('does not echo an unknown origin back', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/classes',
      headers: {
        origin: 'https://evil.example',
        'access-control-request-method': 'GET',
      },
    });
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('security headers', () => {
  it('sets a restrictive CSP and denies framing', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
});
