#!/usr/bin/env node
/**
 * Mini-HTTP-Server für die Config-UI (tools/config-ui/).
 *
 * - Statisches Serving von tools/config-ui/
 * - GET /configs/*            → liefert Dateien aus configs/
 * - GET /schema.mjs           → Alias auf scripts/config-schema.mjs
 *
 * Start via: npm run config-ui
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve, normalize } from 'node:path';
import { exec } from 'node:child_process';

const PORT = 5174;
const UI_ROOT = resolve('tools/config-ui');
const REPO_ROOT = resolve('.');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jsonc': 'application/json; charset=utf-8',
};

function safeJoin(root, userPath) {
  const clean = userPath.replace(/\?.*$/, '').replace(/^\/+/, '');
  const full = normalize(join(root, clean));
  if (!full.startsWith(root)) return null;
  return full;
}

function serveFile(filePath, res) {
  try {
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const ext = extname(filePath);
    res.setHeader('Content-Type', MIME[ext] ?? 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.end(readFileSync(filePath));
  } catch (err) {
    res.writeHead(500); res.end('Server error: ' + err.message);
  }
}

const server = createServer((req, res) => {
  const url = req.url ?? '/';

  if (url === '/schema.mjs') {
    serveFile(resolve('scripts/config-schema.mjs'), res); return;
  }
  if (url.startsWith('/configs/')) {
    const full = safeJoin(REPO_ROOT, url);
    if (!full) { res.writeHead(400); res.end('Bad path'); return; }
    serveFile(full, res); return;
  }

  const staticPath = url === '/' ? '/index.html' : url;
  const full = safeJoin(UI_ROOT, staticPath);
  if (!full) { res.writeHead(400); res.end('Bad path'); return; }
  serveFile(full, res);
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Config-UI läuft auf ${url}`);
  console.log('Abbrechen mit Ctrl+C');

  const cmd = process.platform === 'win32' ? `start ${url}`
            : process.platform === 'darwin' ? `open ${url}`
            : `xdg-open ${url}`;
  exec(cmd, () => { /* ignore browser-open errors */ });
});
