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
    },
    plugins: [tailwindcss()],
  },
});
