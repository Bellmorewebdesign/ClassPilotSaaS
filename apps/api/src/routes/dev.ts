import type { FastifyInstance } from 'fastify';
import type { AppEnv } from '../config/env.js';
import { ApiError } from '../lib/errors.js';
import { ExtensionToken, User } from '../models/index.js';

/**
 * Development-only helpers.
 *
 * GET /api/v1/dev/connection describes how to point the extension at this
 * API. It returns the token's last four characters ONLY — never the token —
 * so it is safe for the dashboard to call and safe to leave in logs.
 *
 * The whole route tree refuses to register unless AUTH_MODE=dev.
 */
export async function registerDevRoutes(
  app: FastifyInstance,
  env: AppEnv,
): Promise<void> {
  if (env.AUTH_MODE !== 'dev') return;

  app.get('/api/v1/dev/connection', async () => {
    const user = await User.findOne({ email: env.DEV_USER_EMAIL.toLowerCase() })
      .lean()
      .exec();

    if (!user) {
      throw ApiError.serviceUnavailable(
        'The development user has not been provisioned yet.',
      );
    }

    const token = await ExtensionToken.findOne({ userId: user._id, revokedAt: null })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return {
      authMode: 'dev' as const,
      user: {
        id: user._id.toString(),
        email: user.email,
        displayName: user.displayName ?? null,
      },
      token: token
        ? {
            configured: true,
            lastFourChars: token.lastFourChars,
            lastUsedAt: token.lastUsedAt ? token.lastUsedAt.toISOString() : null,
          }
        : { configured: false, lastFourChars: null, lastUsedAt: null },
      instructions:
        'Copy DEV_EXTENSION_TOKEN from your .env file into the ClassPilot extension popup. The API never returns the token itself.',
    };
  });
}
