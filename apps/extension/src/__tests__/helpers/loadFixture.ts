import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtractionContext } from '../../extractors/framework.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

/**
 * Build an ExtractionContext from a fixture file.
 *
 * The extractors take a Document rather than reaching for the global one, so
 * a test can hand them a fixture and a fixed clock with no browser mocking.
 */
export function loadFixture(
  fileName: string,
  url: string,
  now: Date = new Date('2026-09-20T19:00:00.000Z'),
): ExtractionContext {
  const html = readFileSync(join(fixturesDir, fileName), 'utf8');
  const parser = new DOMParser();
  const document = parser.parseFromString(html, 'text/html');
  return { document, url, now };
}
