import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/crypto-lab-ec-point-arithmetic/',
  server: {
    host: '0.0.0.0',
    port: 4173,
  },
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'jsdom',
    // Unit tests live under src/; keep the Playwright e2e/ specs out of vitest.
    include: ['src/**/*.test.ts'],
  },
});
