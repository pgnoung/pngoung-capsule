// Public GitHub bootstrap acceptance in disposable homes, pinned to a published commit.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const revision = process.env.GITHUB_SHA;
assert.match(revision ?? '', /^[a-f0-9]{40}$/, 'GITHUB_SHA must identify the published commit');
const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'capsule-bootstrap-'));
const win = process.platform === 'win32';
const app = path.join(scratch, 'app with spaces');
const scriptName = win ? 'get.ps1' : 'get.sh';
const script = path.join(scratch, scriptName);
const env = { ...process.env, PNGOUNG_CAPSULE_DIR: app, PNGOUNG_CAPSULE_HOME: path.join(scratch, 'data'), PNGOUNG_CAPSULE_USER_HOME: path.join(scratch, 'user'), PNGOUNG_CAPSULE_NO_START: '1', PNGOUNG_CAPSULE_FORCE_PORTABLE_NODE: '1', PNGOUNG_CAPSULE_ARCHIVE_URL: `https://codeload.github.com/pgnoung/pngoung-capsule/${win ? 'zip' : 'tar.gz'}/${revision}` };
const launch = () => spawnSync(win ? 'powershell.exe' : 'bash', win ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script] : [script], { env, cwd: scratch, encoding: 'utf8', timeout: 240000, maxBuffer: 2 * 1024 * 1024 });
try {
  const response = await fetch(`https://raw.githubusercontent.com/pgnoung/pngoung-capsule/${revision}/install/${scriptName}`, { signal: AbortSignal.timeout(30000) });
  assert.equal(response.ok, true, `Bootstrap HTTP ${response.status}`);
  fs.writeFileSync(script, Buffer.from(await response.arrayBuffer()));
  assert.deepEqual(fs.readFileSync(script), fs.readFileSync(path.join(source, 'install', scriptName)), 'Downloaded bootstrap must match this checkout');
  const result = launch();
  if (result.error || result.status !== 0) throw new Error(`Bootstrap failed: ${result.error?.message || result.stderr || result.stdout}`);
  for (const file of ['src/core.mjs', 'src/cli.mjs', 'skill/SKILL.md']) assert.deepEqual(fs.readFileSync(path.join(app, file)), fs.readFileSync(path.join(source, file)), `Installed ${file} must match the published revision`);
  for (const prefix of ['.agents', '.claude']) assert.equal(fs.existsSync(path.join(scratch, 'user', prefix, 'skills', 'pngoung-capsule', 'SKILL.md')), true);
  const node = path.join(app, '.runtime', 'node', ...(win ? ['node.exe'] : ['bin', 'node']));
  for (const command of ['doctor', 'demo']) {
    const args = [path.join(app, 'src', 'cli.mjs'), command, ...(command === 'demo' ? ['--folder', path.join(scratch, 'demo')] : [])];
    const check = spawnSync(node, args, { env, cwd: scratch, encoding: 'utf8', timeout: 30000 });
    assert.equal(check.error, undefined); assert.equal(check.status, 0, `${command}: ${check.stderr || check.stdout}`);
    assert.equal(JSON.parse(check.stdout).ok, true, command);
  }
  const canary = path.join(app, 'existing-user-file.txt');
  fs.writeFileSync(canary, 'preserve existing installation');
  const duplicate = launch();
  assert.equal(duplicate.error, undefined); assert.notEqual(duplicate.status, 0);
  assert.match(duplicate.stderr + duplicate.stdout, /Destination already exists/);
  assert.equal(fs.readFileSync(canary, 'utf8'), 'preserve existing installation');
  console.log(JSON.stringify({ ok: true, platform: process.platform, revision, publicBootstrap: true, privateRuntime: true, installedSkills: 2, existingDestinationPreserved: true, realAIAccounts: false }, null, 2));
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
