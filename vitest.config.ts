import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    pool: 'forks',
    maxWorkers: 2,
    minWorkers: 1,
    watch: false
  }
});
