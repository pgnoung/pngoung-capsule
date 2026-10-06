import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const VERSION = '1.0.0';
export const MAX_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 300;
const META = '.capsule-state';
const HASH = /^[a-f0-9]{64}$/;
const ID = /^[a-f0-9-]{36}$/;
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error(message); };
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const isObject = v => !!v && typeof v === 'object' && !Array.isArray(v);

export function safeRelative(rel) {
  if (typeof rel !== 'string' || !rel || rel.length > 220 || rel !== rel.normalize('NFC') || /[\\\x00-\x1f<>:"|?*]/.test(rel)) fail('Unsafe or non-portable file path');
  const parts = rel.split('/');
  if (parts.some(p => !p || p.startsWith('.') || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(p))) fail('Unsafe or non-portable file path');
  if (parts.some(p => /^(node_modules|vendor|credentials?|secrets?|id_rsa|id_ed25519|AGENTS\.md|CLAUDE\.md)$/i.test(p)) || /\.(env|pem|key|p12|pfx|db|sqlite|sqlite3|jsonl)$/i.test(rel)) fail('Private or executable agent-configuration path excluded');
  return rel;
}

export function assertNoLinks(file) {
  let current = path.parse(path.resolve(file)).root;
  for (const part of path.resolve(file).slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (fs.existsSync(current) || (() => { try { return fs.lstatSync(current).isSymbolicLink(); } catch { return false; } })()) {
      if (fs.lstatSync(current).isSymbolicLink()) {
        const systemAlias = process.platform === 'darwin' && ['/var', '/tmp', '/etc'].includes(current) && fs.realpathSync(current) === `/private${current}`;
        if (!systemAlias) fail('Symbolic links are not supported in capsule paths');
      }
    }
  }
}

function rootPath(root) {
  const p = path.resolve(root);
  // realpath of the parent handles the operating system's own temp-directory aliases.
  if (fs.existsSync(p) && fs.lstatSync(p).isSymbolicLink()) fail('Project root must not be a symbolic link');
  return fs.existsSync(p) ? fs.realpathSync(p) : path.join(fs.realpathSync(path.dirname(p)), path.basename(p));
}
const meta = (root, name) => path.join(root, META, name);
function checkedMeta(root) { assertNoLinks(path.join(root, META)); }
function targetPath(root, rel) {
  const p = path.join(root, safeRelative(rel));
  assertNoLinks(p);
  return p;
}
function privateDir(dir) { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); }
export function atomic(file, data) {
  assertNoLinks(file);
  privateDir(path.dirname(file));
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temp, data, { flag: 'wx', mode: 0o600 });
    fs.renameSync(temp, file);
  } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}
const writeJSON = (file, data) => atomic(file, `${JSON.stringify(data, null, 2)}\n`);

export function inspectText(bytes) {
  if (bytes.length > 2 * 1024 * 1024) fail('A file exceeds the 2 MiB limit');
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { fail('Version 1 accepts UTF-8 text files only'); }
  if (text.includes('\0')) fail('Binary files are not supported in version 1');
  const patterns = [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\b(?:sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{15,})\b/,
    /\bBearer\s+[A-Za-z0-9._~+/-]{16,}/i,
    /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|client[_-]?secret)\s*["']?\s*[:=]\s*["']?[^\s"',;]{8,}/i,
    /[a-z]+:\/\/[^\s/@]+:[^\s/@]+@/i,
    /\bAIza[A-Za-z0-9_-]{35}\b/,
    /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/]+/i,
  ];
  if (patterns.some(re => re.test(text))) fail('Possible credential found; remove it before exporting (value not displayed)');
  return text;
}

function state(root) {
  checkedMeta(root);
  const s = json(meta(root, 'state.json'));
  if (s.schema !== 1 || !ID.test(s.projectId) || !Array.isArray(s.tracked) || !Array.isArray(s.lineage) || !isObject(s.baseline)) fail('Invalid local project state');
  if (s.head !== (s.lineage.at(-1) || null) || new Set(s.lineage).size !== s.lineage.length || s.lineage.some(id => !HASH.test(id))) fail('Invalid local lineage');
  for (const f of s.tracked) safeRelative(f);
  for (const [f, sha] of Object.entries(s.baseline)) { safeRelative(f); if (!HASH.test(sha)) fail('Invalid local baseline'); }
  return s;
}

