import { defineConfig } from 'astro/config';

export default defineConfig({
  // Static output (no SSR needed for POC)
  output: 'static',
  server: { host: true, port: 4321 },
});
