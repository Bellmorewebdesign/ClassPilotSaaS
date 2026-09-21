import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

/**
 * Load the repository-root `.env`.
 *
 * ClassPilot keeps ONE .env at the repo root, because the API and the web app
 * share values (the dev token in particular) and two files that must be kept
 * in sync is a bug waiting to happen.
 *
 * Node does not do this for us, so it happens explicitly, before any
 * configuration is read.
 *
 * A missing file is not an error: in Docker and in CI the variables come from
 * the environment directly, and `loadEnv()` will report anything genuinely
 * missing with a readable message.
 */
export function loadDotenvFromRepoRoot(): void {
  const here = dirname(fileURLToPath(import.meta.url));

  // Walk up looking for the workspace root. Works from src/ under tsx and
  // from dist/ under node, without hardcoding a depth.
  let current = here;
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) {
      const envPath = join(current, '.env');
      if (existsSync(envPath)) {
        // override: false so a real environment variable always wins over the
        // file -- that is what makes Docker and CI behave predictably.
        config({ path: envPath, override: false, quiet: true });
      }
      return;
    }
    const parent = resolve(current, '..');
    if (parent === current) break;
    current = parent;
  }
}
