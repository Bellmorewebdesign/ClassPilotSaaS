import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

/**
 * ClassPilot extension build.
 *
 * esbuild directly rather than Vite, for one concrete reason: Chrome MV3
 * content scripts cannot be ES modules. They must be a single self-contained
 * file. The service worker, by contrast, IS a module. Driving esbuild
 * ourselves lets each entry point get exactly the format it needs, with no
 * plugin translating between us and the bundler.
 *
 *   background.js          ESM  - MV3 service worker ("type": "module")
 *   content-classroom.js   IIFE - injected into the page, no module support
 *   popup.js               IIFE - classic <script> in popup.html
 *
 * Usage: node build.mjs [--watch] [--prod]
 */

const root = dirname(fileURLToPath(import.meta.url));
const outDir = join(root, 'dist');
const publicDir = join(root, 'public');

const watch = process.argv.includes('--watch');
const prod = process.argv.includes('--prod');

/** @type {esbuild.BuildOptions} */
const shared = {
  bundle: true,
  target: ['chrome116'],
  platform: 'browser',
  // Sourcemaps in dev make a stack trace in the service worker console
  // point at TypeScript. They are dropped for a production package.
  sourcemap: prod ? false : 'inline',
  minify: prod,
  legalComments: 'none',
  logLevel: 'info',
  // The extension has no build-time secrets. This is asserted, not assumed:
  // see assertNoSecrets below.
  define: { 'process.env.NODE_ENV': JSON.stringify(prod ? 'production' : 'development') },
};

/** @type {esbuild.BuildOptions[]} */
const targets = [
  {
    ...shared,
    entryPoints: [join(root, 'src/background/index.ts')],
    outfile: join(outDir, 'background.js'),
    format: 'esm',
  },
  {
    ...shared,
    entryPoints: [join(root, 'src/content/classroom.ts')],
    outfile: join(outDir, 'content-classroom.js'),
    // IIFE is required: Chrome does not support ES modules in content scripts.
    format: 'iife',
  },
  {
    ...shared,
    entryPoints: [join(root, 'src/popup/main.ts')],
    outfile: join(outDir, 'popup.js'),
    format: 'iife',
  },
];

async function copyStatic() {
  await cp(publicDir, outDir, { recursive: true });
}

/**
 * Guard against a secret ever being compiled into the shipped bundle.
 *
 * The extension is designed so the API token lives only in
 * chrome.storage.local. This check makes that a build-time guarantee rather
 * than a convention someone could break later.
 */
async function assertNoSecrets() {
  const suspicious = [
    /DEV_EXTENSION_TOKEN\s*[:=]\s*["'][^"']{8,}/,
    /Bearer\s+[A-Za-z0-9._-]{20,}/,
    /mongodb(\+srv)?:\/\//,
  ];

  for (const file of ['background.js', 'content-classroom.js', 'popup.js']) {
    const contents = await readFile(join(outDir, file), 'utf8');
    for (const pattern of suspicious) {
      if (pattern.test(contents)) {
        throw new Error(
          `Build aborted: ${file} appears to contain a baked-in secret (matched ${pattern}).`,
        );
      }
    }
  }
}

/**
 * Keep manifest.json's version in step with package.json, so the version the
 * extension reports is the version we built.
 */
async function syncManifestVersion() {
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const manifestPath = join(outDir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  if (manifest.version !== pkg.version) {
    manifest.version = pkg.version;
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

/**
 * Bundle size budget.
 *
 * The content script is injected into every Classroom page the student
 * visits, so its size is a real user-facing cost. These limits exist because
 * a barrel re-export once pulled the whole Zod runtime into the extension and
 * pushed the content script to 2.8 MB; `sideEffects: false` on
 * @classpilot/shared lets bundlers drop it. A regression should fail the
 * build, not ship quietly.
 *
 * Limits apply to the production build; dev builds carry inline sourcemaps.
 */
const SIZE_BUDGET_BYTES = {
  'background.js': 400 * 1024,
  'content-classroom.js': 400 * 1024,
  'popup.js': 150 * 1024,
};

async function assertBundleBudget() {
  for (const [file, limit] of Object.entries(SIZE_BUDGET_BYTES)) {
    const { size } = await stat(join(outDir, file));
    const kb = (size / 1024).toFixed(1);
    if (size > limit) {
      throw new Error(
        `Build aborted: ${file} is ${kb} kB, over its ${(limit / 1024).toFixed(0)} kB budget. ` +
          'Something large was pulled into the bundle - check for a runtime import ' +
          'of a module that should only be used for its types.',
      );
    }
    console.log(`[classpilot] ${file}: ${kb} kB`);
  }
}

async function build() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await copyStatic();

  if (watch) {
    const contexts = await Promise.all(targets.map((target) => esbuild.context(target)));
    await Promise.all(contexts.map((context) => context.watch()));
    await syncManifestVersion();
    console.log('[classpilot] watching for changes; reload the extension in chrome://extensions after each rebuild');
    return;
  }

  await Promise.all(targets.map((target) => esbuild.build(target)));
  await syncManifestVersion();
  await assertNoSecrets();
  await assertBundleBudget();

  console.log(`[classpilot] extension built into ${outDir}`);
  console.log('[classpilot] load it via chrome://extensions -> Developer mode -> Load unpacked');
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
