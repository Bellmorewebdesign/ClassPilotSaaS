import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import type { NextConfig } from 'next';

/**
 * Load the repository-root `.env`.
 *
 * Next only reads a .env next to the app, but ClassPilot keeps one at the
 * workspace root so the API and the web app cannot drift apart on the shared
 * dev token. next.config.ts runs before the server starts, so populating
 * process.env here reaches both `next dev` and `next start`.
 *
 * `override: false` means a real environment variable always wins, which is
 * what Docker and CI rely on.
 */
const rootEnv = resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) {
  loadDotenv({ path: rootEnv, override: false, quiet: true });
}

/**
 * The dashboard is a thin read-only view over the ClassPilot API.
 *
 * It holds no database connection and no business logic: every page fetches
 * from the API server-side. That keeps the API the single place where
 * userId scoping is enforced, and means the web app can move to Vercel (or
 * anywhere) without carrying data-access code with it.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @classpilot/shared ships as TypeScript-compiled ESM from the workspace.
  transpilePackages: ['@classpilot/shared'],
  // Trim the standalone server output for container deploys.
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
};

export default nextConfig;
