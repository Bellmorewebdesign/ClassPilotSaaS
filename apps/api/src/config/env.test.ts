import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

/**
 * Configuration validation.
 *
 * A misconfigured deploy must fail at boot with a readable message, not on
 * the first request. These tests pin that behaviour.
 */

const minimal = {
  MONGODB_URI: 'mongodb+srv://user:pass@cluster.example/classpilot',
  DEV_EXTENSION_TOKEN: 'a'.repeat(64),
} as NodeJS.ProcessEnv;

describe('loadEnv', () => {
  it('applies sensible development defaults', () => {
    const env = loadEnv(minimal);
    expect(env.NODE_ENV).toBe('development');
    expect(env.API_PORT).toBe(4000);
    expect(env.API_HOST).toBe('127.0.0.1');
    expect(env.AUTH_MODE).toBe('dev');
    expect(env.MONGODB_DB_NAME).toBe('classpilot');
  });

  it('requires MONGODB_URI — the API has no local-disk fallback', () => {
    expect(() => loadEnv({ DEV_EXTENSION_TOKEN: 'a'.repeat(64) } as NodeJS.ProcessEnv)).toThrow(
      /MONGODB_URI/,
    );
  });

  it('requires a dev token in dev mode, and says how to make one', () => {
    expect(() =>
      loadEnv({ MONGODB_URI: 'mongodb://localhost/x' } as NodeJS.ProcessEnv),
    ).toThrow(/openssl rand -hex 32/);
  });

  it('rejects a short dev token', () => {
    expect(() => loadEnv({ ...minimal, DEV_EXTENSION_TOKEN: 'short' })).toThrow(
      /DEV_EXTENSION_TOKEN/,
    );
  });

  it('refuses AUTH_MODE=production, because V1 has no real auth yet', () => {
    expect(() => loadEnv({ ...minimal, AUTH_MODE: 'production' })).toThrow(
      /reserved for real SaaS auth/,
    );
  });

  it('parses CORS_ORIGINS into a trimmed list', () => {
    const env = loadEnv({
      ...minimal,
      CORS_ORIGINS: 'http://localhost:3000, https://app.classpilot.example ,',
    });
    expect(env.CORS_ORIGINS).toEqual([
      'http://localhost:3000',
      'https://app.classpilot.example',
    ]);
  });

  it('defaults CORS_ORIGINS to the local web app', () => {
    expect(loadEnv(minimal).CORS_ORIGINS).toEqual(['http://localhost:3000']);
  });

  it('reads boolean-ish flags the way a human writes them in a .env file', () => {
    expect(loadEnv({ ...minimal, SCRAPER_DEBUG: 'true' }).SCRAPER_DEBUG).toBe(true);
    expect(loadEnv({ ...minimal, SCRAPER_DEBUG: '1' }).SCRAPER_DEBUG).toBe(true);
    expect(loadEnv({ ...minimal, SCRAPER_DEBUG: 'yes' }).SCRAPER_DEBUG).toBe(true);
    expect(loadEnv({ ...minimal, SCRAPER_DEBUG: 'false' }).SCRAPER_DEBUG).toBe(false);
    expect(loadEnv({ ...minimal, SCRAPER_DEBUG: '' }).SCRAPER_DEBUG).toBe(false);
  });

  it('coerces numeric settings from strings', () => {
    const env = loadEnv({ ...minimal, API_PORT: '8080', RATE_LIMIT_MAX: '50' });
    expect(env.API_PORT).toBe(8080);
    expect(env.RATE_LIMIT_MAX).toBe(50);
  });

  it('rejects an out-of-range port', () => {
    expect(() => loadEnv({ ...minimal, API_PORT: '99999' })).toThrow(/API_PORT/);
  });

  it('warns that a production container bound to loopback is unreachable', () => {
    expect(() =>
      loadEnv({ ...minimal, NODE_ENV: 'production', API_HOST: '127.0.0.1' }),
    ).toThrow(/API_HOST=0\.0\.0\.0/);
  });

  it('reports every problem at once rather than one at a time', () => {
    let message = '';
    try {
      loadEnv({ API_PORT: 'not-a-number' } as NodeJS.ProcessEnv);
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }
    expect(message).toMatch(/MONGODB_URI/);
    expect(message).toMatch(/API_PORT/);
  });
});
