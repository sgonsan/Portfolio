import { defineConfig } from 'astro/config';

export default defineConfig({
  outDir: 'dist',
  vite: {
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true
        }
      }
    }
  }
});
