import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(__dirname, 'frontend'),
  plugins: [react()],
  // Relative base so the static build works from any path (repo sub-paths on
  // GitHub Pages, or root on Cloudflare Pages / Netlify / Vercel).
  base: './',
  build: {
    outDir: 'dist'
  }
});