import mongoose from 'mongoose';
import type { Logger } from 'pino';
import type { AppEnv } from '../config/env.js';
import { safeMongoUri } from '../lib/logger.js';

/**
 * MongoDB connection.
 *
 * The API is stateless: this is the only long-lived resource it holds, and
 * nothing is ever written to local disk. That is what makes the service safe
 * to run behind a load balancer or migrate to AWS later.
 *
 * The connection string is never logged — only host and database name.
 */
export async function connectDatabase(
  env: AppEnv,
  logger: Logger,
): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  // Fail fast instead of silently buffering queries when Mongo is unreachable;
  // a dead database should surface as a 503, not a hung request.
  mongoose.set('bufferCommands', false);

  const connection = await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB_NAME,
    serverSelectionTimeoutMS: 15_000,
    maxPoolSize: 10,
    retryWrites: true,
  });

  logger.info(
    { event: 'db.connected', uri: safeMongoUri(env.MONGODB_URI), db: env.MONGODB_DB_NAME },
    'connected to MongoDB',
  );

  mongoose.connection.on('disconnected', () => {
    logger.warn({ event: 'db.disconnected' }, 'MongoDB connection lost');
  });
  mongoose.connection.on('reconnected', () => {
    logger.info({ event: 'db.reconnected' }, 'MongoDB connection restored');
  });
  mongoose.connection.on('error', (error: Error) => {
    logger.error({ event: 'db.error', err: error.message }, 'MongoDB error');
  });

  return connection;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close();
}

/** True when the driver currently has a usable connection. */
export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
