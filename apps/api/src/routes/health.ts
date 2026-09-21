import type { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import { isDatabaseConnected } from '../db/connect.js';

/**
 * Liveness and readiness.
 *
 * GET /health is unauthenticated on purpose: it is what Docker, a load
 * balancer or Cloudflare Tunnel probes. It leaks nothing beyond "is the
 * database reachable".
 */
export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_request, reply) => {
    const dbConnected = isDatabaseConnected();
    const body = {
      status: dbConnected ? ('ok' as const) : ('degraded' as const),
      uptimeSeconds: Math.round(process.uptime()),
      database: {
        connected: dbConnected,
        readyState: mongoose.connection.readyState,
      },
      timestamp: new Date().toISOString(),
    };
    return reply.status(dbConnected ? 200 : 503).send(body);
  });
}
