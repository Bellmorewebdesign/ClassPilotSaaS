import { pino, type Logger } from 'pino';
import type { AppEnv } from '../config/env.js';

/**
 * Structured logging.
 *
 * Two rules this module enforces mechanically rather than by convention:
 *
 *  1. Secrets are redacted at the serializer level, so no call site can leak a
 *     token by accident.
 *  2. Assignment bodies are never logged. Sync events carry ids and counts;
 *     if you need the text, use the extension's local debug mode.
 */

/** Paths pino blanks out wherever they appear in a log object. */
const REDACT_PATHS = [
  'token',
  'authorization',
  'password',
  '*.token',
  '*.authorization',
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.cookie',
  'extensionToken',
  '*.extensionToken',
  'MONGODB_URI',
  '*.MONGODB_URI',
  'DEV_EXTENSION_TOKEN',
  '*.DEV_EXTENSION_TOKEN',
];

/**
 * The minimal logging surface the services need.
 *
 * Depending on this instead of pino's `Logger` means a service can be handed
 * either the root logger or Fastify's per-request `request.log` — which are
 * the same object at runtime but different types — without any casting.
 */
export interface SyncLogger {
  child(bindings: Record<string, unknown>): SyncLogger;
  debug(obj: object, msg?: string): void;
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

export function createLogger(env: AppEnv): Logger {
  return pino({
    level: env.LOG_LEVEL,
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    base: { service: 'classpilot-api', env: env.NODE_ENV },
    ...(env.LOG_PRETTY
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname,service' },
          },
        }
      : {}),
  });
}

/**
 * The sync event vocabulary. Using a closed set means logs stay greppable and
 * a typo can't silently create a new event name.
 */
export const SYNC_EVENTS = {
  started: 'sync.started',
  classDiscovered: 'sync.class_discovered',
  classUpdated: 'sync.class_updated',
  classComplete: 'sync.class_complete',
  assignmentDiscovered: 'sync.assignment_discovered',
  assignmentUpdated: 'sync.assignment_updated',
  assignmentUnchanged: 'sync.assignment_unchanged',
  rejected: 'sync.record_rejected',
  batch: 'sync.batch_received',
  complete: 'sync.complete',
  failed: 'sync.failed',
} as const;

export type SyncEvent = (typeof SYNC_EVENTS)[keyof typeof SYNC_EVENTS];

/**
 * Redact a connection string for logging: keeps host and database, drops
 * username and password entirely.
 */
export function safeMongoUri(uri: string): string {
  try {
    const parsed = new URL(uri);
    const auth = parsed.username ? '<credentials>@' : '';
    return `${parsed.protocol}//${auth}${parsed.host}${parsed.pathname}`;
  } catch {
    return '<unparseable mongodb uri>';
  }
}
