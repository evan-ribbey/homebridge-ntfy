import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      // Type declarations and the registration entry point carry no logic to cover
      exclude: ['src/types.ts', 'src/const.ts', 'src/index.ts'],
    },
  },
});
