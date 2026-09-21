import { z } from 'zod';

/**
 * Environment configuration.
 *
 * Every knob the API has lives here and is validated at boot. If the process
 * starts, the configuration is known-good — no route ever has to defend
 * against a missing or malformed env var.
 *
 * There are no secrets in this file, and no defaults that would silently
 * weaken security in production.
 */

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((value) =>
    typeof value === 'boolean'
      ? value
      : ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase()),
  );

/** Comma-separated list -> string[]. The default is applied to the raw
 * string before the transform, so the parsed result is always an array. */
function csvWithDefault(defaultValue: string) {
  return z
    .string()
    .default(defaultValue)
    .transform((value) =>
      value
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part !== ''),
    );
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    /** Bind address. 0.0.0.0 inside Docker, 127.0.0.1 for a bare local run. */
    API_HOST: z.string().min(1).default('127.0.0.1'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),

    /** MongoDB Atlas (or any Mongo) connection string. Never hardcoded. */
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
    MONGODB_DB_NAME: z.string().min(1).default('classpilot'),

    /**
     * V1 authentication mode.
     *   dev        - a single development user resolved from a static token
     *   production - reserved; refuses to boot until real auth is implemented
     */
    AUTH_MODE: z.enum(['dev', 'production']).default('dev'),

    /**
     * The extension's bearer token in dev mode. Generate with:
     *   openssl rand -hex 32
     * Only its SHA-256 hash is ever stored or logged.
     */
    DEV_EXTENSION_TOKEN: z.string().min(16).optional(),
    DEV_USER_EMAIL: z.string().email().default('dev@classpilot.local'),
    DEV_USER_DISPLAY_NAME: z.string().min(1).default('ClassPilot Dev User'),

    /**
     * Comma-separated list of allowed browser origins for the web app.
     * Chrome extensions are handled separately (see ALLOW_EXTENSION_ORIGINS).
     */
    CORS_ORIGINS: csvWithDefault('http://localhost:3000'),

    /**
     * Whether chrome-extension:// origins may call the API.
     * Required for the extension to POST syncs; keep it on in dev.
     */
    ALLOW_EXTENSION_ORIGINS: booleanish.default(true),

    /** Requests per window, per client, across the whole API. */
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
    RATE_LIMIT_WINDOW: z.string().min(2).default('1 minute'),

    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    /** Human-readable logs in a terminal. Off in production (JSON to stdout). */
    LOG_PRETTY: booleanish.default(false),

    /**
     * Scraper debugging. When on, extraction reports from the extension are
     * persisted with each sync run so selector regressions can be diagnosed.
     * Reports contain field NAMES and strategy names only, never schoolwork.
     */
    SCRAPER_DEBUG: booleanish.default(false),

    /** Largest sync request body we will accept, in bytes. */
    MAX_BODY_BYTES: z.coerce.number().int().min(1024).default(4_000_000),
  })
  .superRefine((env, ctx) => {
    if (env.AUTH_MODE === 'dev' && !env.DEV_EXTENSION_TOKEN) {
      ctx.addIssue({
        code: 'custom',
        path: ['DEV_EXTENSION_TOKEN'],
        message:
          'AUTH_MODE=dev requires DEV_EXTENSION_TOKEN. Generate one with: openssl rand -hex 32',
      });
    }
    if (env.AUTH_MODE === 'production') {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_MODE'],
        message:
          'AUTH_MODE=production is reserved for real SaaS auth, which V1 does not implement yet. Use AUTH_MODE=dev.',
      });
    }
    if (env.NODE_ENV === 'production' && env.API_HOST === '127.0.0.1') {
      // Not fatal, but worth surfacing: a container bound to loopback is
      // unreachable from outside the container.
      ctx.addIssue({
        code: 'custom',
        path: ['API_HOST'],
        message:
          'NODE_ENV=production with API_HOST=127.0.0.1 is unreachable from outside the container. Set API_HOST=0.0.0.0.',
      });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

/**
 * Parse and validate process.env.
 * Throws a readable, secret-free error listing every problem at once.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new Error(
      `Invalid ClassPilot API configuration:\n${lines.join('\n')}\n\n` +
        'See .env.example for the full list of variables.',
    );
  }
  return result.data;
}
