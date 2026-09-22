import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  // The app's tsconfig uses `jsx: preserve` because Next compiles JSX itself.
  // Vitest transforms test files directly, so it needs the runtime told here.
  esbuild: { jsx: 'automatic' },
  test: {
    // Most suites are pure logic and run in node. The hook tests need a DOM
    // (IntersectionObserver, visibilitychange, React rendering), so they opt
    // in per-file with `// @vitest-environment jsdom`.
    environment: 'node',
    include: ['{lib,components,app}/**/*.test.{ts,tsx}'],
    globals: true,
  },
  resolve: { alias: { '@': resolve(__dirname, '.') } },
});
