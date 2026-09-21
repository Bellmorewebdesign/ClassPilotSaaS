import { loadEnv } from './config/env.js';
import { bootstrapDevUser } from './db/bootstrap.js';
import { connectDatabase, disconnectDatabase } from './db/connect.js';
import { createLogger } from './lib/logger.js';
import { buildServer } from './server.js';

/**
 * Process entry point.
 *
 * Boot order matters: configuration is validated before anything else, so a
 * misconfigured deploy fails immediately with a readable message instead of
 * half-starting and erroring on the first request.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);

  try {
    await connectDatabase(env, logger);
  } catch (error) {
    logger.fatal(
      { event: 'boot.db_failed', err: error instanceof Error ? error.message : String(error) },
      'could not connect to MongoDB - check MONGODB_URI and your Atlas IP allow-list',
    );
    process.exit(1);
  }

  if (env.AUTH_MODE === 'dev') {
    await bootstrapDevUser(env, logger);
  }

  // Build the indexes declared on the schemas. In production this is usually
  // a migration step, but at V1 scale doing it at boot keeps setup to one
  // command and guarantees the duplicate-prevention indexes actually exist.
  const { Assignment, ClassroomClass, ExtensionToken, SyncRun, User } = await import(
    './models/index.js'
  );
  await Promise.all([
    User.syncIndexes(),
    ExtensionToken.syncIndexes(),
    ClassroomClass.syncIndexes(),
    Assignment.syncIndexes(),
    SyncRun.syncIndexes(),
  ]);
  logger.info({ event: 'boot.indexes_ready' }, 'database indexes synchronized');

  const app = await buildServer(env, logger);

  await app.listen({ host: env.API_HOST, port: env.API_PORT });
  logger.info(
    { event: 'boot.listening', host: env.API_HOST, port: env.API_PORT, authMode: env.AUTH_MODE },
    `ClassPilot API listening on http://${env.API_HOST}:${env.API_PORT}`,
  );

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ event: 'shutdown.started', signal }, 'shutting down');
    try {
      await app.close();
      await disconnectDatabase();
      logger.info({ event: 'shutdown.complete' }, 'shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error(
        { event: 'shutdown.failed', err: error instanceof Error ? error.message : String(error) },
        'shutdown failed',
      );
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  // Configuration errors land here, before a logger exists.
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
