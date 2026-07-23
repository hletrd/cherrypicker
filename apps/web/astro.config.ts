import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  integrations: [svelte()],
  output: 'static',
  site: 'https://hletrd.github.io',
  base: '/cherrypicker/',
  vite: {
    build: {
      manifest: true,
      // Format-specific parser workers are intentionally deferred and include
      // large PDF/XLSX runtimes. `check-web-bundles.ts` verifies that none enter
      // the initial graph and enforces tighter initial/catalog budgets.
      chunkSizeWarningLimit: 1_400,
    },
    plugins: [tailwindcss()],
  },
});
