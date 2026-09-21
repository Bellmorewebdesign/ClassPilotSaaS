import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // mongodb-memory-server needs room to boot on a cold cache.
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Model registration is global to Mongoose, so suites must not race.
    fileParallelism: false,
  },
});
