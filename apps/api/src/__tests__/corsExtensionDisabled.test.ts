import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { loadEnv, type AppEnv } from '../config/env.js';
import { buildServer } from '../server.js';
import { silentLogger } from './helpers/mongo.js';

/**
 * ALLOW_EXTENSION_ORIGINS is the switch that lets a deployment lock the API
 * down to the web app only. This suite proves the switch actually works —
 * a security control that is never tested is a security control you do not
 * have.
 */

const env: AppEnv = loadEnv({
  MONGODB_URI: 'mongodb://localhost:27017/classpilot-unused',
  DEV_EXTENSION_TOKEN: 'a'.repeat(64),
  ALLOW_EXTENSION_ORIGINS: 'false',
} as NodeJS.ProcessEnv);

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildServer(env, silentLogger());
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

it('refuses chrome-extension origins when the flag is off', async () => {
  const response = await app.inject({
    method: 'OPTIONS',
    url: '/api/v1/classes',
    headers: {
      origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop',
      'access-control-request-method': 'POST',
    },
  });
  expect(response.headers['access-control-allow-origin']).toBeUndefined();
});

describe('config', () => {
  it('parsed the flag as false', () => {
    expect(env.ALLOW_EXTENSION_ORIGINS).toBe(false);
  });
});
