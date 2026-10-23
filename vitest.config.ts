import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['motor/test/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
