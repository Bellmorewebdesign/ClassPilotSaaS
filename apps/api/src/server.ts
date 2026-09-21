import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import type { Logger } from 'pino';
import { ZodError } from 'zod';
import type { ApiErrorDto } from '@classpilot/shared';
import type { AppEnv } from './config/env.js';
import { isDatabaseConnected } from './db/connect.js';
import { ApiError } from './lib/errors.js';
import { registerAssignmentRoutes } from './routes/assignments.js';
import { registerClassRoutes } from './routes/classes.js';
import { registerDevRoutes } from './routes/dev.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerMeRoutes } from './routes/me.js';
import { registerSyncRoutes } from './routes/sync.js';

/**
 * Builds the Fastify app.
 *
 * Kept separate from index.ts so tests can spin up a real server against an
 * in-memory MongoDB without touching process lifecycle or port binding.
 *
 * The service is stateless: nothing here writes to local disk or holds
 * per-user state in memory, which is what keeps a move to AWS uneventful.
 */
export async function buildServer(
  env: AppEnv,
  logger: Logger,
): Promise<FastifyInstance> {
  const app = Fastify({
    // Typed as FastifyBaseLogger so the instance keeps Fastify's default
    // generics; pino's Logger satisfies that interface at runtime, and
    // binding it structurally would force every route module to become
    // generic over the logger type for no benefit.
    loggerInstance: logger as FastifyBaseLogger,
    bodyLimit: env.MAX_BODY_BYTES,
    // Trust the proxy when running behind Cloudflare Tunnel / a load balancer,
    // so rate limiting sees the real client IP instead of the proxy's.
    trustProxy: true,
    disableRequestLogging: false,
  });

  // --- Security headers --------------------------------------------------
  // The API serves JSON only, so a restrictive CSP costs nothing.
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
  });

  // --- CORS --------------------------------------------------------------
  // Explicit allow-list. The extension's origin is chrome-extension://<id>,
  // which is not knowable until the extension is loaded, so it is matched by
  // scheme rather than by exact value — gated behind ALLOW_EXTENSION_ORIGINS.
  await app.register(cors, {
    origin(origin, callback) {
      // Same-origin / curl / server-to-server requests send no Origin header.
      if (!origin) return callback(null, true);

      if (env.CORS_ORIGINS.includes(origin)) return callback(null, true);

      if (env.ALLOW_EXTENSION_ORIGINS && origin.startsWith('chrome-extension://')) {
        return callback(null, true);
      }

      logger.warn({ event: 'cors.rejected', origin }, 'rejected cross-origin request');
      return callback(null, false);
    },
    credentials: false,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });

  // --- Rate limiting -----------------------------------------------------
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    // Rate limit per token when one is present, per IP otherwise. Hashing
    // keeps the raw token out of the limiter's key store.
    keyGenerator(request) {
      const auth = request.headers.authorization;
      if (typeof auth === 'string' && auth.length > 0) {
        return `tok:${simpleKeyHash(auth)}`;
      }
      return request.ip;
    },
    // /health must stay probe-able even while a client is being throttled.
    // Compared on the path alone so "/health?x=1" cannot slip past the check
    // in either direction.
    allowList: (request) => request.url.split('?')[0] === '/health',
  });

  // --- Uniform error envelope -------------------------------------------
  app.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof ApiError) {
      // Expected, client-visible failures: log at warn without a stack.
      request.log.warn(
        { event: 'request.rejected', code: error.code, statusCode: error.statusCode },
        error.message,
      );
      return reply.status(error.statusCode).send(error.toResponse());
    }

    if (error instanceof ZodError) {
      const body: ApiErrorDto = {
        error: {
          code: 'bad_request',
          message: 'Invalid request.',
          details: error.issues.map((issue) => ({
            path: issue.path.join('.') || '(root)',
            message: issue.message,
          })),
        },
      };
      return reply.status(400).send(body);
    }

    // Fastify's own client errors (bad JSON, body too large, rate limit)
    // arrive as plain objects carrying statusCode/code, so they are read
    // defensively rather than assumed to be Error instances.
    const framework = error as { statusCode?: number; code?: string; message?: string; stack?: string };
    const statusCode = framework.statusCode ?? 500;
    if (statusCode >= 400 && statusCode < 500) {
      const body: ApiErrorDto = {
        error: {
          code: framework.code ?? 'bad_request',
          message: framework.message ?? 'Invalid request.',
        },
      };
      return reply.status(statusCode).send(body);
    }

    // Anything else is a bug. Log it fully; tell the client nothing.
    request.log.error(
      {
        event: 'request.failed',
        err: framework.message ?? String(error),
        stack: framework.stack,
      },
      'unhandled error',
    );
    const body: ApiErrorDto = {
      error: { code: 'internal_error', message: 'Something went wrong.' },
    };
    return reply.status(500).send(body);
  });

  app.setNotFoundHandler((request, reply) => {
    const body: ApiErrorDto = {
      error: { code: 'not_found', message: `No route for ${request.method} ${request.url}` },
    };
    return reply.status(404).send(body);
  });

  // --- Database readiness guard -----------------------------------------
  // Mongo is configured with bufferCommands=false, so a query against a dead
  // connection would surface as an opaque driver error. This turns that into
  // an honest 503 the extension can show as "ClassPilot is unavailable".
  //
  // Deliberately a preHandler rather than an onRequest hook: by this point
  // Fastify has already routed and parsed the body, so an unknown path still
  // gets a 404 and malformed JSON still gets a 400. Only requests that would
  // actually touch the database are turned into a 503. It also runs before
  // the per-route requireAuth hook, which itself needs the database.
  app.addHook('preHandler', async (request) => {
    // Root-level preHandler hooks also run on the not-found path, so an
    // unmatched URL must fall through to the 404 handler rather than be
    // reported as a database outage.
    const matchedRoute = request.routeOptions?.url;
    if (!matchedRoute || matchedRoute === '/health') return;
    if (!isDatabaseConnected()) {
      throw ApiError.serviceUnavailable(
        'The ClassPilot database is unavailable. Please try again shortly.',
      );
    }
  });

  // --- Routes ------------------------------------------------------------
  await registerHealthRoutes(app);
  await registerMeRoutes(app);
  await registerClassRoutes(app);
  await registerAssignmentRoutes(app);
  await registerSyncRoutes(app, env);
  await registerDevRoutes(app, env);

  return app;
}

/**
 * Non-cryptographic hash used only to key the rate limiter, so the raw
 * Authorization header is never stored in the limiter's map.
 */
function simpleKeyHash(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}