function lock(root, work, allowPending = false) {
  checkedMeta(root);
  privateDir(path.join(root, META));
  const dir = meta(root, 'lock');
  try { fs.mkdirSync(dir); } catch { fail('Project is busy or has an interrupted operation. Run doctor; do not remove a live lock.'); }
  try {
    if (!allowPending && fs.existsSync(meta(root, 'pending.json'))) fail('Interrupted receive detected. Run recover before continuing.');
    if (!allowPending && fs.existsSync(meta(root, 'pending-send.json'))) fail('Interrupted send detected. Run recover-send before continuing.');
    return work();
  } finally { fs.rmdirSync(dir); }
}

export function initProject(root, name) {
  if (typeof name !== 'string' || !name.trim() || name.length > 120) fail('Provide a project name (1–120 characters)');
  privateDir(path.resolve(root));
  root = rootPath(root);
  return lock(root, () => {
    if (fs.existsSync(meta(root, 'state.json'))) return state(root);
    const s = { schema: 1, projectId: randomUUID(), name, tracked: [], baseline: {}, lineage: [], head: null, finalized: false };
    writeJSON(meta(root, 'state.json'), s);
    return s;
  });
}

function readFile(root, rel) {
  const p = targetPath(root, rel);
  if (!fs.existsSync(p)) return null;
  if (!fs.statSync(p).isFile()) fail('Selected path must be a regular file');
  if (fs.statSync(p).size > 2 * 1024 * 1024) fail('A file exceeds the 2 MiB limit');
  const bytes = fs.readFileSync(p);
  inspectText(bytes);
  return { path: rel, sha256: hash(bytes), content: bytes.toString('base64') };
}

export function track(root, files) {
  root = rootPath(root);
  return lock(root, () => {
    const s = state(root);
    if (s.finalized) fail('Project is finalized; start a new project for new work');
    const next = [...new Set([...s.tracked, ...files.map(safeRelative)])].sort();
    if (next.length > MAX_FILES || new Set(next.map(f => f.toLowerCase())).size !== next.length) fail('Too many files or case-insensitive path collision');
    for (const f of files) if (!readFile(root, f)) fail(`File not found: ${f}`);
    s.tracked = next;
    writeJSON(meta(root, 'state.json'), s);
    return { tracked: next };
  });
}

export function validateTask(task, final = false) {
  if (!isObject(task)) fail('Task must be an object');
  const keys = ['goal', 'doing', 'decided', 'pending', 'constraints', 'checks'];
  if (Object.keys(task).some(k => !keys.includes(k))) fail('Unknown task field');
  for (const k of keys) {
    if (typeof task[k] !== 'string' || task[k].length > 12000) fail(`Task field ${k} must be text (up to 12000 characters)`);
    inspectText(Buffer.from(task[k]));
  }
  if (!task.goal.trim() || !task.doing.trim()) fail('Goal and current work are required');
  if (final && (task.pending.trim() || !task.checks.trim())) fail('Final requires empty pending and recorded validation evidence');
  return Object.fromEntries(keys.map(k => [k, task[k]]));
}

function canonicalBody(c) {
  return { format: 'pngoung-capsule', schema: 1, projectId: c.projectId, name: c.name, parent: c.parent, ancestors: c.ancestors, createdAt: c.createdAt, sender: c.sender, status: c.status, task: c.task, files: c.files };
}

