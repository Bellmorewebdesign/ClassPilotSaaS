import type { FastifyInstance } from 'fastify';
import type { MeDto } from '@classpilot/shared';
import { currentUser, requireAuth } from '../plugins/auth.js';

/**
 * GET /api/v1/me
 *
 * The extension calls this to verify its token before attempting a sync,
 * which is what turns "backend returned 401" into a clear popup message
 * instead of a failure halfway through a 60-assignment run.
 */
export async function registerMeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/me', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const body: MeDto = {
      id: user.id.toString(),
      email: user.email,
      displayName: user.displayName,
      authMode: user.authMode,
    };
    return body;
  });
}
