import mongoose from 'mongoose';
import { pino, type Logger } from 'pino';

/**
 * Test database resolution.
 *
 * Integration tests need a real MongoDB, because the guarantees they check —
 * unique-index duplicate prevention, upsert semantics, user isolation — are
 * enforced by the database itself. A mock would prove nothing.
 *
 * Resolution order:
 *   1. MONGODB_TEST_URI  — point at a scratch database (local or Atlas).
 *   2. mongodb-memory-server — an ephemeral mongod, when it can be started.
 *   3. Skip, loudly.
 *
 * Never point MONGODB_TEST_URI at a database you care about: the helpers
 * below drop collections between tests.
 */

let memoryServer: { stop: () => Promise<boolean | void> } | null = null;
let resolvedUri: string | null = null;
let unavailableReason: string | null = null;

async function resolveUri(): Promise<string | null> {
  const fromEnv = process.env.MONGODB_TEST_URI?.trim();
  if (fromEnv) return fromEnv;

  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const server = await MongoMemoryServer.create();
    memoryServer = server;
    return server.getUri();
  } catch (error) {
    unavailableReason =
      error instanceof Error ? error.message.split('\n')[0] ?? 'unknown' : 'unknown';
    return null;
  }
}

/**
 * Connect to a test database. Returns false when none is available, so a
 * suite can skip instead of failing.
 */
export async function connectTestDatabase(): Promise<boolean> {
  if (mongoose.connection.readyState === 1) return true;

  resolvedUri = await resolveUri();
  if (!resolvedUri) {
    console.warn(
      [
        '',
        '  SKIPPED: database integration tests need a MongoDB instance.',
        `  mongodb-memory-server could not start: ${unavailableReason}`,
        '',
        '  To run them, point at a scratch database (its collections get dropped):',
        '    MONGODB_TEST_URI="mongodb://localhost:27017/classpilot_test" pnpm test',
        '    MONGODB_TEST_URI="mongodb+srv://.../classpilot_test" pnpm test',
        '',
      ].join('\n'),
    );
    return false;
  }

  mongoose.set('bufferCommands', false);
  await mongoose.connect(resolvedUri, { serverSelectionTimeoutMS: 20_000 });
  return true;
}

/** True when a test database is currently usable. */
export function hasTestDatabase(): boolean {
  return mongoose.connection.readyState === 1;
}

/** Wipe every collection. Called between tests so each starts clean. */
export async function clearTestDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 1) return;
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

export async function disconnectTestDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase().catch(() => undefined);
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

/**
 * Build the schema indexes.
 *
 * This must run before any duplicate-prevention test: without the unique
 * indexes the database will happily accept duplicates, and the test would
 * pass for the wrong reason.
 */
export async function syncTestIndexes(): Promise<void> {
  const { Assignment, ClassroomClass, ExtensionToken, SyncRun, User } = await import(
    '../../models/index.js'
  );
  await Promise.all([
    User.syncIndexes(),
    ExtensionToken.syncIndexes(),
    ClassroomClass.syncIndexes(),
    Assignment.syncIndexes(),
    SyncRun.syncIndexes(),
  ]);
}

/**
 * A real pino logger pinned to "silent".
 *
 * A hand-rolled stub is not enough here: Fastify validates that the logger
 * instance it is handed implements the full pino surface, so tests that build
 * a server need the genuine article.
 */
export function silentLogger(): Logger {
  return pino({ level: 'silent' });
}