export function validateCapsule(input) {
  if (!isObject(input) || input.format !== 'pngoung-capsule' || input.schema !== 1) fail('Unsupported capsule format');
  if (!ID.test(input.projectId) || !HASH.test(input.id)) fail('Invalid capsule identity');
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 120 || typeof input.sender !== 'string' || input.sender.length > 80) fail('Invalid project name or sender alias');
  inspectText(Buffer.from(`${input.name}\n${input.sender}`));
  if (!Array.isArray(input.ancestors) || input.ancestors.length > 1000 || input.ancestors.some(h => !HASH.test(h)) || new Set(input.ancestors).size !== input.ancestors.length) fail('Invalid capsule ancestry');
  if (input.parent !== (input.ancestors.at(-1) || null) || input.ancestors.includes(input.id)) fail('Invalid capsule parent');
  if (!['handoff', 'final'].includes(input.status) || !Number.isFinite(Date.parse(input.createdAt))) fail('Invalid capsule status or date');
  const task = validateTask(input.task, input.status === 'final');
  if (!Array.isArray(input.files) || input.files.length > MAX_FILES) fail('Invalid capsule files');
  const paths = new Set(); let size = 0;
  const files = input.files.map(f => {
    if (!isObject(f)) fail('Invalid file entry');
    safeRelative(f.path);
    const key = f.path.toLowerCase();
    if (paths.has(key) || [...paths].some(p => p.startsWith(`${key}/`) || key.startsWith(`${p}/`))) fail('File path collision');
    paths.add(key);
    if (!HASH.test(f.sha256) || typeof f.content !== 'string' || f.content.length > 3 * 1024 * 1024) fail('Invalid file hash or content');
    const bytes = Buffer.from(f.content, 'base64');
    if (bytes.toString('base64') !== f.content || hash(bytes) !== f.sha256) fail('File content checksum mismatch');
    size += bytes.length;
    if (size > MAX_BYTES) fail('Capsule exceeds the total file limit');
    inspectText(bytes);
    return { path: f.path, sha256: f.sha256, content: f.content };
  });
  const body = canonicalBody({ ...input, task, files });
  if (hash(JSON.stringify(body)) !== input.id) fail('Capsule checksum mismatch');
  return { ...body, id: input.id };
}

export function loadCapsule(file) {
  if (!fs.statSync(file).isFile() || fs.statSync(file).size > MAX_BYTES * 2) fail('Capsule file is too large');
  return validateCapsule(json(file));
}

export function send(root, { task, outbox, sender = 'my-device', final = false }) {
  root = rootPath(root);
  return lock(root, () => {
    const s = state(root);
    if (s.finalized) fail('Project is already finalized');
    const body = canonicalBody({ projectId: s.projectId, name: s.name, parent: s.head, ancestors: s.lineage, createdAt: new Date().toISOString(), sender, status: final ? 'final' : 'handoff', task: validateTask(task, final), files: s.tracked.map(f => readFile(root, f)).filter(Boolean) });
    const c = validateCapsule({ ...body, id: hash(JSON.stringify(body)) });
    const packetName = `${s.projectId}-${c.id}.capsule`;
    assertNoLinks(path.resolve(outbox));
    const destination = rootPath(outbox);
    if (destination === root || destination.startsWith(root + path.sep)) fail('Outbox must be outside the project; select a separate transfer folder');
    privateDir(destination); assertNoLinks(fs.realpathSync(destination));
    const file = path.join(destination, packetName);
    writeJSON(meta(root, 'pending-send.json'), { schema: 1, capsule: c, file, oldHead: s.head });
    try { return finishSend(root); }
    catch (error) { throw new Error(`Send interrupted; retry the same packet with recover-send. ${error.message}`); }
  });
}

function finishSend(root) {
  const journal = json(meta(root, 'pending-send.json'));
  if (journal.schema !== 1 || typeof journal.file !== 'string' || !path.isAbsolute(journal.file)) fail('Invalid send journal');
  const c = validateCapsule(journal.capsule), s = state(root);
  if (s.projectId !== c.projectId || ![journal.oldHead, c.id].includes(s.head)) fail('Project advanced outside the pending send; preserve the journal');
  if (fs.existsSync(journal.file)) {
    if (loadCapsule(journal.file).id !== c.id) fail('Outbox file changed after send');
  } else atomic(journal.file, JSON.stringify(c));
  const verified = loadCapsule(journal.file);
  writeJSON(meta(root, 'last-capsule.json'), c);
  writeJSON(meta(root, 'state.json'), { ...s, baseline: Object.fromEntries(c.files.map(f => [f.path, f.sha256])), tracked: c.files.map(f => f.path), lineage: [...c.ancestors, c.id], head: c.id, finalized: c.status === 'final' });
  fs.unlinkSync(meta(root, 'pending-send.json'));
  return { file: journal.file, id: verified.id, projectId: s.projectId, files: c.files.length, status: c.status, proof: 'local-file-readback', reminder: 'This proves this folder has the file. Another device must verify its own copy.' };
}

