import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Static multi-page support for the dev/preview servers: on static hosts
// (Cloudflare Pages, Netlify ...) a request for /subdir/ serves
// /subdir/index.html automatically, but Vite's dev/preview servers do not -
// unknown paths fall through to the SPA index.html. This middleware rewrites
// those clean URLs to the real file so local testing matches production.
const STATIC_DIRS = ['about','feedback','privacy-policy','terms-of-use',
  'mercenary-build-calculator','sorcerer-build-calculator','blackarrow-build-calculator',
  'shadowstrix-build-calculator','seer-build-calculator','withered-knight-build-calculator'];
const CLASS_SLUGS = ['mercenary','sorcerer','blackarrow','shadowstrix','seer','withered-knight'];

function cleanUrlMiddleware(root) {
  return (req, _res, next) => {
    const pathname = (req.url || '/').split('?')[0];
    if (pathname === '/') return next();
    const parts = pathname.replace(/^\/+|\/+$/g, '').split('/');
    let file = null;
    if (parts.length === 1 && STATIC_DIRS.includes(parts[0])) {
      file = parts[0] + '/index.html';
    } else if (parts.length === 2 && (parts[0] === 'guides' || parts[0] === 'builds') && CLASS_SLUGS.includes(parts[1])) {
      file = parts[0] + '/' + parts[1] + '/index.html';
    }
    if (file && fs.existsSync(path.join(root, 'public', file))) req.url = '/' + file;
    next();
  };
}

const cleanUrlsPlugin = {
  name: 'clean-url-directories',
  configureServer(server) { server.middlewares.use(cleanUrlMiddleware(server.config.root)); },
  configurePreviewServer(server) { server.middlewares.use(cleanUrlMiddleware(server.config.root)); }
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(__dirname, 'frontend'),
  plugins: [react(), cleanUrlsPlugin],
  // Relative base so the static build works from any path (repo sub-paths on
  // GitHub Pages, or root on Cloudflare Pages / Netlify / Vercel).
  base: './',
  build: {
    outDir: 'dist'
  }
});