import { createHash } from 'node:crypto';
import type { Logger } from 'pino';
import type { AppEnv } from '../config/env.js';
import { ExtensionToken, User } from '../models/index.js';

/**
 * Development-user provisioning.
 *
 * V1 deliberately does not ship a full auth system. Instead, boot provisions
 * exactly one user and registers the SHA-256 hash of DEV_EXTENSION_TOKEN
 * against it. The extension then authenticates as any real SaaS client would:
 * `Authorization: Bearer <token>`.
 *
 * Replacing this with real auth means replacing the token resolver in
 * plugins/auth.ts — every route and query already scopes by `userId`.
 */

/** Hash a bearer token. The raw token is never stored, logged or returned. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export interface BootstrapResult {
  userId: string;
  email: string;
  tokenLastFour: string;
}

export async function bootstrapDevUser(
  env: AppEnv,
  logger: Logger,
): Promise<BootstrapResult> {
  if (env.AUTH_MODE !== 'dev') {
    throw new Error('bootstrapDevUser called outside AUTH_MODE=dev');
  }
  const rawToken = env.DEV_EXTENSION_TOKEN;
  if (!rawToken) {
    // loadEnv already guarantees this; belt and braces.
    throw new Error('DEV_EXTENSION_TOKEN is required in AUTH_MODE=dev');
  }

  const user = await User.findOneAndUpdate(
    { email: env.DEV_USER_EMAIL.toLowerCase() },
    {
      $setOnInsert: {
        email: env.DEV_USER_EMAIL.toLowerCase(),
        displayName: env.DEV_USER_DISPLAY_NAME,
        authMode: 'dev' as const,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const tokenHash = hashToken(rawToken);
  const lastFour = rawToken.slice(-4);

  await ExtensionToken.findOneAndUpdate(
    { tokenHash },
    {
      $set: { userId: user._id, revokedAt: null, lastFourChars: lastFour },
      $setOnInsert: { tokenHash, label: 'dev-extension-token' },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  // Any token previously issued to this dev user that is no longer the
  // configured one is revoked, so rotating DEV_EXTENSION_TOKEN actually
  // invalidates the old value.
  await ExtensionToken.updateMany(
    { userId: user._id, tokenHash: { $ne: tokenHash }, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );

  logger.info(
    {
      event: 'auth.dev_user_ready',
      userId: user._id.toString(),
      email: user.email,
      tokenLastFour: lastFour,
    },
    'development user provisioned',
  );

  return {
    userId: user._id.toString(),
    email: user.email,
    tokenLastFour: lastFour,
  };
}
