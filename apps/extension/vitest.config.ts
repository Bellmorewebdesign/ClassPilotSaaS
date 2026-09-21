import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Extractors run against real DOM trees, so the tests need a DOM too.
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
  },
});
