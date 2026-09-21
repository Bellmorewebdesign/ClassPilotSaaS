import type { FastifyInstance } from 'fastify';
import {
  syncClassroomBatchRequestSchema,
  syncClassroomRequestSchema,
  type SyncStatusDto,
} from '@classpilot/shared';
import type { AppEnv } from '../config/env.js';
import { SYNC_EVENTS, type SyncLogger } from '../lib/logger.js';
import { parseOrThrow } from '../lib/validate.js';
import { Assignment, ClassroomClass, SyncRun } from '../models/index.js';
import { currentUser, requireAuth } from '../plugins/auth.js';
import { serializeSyncRun } from '../services/serialize.js';
import { failSyncRun, ingestSync } from '../services/syncService.js';

/**
 * Sync endpoints — the contract with the Chrome extension.
 *
 *   POST /api/v1/sync/classroom         a whole sync in one request
 *   POST /api/v1/sync/classroom/batch   one chunk of a longer sync
 *   GET  /api/v1/sync/status            what the dashboard shows
 *
 * Both POSTs run the same ingestion path, so there is one set of idempotency
 * and validation rules, not two.
 */
export async function registerSyncRoutes(
  app: FastifyInstance,
  env: AppEnv,
): Promise<void> {
  /** Single-shot sync. Implicitly final. */
  app.post(
    '/api/v1/sync/classroom',
    { preHandler: requireAuth },
    async (request) => {
      const user = currentUser(request);
      const payload = parseOrThrow(
        syncClassroomRequestSchema,
        request.body,
        'Invalid sync payload.',
      );

      try {
        return await ingestSync({
          userId: user.id,
          payload: { ...payload, batchIndex: 0, final: true },
          logger: request.log,
          env,
          isFinal: true,
        });
      } catch (error) {
        await markFailed(user.id, payload.syncId, error, request.log);
        throw error;
      }
    },
  );

  /** One batch of a longer sync. The run closes when `final` is true. */
  app.post(
    '/api/v1/sync/classroom/batch',
    { preHandler: requireAuth },
    async (request) => {
      const user = currentUser(request);
      const payload = parseOrThrow(
        syncClassroomBatchRequestSchema,
        request.body,
        'Invalid sync batch payload.',
      );

      try {
        return await ingestSync({
          userId: user.id,
          payload,
          logger: request.log,
          env,
          isFinal: payload.final,
        });
      } catch (error) {
        await markFailed(user.id, payload.syncId, error, request.log);
        throw error;
      }
    },
  );

  app.get('/api/v1/sync/status', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);

    const [lastRun, activeRun, classes, assignments] = await Promise.all([
      SyncRun.findOne({ userId: user.id }).sort({ startedAt: -1 }).lean().exec(),
      SyncRun.findOne({ userId: user.id, status: 'running' })
        .sort({ startedAt: -1 })
        .lean()
        .exec(),
      ClassroomClass.countDocuments({ userId: user.id }).exec(),
      Assignment.countDocuments({ userId: user.id }).exec(),
    ]);

    const body: SyncStatusDto = {
      lastSync: lastRun ? serializeSyncRun(lastRun) : null,
      activeSync: activeRun ? serializeSyncRun(activeRun) : null,
      totals: { classes, assignments },
    };
    return body;
  });
}

/**
 * Record an aborted sync so the dashboard never shows a run stuck at
 * "running". The failure reason is logged, but only a generic message is
 * persisted — an exception string could contain data we do not want stored.
 */
async function markFailed(
  userId: Parameters<typeof failSyncRun>[0]['userId'],
  syncId: string,
  error: unknown,
  logger: Pick<SyncLogger, 'error'>,
): Promise<void> {
  logger.error(
    {
      event: SYNC_EVENTS.failed,
      syncId,
      err: error instanceof Error ? error.message : 'unknown error',
    },
    'sync ingestion failed',
  );
  try {
    await failSyncRun({
      userId,
      syncId,
      code: 'ingest_failed',
      message: 'The server could not finish storing this sync.',
    });
  } catch {
    // The original error is what matters; never mask it with a bookkeeping
    // failure.
  }
}
