import { defineConfig } from 'vitest/config';

// Frontend tests only. The API under server/ has its own tests (node:test),
// run with `npm test --prefix server`.
export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
