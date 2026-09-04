#!/usr/bin/env node
/**
 * Servidor estatico minimo (sem dependencias) para as paginas de test-sites/.
 *
 *   node scripts/serve-test-sites.mjs bad  5173
 *   node scripts/serve-test-sites.mjs good 5174
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const site = process.argv[2] ?? 'bad';
const port = Number(process.argv[3] ?? 5173);
const root = resolve(repoRoot, 'test-sites', site);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

const server = createServer(async (req, res) => {
  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const relative = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(root, relative);

  try {
    const info = await stat(filePath).catch(() => null);
    if (!info || info.isDirectory()) filePath = join(filePath, 'index.html');
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
  console.log(`[serve:${site}] ${res.statusCode} ${req.method} ${urlPath}`);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[serve:${site}] servindo ${root} em http://0.0.0.0:${port}`);
});
