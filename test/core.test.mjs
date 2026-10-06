import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initProject, track, send, receive, status, inbox, safeRelative, validateCapsule, loadCapsule, hash, recover, recoverSend } from '../src/core.mjs';
import { runDemo } from '../src/demo.mjs';

const task = { goal: 'Write a plan', doing: 'Draft ready', decided: 'Three steps', pending: 'Review', constraints: 'Local test', checks: 'Opened draft' };
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'capsule-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const a = path.join(dir, 'a'), b = path.join(dir, 'b'), outbox = path.join(dir, 'transfer');
  fs.mkdirSync(a); fs.writeFileSync(path.join(a, 'work.md'), 'hello\n');
  initProject(a, 'Test'); track(a, ['work.md']);
  const packet = () => send(a, { task, outbox });
  return { dir, a, b, outbox, packet };
}
test('four revisions return to original device and finalize', t => {
  const f = fixture(t), d = runDemo(f.dir);
  assert.equal(d.ok, true); assert.equal(d.revision, 4);
  assert.equal(status(path.join(d.root, 'device-a')).finalized, true);
});
test('receive previews without creating destination, then verifies and is idempotent', t => {
  const { a, b, packet } = fixture(t), p = packet();
  assert.equal(receive(b, p.file).status, 'ready'); assert.equal(fs.existsSync(b), false);
  assert.equal(receive(b, p.file, { apply: true }).proof, 'destination-sha256-verified');
  assert.equal(fs.readFileSync(path.join(a, 'work.md'), 'utf8'), fs.readFileSync(path.join(b, 'work.md'), 'utf8'));
  assert.equal(receive(b, p.file, { apply: true }).status, 'already-received');
});
test('round-trip detects local edits rather than overwriting', t => {
  const { a, b, outbox, packet } = fixture(t), p = packet(); receive(b, p.file, { apply: true });
  fs.writeFileSync(path.join(b, 'work.md'), 'B edit'); const next = send(b, { task, outbox });
  fs.writeFileSync(path.join(a, 'work.md'), 'A edit');
  assert.deepEqual(receive(a, next.file).conflicts, ['work.md']);
  assert.throws(() => receive(a, next.file, { apply: true }), /conflict/);
  assert.equal(fs.readFileSync(path.join(a, 'work.md'), 'utf8'), 'A edit');
});
test('stale and divergent branches are refused and exposed by inbox', t => {
  const { a, b, outbox, packet } = fixture(t), p = packet(); receive(b, p.file, { apply: true });
  fs.appendFileSync(path.join(a, 'work.md'), 'A'); const pa = packet();
  fs.appendFileSync(path.join(b, 'work.md'), 'B'); const pb = send(b, { task, outbox });
  assert.throws(() => receive(a, pb.file), /divergent/);
  assert.throws(() => receive(a, p.file), /Stale/);
  assert.equal(inbox(outbox).diverged, true);
  assert.notEqual(pa.id, pb.id);
});
test('sync copies of an identical packet do not create false divergent heads', t => {
  const { outbox, packet } = fixture(t), p = packet();
  fs.copyFileSync(p.file, path.join(outbox, 'sync-conflict-copy.capsule'));
  const result = inbox(outbox);
  assert.equal(result.diverged, false); assert.equal(result.heads.length, 1); assert.equal(result.capsules.length, 1);
});
test('only tracked files travel; deletions propagate only when baseline unchanged', t => {
  const { a, b, outbox, packet } = fixture(t); fs.writeFileSync(path.join(a, 'personal.txt'), 'private note');
  const p = packet(); receive(b, p.file, { apply: true });
  assert.equal(fs.existsSync(path.join(b, 'personal.txt')), false);
  fs.unlinkSync(path.join(b, 'work.md')); const next = send(b, { task, outbox });
  const plan = receive(a, next.file); assert.equal(plan.actions[0].action, 'delete');
  receive(a, next.file, { apply: true });
  assert.equal(fs.existsSync(path.join(a, 'work.md')), false);
  assert.equal(fs.readFileSync(path.join(a, 'personal.txt'), 'utf8'), 'private note');
});
test('first receive refuses non-empty folders and mismatched projects', t => {
  const { a, b, packet } = fixture(t), p = packet();
  fs.mkdirSync(b); fs.writeFileSync(path.join(b, 'keep.txt'), 'keep');
  assert.throws(() => receive(b, p.file, { apply: true }), /empty/);
  initProject(b, 'Another'); assert.throws(() => receive(b, p.file), /Different project/);
  assert.equal(status(a).head, p.id);
});
test('reject traversal, reserved Windows paths, private files, agent instruction paths', () => {
  for (const p of ['../a', '/etc/a', 'C:/x', 'a\\b', 'a/../b', 'a//b', 'CON.txt', 'a/aux', 'a.txt.', '.env', 'a/.git/config', 'AGENTS.md', 'a/CLAUDE.md', 'id_rsa', 'a.key']) assert.throws(() => safeRelative(p));
  assert.equal(safeRelative('docs/แผนงาน.md'), 'docs/แผนงาน.md');
});
test('tampering with content or metadata is caught', t => {
  const { packet } = fixture(t), c = loadCapsule(packet().file);
  assert.throws(() => validateCapsule({ ...c, name: 'Changed' }), /checksum/);
  const bad = structuredClone(c); bad.files[0].content = Buffer.from('modified').toString('base64');
  assert.throws(() => validateCapsule(bad), /checksum/);
});
test('credentials in files or summaries and binary files cannot export', t => {
  const { a, outbox, packet } = fixture(t);
  const fake = 'sk-' + 'x'.repeat(32);
  fs.writeFileSync(path.join(a, 'work.md'), fake); assert.throws(packet, /credential/);
  fs.writeFileSync(path.join(a, 'work.md'), Buffer.from([0, 1, 2])); assert.throws(packet, /Binary/);
  fs.writeFileSync(path.join(a, 'work.md'), 'safe');
  assert.throws(() => send(a, { task: { ...task, doing: fake }, outbox }), /credential/);
});
test('file size and case collisions refused', t => {
  const { a, packet } = fixture(t);
  assert.throws(() => track(a, ['WORK.md']), /collision/);
  fs.writeFileSync(path.join(a, 'work.md'), 'x'.repeat(2 * 1024 * 1024 + 1)); assert.throws(packet, /limit/);
});
test('symbolic links cannot be tracked or used on receive', { skip: process.platform === 'win32' }, t => {
  const { dir, a, b, packet } = fixture(t);
  fs.writeFileSync(path.join(dir, 'private.txt'), 'secret'); fs.symlinkSync(path.join(dir, 'private.txt'), path.join(a, 'link.txt'));
  assert.throws(() => track(a, ['link.txt']), /Symbolic/);
  const p = packet(); receive(b, p.file, { apply: true });
  fs.unlinkSync(path.join(b, 'work.md')); fs.symlinkSync(path.join(dir, 'private.txt'), path.join(b, 'work.md'));
  fs.appendFileSync(path.join(a, 'work.md'), 'new'); const next = packet();
  assert.throws(() => receive(b, next.file), /Symbolic/);
});
test('final requires no pending work and validation evidence; finalized work cannot send', t => {
  const { a, outbox } = fixture(t);
  assert.throws(() => send(a, { task, outbox, final: true }), /Final requires/);
  assert.throws(() => send(a, { task: { ...task, pending: '', checks: '' }, outbox, final: true }), /Final requires/);
  send(a, { task: { ...task, pending: '' }, outbox, final: true });
  assert.throws(() => send(a, { task, outbox }), /finalized/);
});
test('write lock prevents simultaneous local operations', t => {
  const { a, packet } = fixture(t);
  fs.mkdirSync(path.join(a, '.capsule-state', 'lock'));
  assert.throws(packet, /busy/); assert.equal(status(a).locked, true);
});
test('interrupted receive can recover original bytes without losing unrelated files', t => {
  const { a, b, outbox, packet } = fixture(t); receive(b, packet().file, { apply: true });
  fs.writeFileSync(path.join(b, 'work.md'), 'new'); const p = send(b, { task, outbox });
  const original = fs.renameSync;
  fs.renameSync = (from, to) => { if (to === path.join(fs.realpathSync(a), '.capsule-state', 'RECEIVED.md')) throw new Error('injected write failure'); return original(from, to); };
  try { assert.throws(() => receive(a, p.file, { apply: true }), /interrupted/); } finally { fs.renameSync = original; }
  assert.equal(status(a).recoveryRequired, true);
  assert.equal(recover(a).status, 'recovered');
  assert.equal(fs.readFileSync(path.join(a, 'work.md'), 'utf8'), 'hello\n');
  assert.equal(receive(a, p.file, { apply: true }).status, 'received');
});
test('untracked destination file cannot be silently replaced', t => {
  const { a, b, outbox, packet } = fixture(t); receive(b, packet().file, { apply: true });
  fs.writeFileSync(path.join(b, 'new.md'), 'from B'); track(b, ['new.md']);
  const p = send(b, { task, outbox }); fs.writeFileSync(path.join(a, 'new.md'), 'local unrelated');
  assert.deepEqual(receive(a, p.file).conflicts, ['new.md']);
});
test('outbox inside project rejected without changing lineage', t => {
  const { a } = fixture(t);
  assert.throws(() => send(a, { task, outbox: path.join(a, 'out') }), /outside/);
  assert.equal(status(a).head, null);
});
test('interrupted send resumes the same capsule without a sibling branch', t => {
  const { a, outbox, packet } = fixture(t), original = fs.renameSync;
  fs.renameSync = (from, to) => { if (to === path.join(fs.realpathSync(a), '.capsule-state', 'state.json')) throw new Error('injected state failure'); return original(from, to); };
  try { assert.throws(packet, /recover-send/); } finally { fs.renameSync = original; }
  assert.equal(status(a).sendRecoveryRequired, true);
  assert.throws(packet, /recover-send/);
  const first = inbox(outbox).heads[0].id, resumed = recoverSend(a);
  assert.equal(resumed.id, first); assert.equal(status(a).head, first);
  assert.equal(status(a).sendRecoveryRequired, false);
  assert.equal(inbox(outbox).capsules.length, 1);
  packet(); assert.equal(inbox(outbox).diverged, false);
});
test('an editor changing a file after receive preflight is preserved', t => {
  const { a, b, outbox, packet } = fixture(t); receive(b, packet().file, { apply: true });
  fs.writeFileSync(path.join(b, 'work.md'), 'incoming'); const p = send(b, { task, outbox });
  const original = fs.renameSync;
  fs.renameSync = (from, to) => { const r = original(from, to); if (to === path.join(fs.realpathSync(a), '.capsule-state', 'pending.json')) fs.writeFileSync(path.join(a, 'work.md'), 'editor autosave'); return r; };
  try { assert.throws(() => receive(a, p.file, { apply: true }), /changed after preview/); } finally { fs.renameSync = original; }
  assert.equal(fs.readFileSync(path.join(a, 'work.md'), 'utf8'), 'editor autosave');
  assert.throws(() => recover(a), /recover manually/);
});
test('receive recovery restores the preceding context and receipt', t => {
  const { a, b, outbox, packet } = fixture(t); receive(b, packet().file, { apply: true });
  const before = Object.fromEntries(['RECEIVED.md', 'last-capsule.json'].map(n => [n, fs.readFileSync(path.join(b, '.capsule-state', n), 'utf8')]));
  fs.writeFileSync(path.join(a, 'work.md'), 'incoming'); const p = send(a, { task, outbox });
  const original = fs.renameSync;
  fs.renameSync = (from, to) => { if (to === path.join(fs.realpathSync(b), '.capsule-state', 'state.json')) throw new Error('injected state failure'); return original(from, to); };
  try { assert.throws(() => receive(b, p.file, { apply: true }), /interrupted/); } finally { fs.renameSync = original; }
  recover(b);
  for (const [n, value] of Object.entries(before)) assert.equal(fs.readFileSync(path.join(b, '.capsule-state', n), 'utf8'), value);
});
test('known Google keys and Slack webhooks are refused', t => {
  const { a, packet } = fixture(t);
  for (const value of ['AI' + 'za' + 'x'.repeat(35), 'https://hooks.' + 'slack.com/services/' + 'T' + 'x'.repeat(8) + '/B12345678/abcdefghijklmnopqrstuvwxyz']) {
    fs.writeFileSync(path.join(a, 'work.md'), value); assert.throws(packet, /credential/);
  }
});
