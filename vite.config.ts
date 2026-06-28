import { defineConfig } from 'vite';

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
  },
});
