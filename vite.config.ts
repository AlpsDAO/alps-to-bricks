import { defineConfig } from 'vite';

// Relative base: the same build works at the root (bricks.alps.wtf) or under a sub-path.
export default defineConfig({
  base: './',
  worker: { format: 'es' },
  build: {
    target: 'es2022', chunkSizeWarningLimit: 1200,
    // two pages: the site, and the trait review gallery (/traits.html)
    rolldownOptions: { input: { main: 'index.html', traits: 'traits.html' } },
  },
});
