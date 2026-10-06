import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawnSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { appRoot, installSkills, doctor } from '../src/local.mjs';
import { runDemo } from '../src/demo.mjs';
import { inbox } from '../src/core.mjs';

function home(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'capsule-local-'));
  const old = { a: process.env.PNGOUNG_CAPSULE_HOME, b: process.env.PNGOUNG_CAPSULE_USER_HOME };
  process.env.PNGOUNG_CAPSULE_HOME = path.join(dir, 'data'); process.env.PNGOUNG_CAPSULE_USER_HOME = path.join(dir, 'user');
  t.after(() => { for (const [key, value] of [['PNGOUNG_CAPSULE_HOME', old.a], ['PNGOUNG_CAPSULE_USER_HOME', old.b]]) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } fs.rmSync(dir, { recursive: true, force: true }); });
  return dir;
}
test('setup is repeatable and doctor detects modified or stale installation', t => {
  const dir = home(t), run = () => spawnSync(process.execPath, ['scripts/setup.mjs'], { cwd: appRoot, encoding: 'utf8', env: process.env });
  assert.equal(run().status, 0); assert.equal(run().status, 0); assert.equal(doctor().ok, true);
  const skill = path.join(dir, 'user', '.agents', 'skills', 'pngoung-capsule');
  fs.appendFileSync(path.join(skill, 'SKILL.md'), '\nmodified'); assert.equal(doctor().ok, false);
  assert.equal(run().status, 0);
  const manifest = path.join(skill, 'CAPSULE_APP.json'), m = JSON.parse(fs.readFileSync(manifest));
  fs.writeFileSync(manifest, JSON.stringify({ ...m, appRoot: '/wrong-installation' })); assert.equal(doctor().ok, false);
  assert.equal(run().status, 0);
  fs.writeFileSync(path.join(dir, 'data', 'setup.json'), '{}'); assert.equal(doctor().ok, false);
});
test('installer preserves an unrelated pre-existing skill', t => {
  const dir = home(t), skill = path.join(dir, 'user', '.agents', 'skills', 'pngoung-capsule', 'SKILL.md');
  fs.mkdirSync(path.dirname(skill), { recursive: true }); fs.writeFileSync(skill, 'keep me');
  assert.throws(installSkills, /not managed/); assert.equal(fs.readFileSync(skill, 'utf8'), 'keep me');
});
test('loopback UI validates origin and capsules without accepting arbitrary paths', async t => {
  const dir = home(t), child = spawn(process.execPath, ['src/server.mjs', '--no-browser'], { cwd: appRoot, env: { ...process.env, PNGOUNG_CAPSULE_PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => { if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; } });
  const line = await new Promise((resolve, reject) => { let s = ''; const timer = setTimeout(() => reject(new Error('server startup timeout')), 10000); child.on('error', reject); child.stdout.on('data', b => { s += b; if (s.includes('\n')) { clearTimeout(timer); resolve(s.split('\n')[0]); } }); });
  const { url } = JSON.parse(line);
  assert.equal((await fetch(url + '/healthz')).status, 200);
  const html = await fetch(url); assert.match(html.headers.get('content-security-policy'), /frame-ancestors 'none'/); assert.match(await html.text(), /pngoung capsule/i);
  assert.equal((await fetch(url + '/api/status', { headers: { Origin: 'https://example.org' } })).status, 403);
  const badHost = await new Promise((resolve, reject) => { const req = http.get(url + '/api/status', { headers: { Host: 'example.org' } }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', reject); });
  assert.equal(badHost, 403);
  assert.equal((await fetch(url + '/src/core.mjs')).status, 404);
  assert.equal((await fetch(url + '/api/inspect', { method: 'POST', body: '{}' })).status, 415);
  const d = runDemo(dir), packet = inbox(path.join(d.root, 'transfer')).heads[0];
  const good = await fetch(url + '/api/inspect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: fs.readFileSync(packet.file) });
  assert.equal(good.status, 200); const result = await good.json(); assert.equal(result.status, 'final'); assert.equal(result.files[0].content, undefined);
  const bad = await fetch(url + '/api/inspect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(bad.status, 400);
});
