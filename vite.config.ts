import { defineConfig } from 'vite';

export default defineConfig({
  base: '/bullet/',
  build: {
    target: 'esnext',
  },
  server: {
    port: 3000,
  },
});
