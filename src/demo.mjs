import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initProject, track, send, receive, status, hash } from './core.mjs';

export function runDemo(parent = os.tmpdir()) {
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, 'capsule-demo-'));
  const devices = ['device-a', 'device-b', 'device-c'].map(n => path.join(root, n));
  const outbox = path.join(root, 'transfer');
  fs.mkdirSync(devices[0]);
  fs.writeFileSync(path.join(devices[0], 'work.md'), '# Project\nFirst draft\n');
  initProject(devices[0], 'My class project');
  track(devices[0], ['work.md']);
  const task = { goal: 'Complete a three-step plan', doing: 'First draft completed', decided: 'Use three steps', pending: 'Add review and checklist', constraints: 'Use only the training project', checks: 'Opened work.md' };
  const receipts = [];
  let packet = send(devices[0], { task, outbox, sender: 'agent-a' });
  receipts.push(packet);
  receipts.push(receive(devices[1], packet.file, { apply: true }));
  fs.appendFileSync(path.join(devices[1], 'work.md'), '\nReviewed on device B\n');
  packet = send(devices[1], { task: { ...task, doing: 'Review completed', pending: 'Add checklist' }, outbox, sender: 'agent-b' });
  receipts.push(packet);
  receipts.push(receive(devices[2], packet.file, { apply: true }));
  fs.appendFileSync(path.join(devices[2], 'work.md'), '\n- [x] Draft\n- [x] Review\n- [x] Checklist\n');
  packet = send(devices[2], { task: { ...task, doing: 'Checklist completed', pending: 'Final check on device A' }, outbox, sender: 'agent-c' });
  receipts.push(packet);
  receipts.push(receive(devices[0], packet.file, { apply: true }));
  const a = fs.readFileSync(path.join(devices[0], 'work.md'));
  const c = fs.readFileSync(path.join(devices[2], 'work.md'));
  if (hash(a) !== hash(c)) throw new Error('Round-trip verification failed');
  receipts.push(send(devices[0], { task: { ...task, doing: 'Completed', pending: '', checks: 'A and C file SHA-256 match; draft, review and checklist present' }, outbox, sender: 'agent-a', final: true }));
  return { ok: true, root, journey: 'A → B → C → A → final', proof: 'isolated-folder-simulation', realCrossDeviceTest: false, revision: status(devices[0]).lineage.length, receipts };
}
