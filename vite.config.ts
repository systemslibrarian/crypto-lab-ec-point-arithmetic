import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/crypto-lab-ec-point-arithmetic/',
  server: {
    host: '0.0.0.0',
    port: 4701,
  },
  // Pin the preview server too. Without this block `vite preview` falls back to
  // its default port, which is shared fleet-wide — a harness could then attach
  // to a sibling lab's preview and report green against the wrong app.
  preview: {
    port: 4701,
    strictPort: true,
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