export function recoverSend(root) {
  root = rootPath(root);
  return lock(root, () => {
    if (fs.existsSync(meta(root, 'pending.json'))) fail('Recover the interrupted receive first');
    if (!fs.existsSync(meta(root, 'pending-send.json'))) return { status: 'nothing-to-recover' };
    return finishSend(root);
  }, true);
}

export function inbox(folder, projectId) {
  const rows = [];
  const seen = new Set();
  for (const name of fs.readdirSync(folder).filter(n => n.endsWith('.capsule'))) {
    const c = loadCapsule(path.join(folder, name));
    if ((!projectId || c.projectId === projectId) && !seen.has(c.id)) { rows.push({ ...c, file: path.join(folder, name) }); seen.add(c.id); }
  }
  const heads = rows.filter(c => !rows.some(other => other.ancestors.includes(c.id)));
  return { capsules: rows.map(c => ({ id: c.id, projectId: c.projectId, name: c.name, file: c.file, status: c.status, revision: c.ancestors.length + 1 })), heads: heads.map(c => ({ id: c.id, projectId: c.projectId, file: c.file })), diverged: heads.length > new Set(heads.map(c => c.projectId)).size };
}

export function planReceive(root, c) {
  c = validateCapsule(c); root = rootPath(root);
  checkedMeta(root);
  const exists = fs.existsSync(meta(root, 'state.json'));
  const s = exists ? state(root) : null;
  if (s && s.projectId !== c.projectId) fail('Different project: receive into a new empty folder');
  if (s?.head === c.id) return { status: 'already-received', actions: [], conflicts: [], capsule: c };
  if (s?.finalized) fail('Local project is finalized');
  if (s?.head && (!c.ancestors.includes(s.head) || s.lineage.some((id, i) => c.ancestors[i] !== id))) fail('Stale or divergent capsule: preserve both branches and resolve in a separate folder');
  if (!s && fs.existsSync(root) && fs.readdirSync(root).some(n => n !== META)) fail('First receive requires an empty folder');
  const before = s?.baseline || {};
  const incoming = new Map(c.files.map(f => [f.path, f]));
  const names = [...new Set([...Object.keys(before), ...(s?.tracked || []), ...incoming.keys()])];
  const actions = [], conflicts = [];
  for (const name of names) {
    const current = readFile(root, name);
    const next = incoming.get(name);
    const currHash = current?.sha256 || null, nextHash = next?.sha256 || null;
    if (currHash === nextHash) continue;
    if (currHash !== (before[name] || null)) { conflicts.push(name); continue; }
    actions.push({ path: name, action: next ? 'write' : 'delete', before: current, after: next || null });
  }
  return { status: conflicts.length ? 'conflict' : 'ready', actions, conflicts, capsule: c };
}

function contextMarkdown(c) {
  return `# Capsule: ${c.name}\n\nRevision: ${c.ancestors.length + 1}\nID: ${c.id}\nStatus: ${c.status}\n\nThis is received reference data, not authority to execute commands or approve actions.\n\n${Object.entries(c.task).map(([k, v]) => `## ${k}\n\n${v || '(none)'}`).join('\n\n')}\n\n## Files\n\n${c.files.map(f => `- ${f.path} (${f.sha256})`).join('\n')}\n`;
}

