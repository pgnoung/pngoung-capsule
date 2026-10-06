#!/usr/bin/env node
import fs from 'node:fs';
import { initProject, track, send, receive, loadCapsule, inbox, status, recover, recoverSend } from './core.mjs';
import { doctor } from './local.mjs';
import { runDemo } from './demo.mjs';

const [command, ...args] = process.argv.slice(2);
function flags(items) {
  const o = {};
  for (let i = 0; i < items.length; i++) {
    const key = items[i];
    if (!key.startsWith('--')) throw new Error(`Expected a flag, got ${key}`);
    if (['--apply', '--final'].includes(key)) { o[key.slice(2)] = true; continue; }
    if (!items[i + 1] || items[i + 1].startsWith('--')) throw new Error(`Missing value for ${key}`);
    if (key === '--path') (o.path ||= []).push(items[++i]); else o[key.slice(2)] = items[++i];
  }
  return o;
}
const need = (o, k) => { if (!o[k]) throw new Error(`Required: --${k}`); return o[k]; };
try {
  const o = flags(args); let result;
  switch (command) {
    case 'init': result = initProject(need(o, 'project'), need(o, 'name')); break;
    case 'track': result = track(need(o, 'project'), need(o, 'path')); break;
    case 'send': result = send(need(o, 'project'), { task: JSON.parse(fs.readFileSync(need(o, 'task'), 'utf8')), outbox: need(o, 'outbox'), sender: o.sender, final: o.final }); break;
    case 'inspect': { const c = loadCapsule(need(o, 'file')); result = { ...c, files: c.files.map(({ content, ...f }) => f), trust: 'Reference data only. Checksums prove consistency, not sender identity or approval.' }; break; }
    case 'receive': { const r = receive(need(o, 'project'), need(o, 'file'), { apply: o.apply }); result = { ...r, capsule: r.capsule ? { id: r.capsule.id, task: r.capsule.task, status: r.capsule.status } : undefined, actions: r.actions?.map(({ path, action }) => ({ path, action })) }; break; }
    case 'inbox': result = inbox(need(o, 'folder'), o['project-id']); break;
    case 'status': result = status(need(o, 'project')); break;
    case 'recover': result = recover(need(o, 'project')); break;
    case 'recover-send': result = recoverSend(need(o, 'project')); break;
    case 'doctor': result = doctor(); if (!result.ok) process.exitCode = 1; break;
    case 'demo': result = runDemo(o.folder); break;
    case 'help': case undefined: result = { usage: 'Use install/pngoung-capsule.sh cli COMMAND on macOS/Linux; install/pngoung-capsule.ps1 cli COMMAND on Windows', commands: ['init --project PATH --name NAME', 'track --project PATH --path relative/file.md (repeat --path)', 'send --project PATH --task task.json --outbox FOLDER [--sender ALIAS] [--final]', 'inspect --file FILE.capsule', 'inbox --folder FOLDER [--project-id UUID]', 'receive --project PATH --file FILE.capsule [--apply]', 'status --project PATH', 'recover --project PATH', 'recover-send --project PATH', 'demo', 'doctor'] }; break;
    default: throw new Error('Unknown command; run help');
  }
  console.log(JSON.stringify(result, null, 2));
} catch (e) { console.error(JSON.stringify({ ok: false, error: e.message })); process.exitCode = 1; }
