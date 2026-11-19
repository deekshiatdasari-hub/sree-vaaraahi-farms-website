/**
 * Local preview of site/ with browser caching turned off, so every edit shows on a normal reload.
 * (Python's http.server lets browsers keep old scripts.) Run with: npm run preview
 * Folder addresses (/shop/) serve their index.html; unknown addresses serve 404.html, like Cloudflare Pages.
 */

import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'site');
const port = Number(process.env.PORT ?? 5500);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let path = normalize(join(root, decodeURIComponent(url.pathname)));
  // Never serve anything outside site/.
  if (path !== root && !path.startsWith(root + sep)) return send(res, 403, 'Forbidden', TYPES['.txt']);
  try {
    if ((await stat(path)).isDirectory()) {
      if (!url.pathname.endsWith('/')) {
        res.writeHead(301, { Location: `${url.pathname}/${url.search}` });
        return res.end();
      }
      path = join(path, 'index.html');
    }
    send(res, 200, await readFile(path), TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream');
  } catch {
    send(res, 404, await readFile(join(root, '404.html')).catch(() => 'Not found'), TYPES['.html']);
  }
}).listen(port, () => console.log(`Website preview (no caching): http://localhost:${port}`));
