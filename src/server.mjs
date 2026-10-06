import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { appRoot, appHome, doctor } from './local.mjs';
import { validateCapsule, MAX_BYTES, VERSION } from './core.mjs';

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg' };
const routes = { '/': 'public/index.html', '/style.css': 'public/style.css', '/app.js': 'public/app.js', '/logo.jpg': 'docs/pngoung/pngoung-logo.jpg' };
const server = http.createServer(async (req, res) => {
  const origin = `http://127.0.0.1:${server.address().port}`;
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  const reply = (code, data) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
  if (req.headers.host !== `127.0.0.1:${server.address().port}` || (req.headers.origin && req.headers.origin !== origin) || req.headers['sec-fetch-site'] === 'cross-site') return reply(403, { error: 'Local same-origin requests only' });
  const url = new URL(req.url, origin);
  try {
    if (req.method === 'GET' && url.pathname === '/healthz') return reply(200, { app: 'pngoung-capsule', version: VERSION });
    if (req.method === 'GET' && url.pathname === '/api/status') {
      let demo = null;
      try { const d = JSON.parse(fs.readFileSync(path.join(appHome(), 'demo.json'), 'utf8')); demo = { ok: d.ok, journey: d.journey, proof: d.proof, revision: d.revision }; } catch {}
      return reply(200, { ...doctor(), demo, appRoot });
    }
    if (req.method === 'POST' && url.pathname === '/api/inspect') {
      if (!req.headers['content-type']?.startsWith('application/json')) return reply(415, { error: 'JSON required' });
      const chunks = []; let bytes = 0;
      for await (const chunk of req) { bytes += chunk.length; if (bytes > MAX_BYTES * 2) { reply(413, { error: 'File is too large' }); req.destroy(); return; } chunks.push(chunk); }
      const c = validateCapsule(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      return reply(200, { name: c.name, projectId: c.projectId, id: c.id, parent: c.parent, sender: c.sender, revision: c.ancestors.length + 1, status: c.status, task: c.task, files: c.files.map(({ content, ...f }) => f) });
    }
    if (req.method === 'GET' && routes[url.pathname]) {
      const file = path.join(appRoot, routes[url.pathname]);
      if (!fs.existsSync(file)) return reply(404, { error: 'Not found' });
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] }); fs.createReadStream(file).pipe(res); return;
    }
    reply(404, { error: 'Not found' });
  } catch (e) { reply(400, { error: e.message }); }
});
let port = Number(process.env.PNGOUNG_CAPSULE_PORT || 4386);
let attempts = 0;
server.on('error', error => {
  if (error.code === 'EADDRINUSE' && ++attempts < 10) { port++; server.listen(port, '127.0.0.1'); }
  else { console.error(error.message); process.exitCode = 1; }
});
server.once('listening', () => {
  const url = `http://127.0.0.1:${server.address().port}`;
  console.log(JSON.stringify({ app: 'pngoung-capsule', url, pid: process.pid }));
  if (!process.argv.includes('--no-browser')) {
    const [cmd, args] = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
    const child = spawn(cmd, args, { stdio: 'ignore', windowsHide: true }); child.on('error', () => {}); child.unref();
  }
});
server.listen(port, '127.0.0.1');
