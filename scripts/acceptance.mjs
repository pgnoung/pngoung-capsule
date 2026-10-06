// Black-box acceptance through the actual OS installer and CLI, in disposable profiles.
// This verifies one host OS; it does not prove real AI accounts or separate devices.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'capsule-acceptance-'));
const app = path.join(scratch, 'app with spaces');
const win = process.platform === 'win32';
const privateNode = path.join(app, '.runtime', 'node', ...(win ? ['node.exe'] : ['bin', 'node']));
const digest = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
let calls = 0;
try {
  fs.mkdirSync(app);
  for (const dir of ['src', 'scripts', 'install', 'skill']) fs.cpSync(path.join(source, dir), path.join(app, dir), { recursive: true });
  fs.copyFileSync(path.join(source, 'package.json'), path.join(app, 'package.json'));
  const probe = path.join(scratch, 'runtime-probe.cjs');
  fs.writeFileSync(probe, `const fs = require('node:fs'); const path = require('node:path');
if (process.argv[1] && ['cli.mjs', 'setup.mjs'].includes(path.basename(process.argv[1]))) {
  fs.appendFileSync(process.env.PNGOUNG_CAPSULE_ACCEPTANCE_TRACE, JSON.stringify({ executable: process.execPath }) + '\\n');
}\n`);
  function run(profile, ...args) {
    const executable = win ? 'powershell.exe' : 'bash';
    const prefix = win ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(app, 'install', 'pngoung-capsule.ps1')] : [path.join(app, 'install', 'pngoung-capsule.sh')];
    const trace = path.join(scratch, `runtime-${calls}.jsonl`);
    const result = spawnSync(executable, [...prefix, ...args], {
      cwd: scratch, encoding: 'utf8', timeout: 180000, maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, NODE_OPTIONS: `--require ${JSON.stringify(probe.replaceAll('\\', '/'))}`, PNGOUNG_CAPSULE_ACCEPTANCE_TRACE: trace, PNGOUNG_CAPSULE_HOME: path.join(scratch, profile, 'data'), PNGOUNG_CAPSULE_USER_HOME: path.join(scratch, profile, 'user'), PNGOUNG_CAPSULE_FORCE_PORTABLE_NODE: '1' },
    });
    calls++;
    if (result.error || result.status !== 0) throw new Error(`Launcher ${args[0]} failed: ${result.error?.message || result.stderr || result.stdout}`);
    const observed = fs.readFileSync(trace, 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(observed.length, 1, 'Expected one application process per launcher call');
    const canonical = file => { const resolved = fs.realpathSync(file); return win ? resolved.toLowerCase() : resolved; };
    assert.equal(canonical(observed[0].executable), canonical(privateNode), 'Application must run in the downloaded private Node');
    const start = result.stdout.indexOf('{');
    if (start < 0) throw new Error('Launcher returned no JSON receipt');
    return JSON.parse(result.stdout.slice(start));
  }
  const projects = ['a', 'b', 'c'].map(n => path.join(scratch, `project ${n}`));
  for (const profile of ['a', 'b', 'c']) {
    assert.equal(run(profile, 'install').ok, true);
    assert.equal(run(profile, 'doctor').ok, true);
    for (const prefix of ['.agents', '.claude']) assert.equal(fs.existsSync(path.join(scratch, profile, 'user', prefix, 'skills', 'pngoung-capsule', 'SKILL.md')), true);
  }
  assert.equal(fs.existsSync(privateNode), true);
  const runtime = spawnSync(privateNode, ['-p', 'process.versions.node'], { encoding: 'utf8' });
  assert.equal(runtime.status, 0); assert.equal(Number(runtime.stdout.trim().split('.')[0]), 22);
  const relative = 'docs/แผนงาน.md', outbox = path.join(scratch, 'transfer'), taskFile = path.join(scratch, 'task.json');
  fs.mkdirSync(path.join(projects[0], 'docs'), { recursive: true });
  fs.writeFileSync(path.join(projects[0], relative), 'เริ่มที่ A\n');
  const untracked = 'untracked-note.md', canary = 'Synthetic note that must remain on A';
  fs.writeFileSync(path.join(projects[0], untracked), canary);
  const task = { goal: 'Complete a portable plan', doing: 'First draft', decided: 'One selected text file', pending: 'Review and finish', constraints: 'Disposable training data only', checks: 'Read current file' };
  fs.writeFileSync(taskFile, JSON.stringify(task));
  run('a', 'cli', 'init', '--project', projects[0], '--name', 'Acceptance project');
  run('a', 'cli', 'track', '--project', projects[0], '--path', relative);
  const send = (i, final = false) => run(['a', 'b', 'c'][i], 'cli', 'send', '--project', projects[i], '--task', taskFile, '--outbox', outbox, ...(final ? ['--final'] : []));
  let packet = send(0);
  for (const i of [1, 2, 0]) {
    const profile = ['a', 'b', 'c'][i];
    const inspected = run(profile, 'cli', 'inspect', '--file', packet.file);
    assert.equal(inspected.id, packet.id);
    assert.deepEqual(inspected.files.map(f => f.path), [relative]);
    assert.equal(run(profile, 'cli', 'receive', '--project', projects[i], '--file', packet.file).status, 'ready');
    const received = run(profile, 'cli', 'receive', '--project', projects[i], '--file', packet.file, '--apply');
    assert.equal(received.proof, 'destination-sha256-verified');
    assert.equal(digest(fs.readFileSync(path.join(projects[i], relative))), inspected.files[0].sha256);
    if (i !== 0) assert.equal(fs.existsSync(path.join(projects[i], untracked)), false);
    if (i !== 0) { fs.appendFileSync(path.join(projects[i], relative), `ต่อที่ ${profile.toUpperCase()}\n`); packet = send(i); }
  }
  assert.equal(fs.readFileSync(path.join(projects[0], relative), 'utf8'), 'เริ่มที่ A\nต่อที่ B\nต่อที่ C\n');
  assert.equal(fs.readFileSync(path.join(projects[0], untracked), 'utf8'), canary);
  fs.writeFileSync(taskFile, JSON.stringify({ ...task, doing: 'Completed', pending: '', checks: 'All three revisions received through launcher, hash and final content match' }));
  const final = send(0, true), state = run('a', 'cli', 'status', '--project', projects[0]);
  assert.equal(state.finalized, true); assert.equal(state.head, final.id); assert.equal(state.lineage.length, 4);
  assert.deepEqual(state.changed, []);
  console.log(JSON.stringify({ ok: true, platform: process.platform, architecture: process.arch, runtime: runtime.stdout.trim(), launcherCalls: calls, privateRuntimeVerifiedEveryCall: true, selectedFilesOnlyVerified: true, revisions: 4, journey: 'A → B → C → A → final', profiles: 3, proof: 'os-launcher-and-isolated-profile-acceptance', realDevices: false, realAIAccounts: false }, null, 2));
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