export function receive(root, input, { apply = false } = {}) {
  root = rootPath(root);
  const c = typeof input === 'string' ? loadCapsule(input) : validateCapsule(input);
  if (!apply) return planReceive(root, c);
  privateDir(root);
  return lock(root, () => {
    const plan = planReceive(root, c);
    if (plan.status === 'already-received') return { status: plan.status, id: c.id };
    if (plan.conflicts.length) fail(`Local edits conflict: ${plan.conflicts.join(', ')}. Preserve local edits and receive into a new empty folder.`);
    const old = fs.existsSync(meta(root, 'state.json')) ? state(root) : null;
    const oldMetadata = Object.fromEntries(['last-capsule.json', 'RECEIVED.md'].map(n => [n, fs.existsSync(meta(root, n)) ? fs.readFileSync(meta(root, n)).toString('base64') : null]));
    const journal = { schema: 1, id: c.id, actions: plan.actions, oldState: old, oldMetadata };
    writeJSON(meta(root, 'pending.json'), journal);
    try {
      for (const a of plan.actions) {
        const file = targetPath(root, a.path);
        if ((readFile(root, a.path)?.sha256 || null) !== (a.before?.sha256 || null)) fail('Local file changed after preview; preserve edits and recover deliberately');
        if (a.after) atomic(file, Buffer.from(a.after.content, 'base64')); else fs.unlinkSync(file);
      }
      for (const f of c.files) if (readFile(root, f.path)?.sha256 !== f.sha256) fail('Received file verification failed');
      const next = { schema: 1, projectId: c.projectId, name: c.name, tracked: c.files.map(f => f.path), baseline: Object.fromEntries(c.files.map(f => [f.path, f.sha256])), lineage: [...c.ancestors, c.id], head: c.id, finalized: c.status === 'final' };
      writeJSON(meta(root, 'last-capsule.json'), c);
      atomic(meta(root, 'RECEIVED.md'), contextMarkdown(c));
      writeJSON(meta(root, 'state.json'), next);
      fs.unlinkSync(meta(root, 'pending.json'));
      return { status: 'received', id: c.id, files: c.files.length, proof: 'destination-sha256-verified', context: meta(root, 'RECEIVED.md') };
    } catch (error) { throw new Error(`Receive interrupted; pending journal retained. Run recover. ${error.message}`); }
  });
}

export function recover(root) {
  root = rootPath(root);
  return lock(root, () => {
    const file = meta(root, 'pending.json');
    if (!fs.existsSync(file)) return { status: 'nothing-to-recover' };
    const j = json(file);
    if (j.schema !== 1 || !Array.isArray(j.actions)) fail('Invalid recovery journal');
    for (const a of j.actions) {
      const cur = readFile(root, a.path)?.sha256 || null;
      if (cur !== (a.before?.sha256 || null) && cur !== (a.after?.sha256 || null)) fail('Files changed after interruption; preserve and recover manually');
      if (a.before && hash(Buffer.from(a.before.content, 'base64')) !== a.before.sha256) fail('Recovery backup checksum mismatch');
    }
    for (const a of j.actions) {
      const p = targetPath(root, a.path);
      if (a.before) atomic(p, Buffer.from(a.before.content, 'base64')); else if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    if (j.oldState) writeJSON(meta(root, 'state.json'), j.oldState);
    else if (fs.existsSync(meta(root, 'state.json'))) fs.unlinkSync(meta(root, 'state.json'));
    for (const n of ['last-capsule.json', 'RECEIVED.md']) {
      if (j.oldMetadata?.[n]) atomic(meta(root, n), Buffer.from(j.oldMetadata[n], 'base64'));
      else if (fs.existsSync(meta(root, n))) fs.unlinkSync(meta(root, n));
    }
    fs.unlinkSync(file);
    return { status: 'recovered', note: 'Previous files restored. Preview the capsule again before receiving.' };
  }, true);
}

export function status(root) {
  root = rootPath(root); const s = state(root);
  const changed = s.tracked.filter(f => (readFile(root, f)?.sha256 || null) !== (s.baseline[f] || null));
  return { ...s, changed, recoveryRequired: fs.existsSync(meta(root, 'pending.json')), sendRecoveryRequired: fs.existsSync(meta(root, 'pending-send.json')), locked: fs.existsSync(meta(root, 'lock')) };
}
