import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomic, VERSION, assertNoLinks, hash } from './core.mjs';

// PowerShell and Node may enter the same installation through long or 8.3 paths.
export const appRoot = fs.realpathSync.native(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
export const appHome = () => path.resolve(process.env.PNGOUNG_CAPSULE_HOME || path.join(os.homedir(), '.pngoung-capsule'));
export const skillsHome = () => path.resolve(process.env.PNGOUNG_CAPSULE_USER_HOME || os.homedir());
const skillSource = () => fs.existsSync(path.join(appRoot, 'skill', 'SKILL.md')) ? path.join(appRoot, 'skill') : path.join(appRoot, '.agents', 'skills', 'pngoung-capsule');
export function installSkills() {
  const from = skillSource();
  const source = fs.readFileSync(path.join(from, 'SKILL.md'), 'utf8');
  const installed = [];
  for (const prefix of ['.agents', '.claude']) {
    const dir = path.join(skillsHome(), prefix, 'skills', 'pngoung-capsule');
    assertNoLinks(dir);
    const manifest = path.join(dir, 'CAPSULE_APP.json');
    if (fs.existsSync(dir) && fs.readdirSync(dir).length && (!fs.existsSync(manifest) || JSON.parse(fs.readFileSync(manifest, 'utf8')).owner !== 'pngoung-capsule')) throw new Error('An existing skill with this name is not managed by this installer; preserve it and choose a separate user profile');
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    atomic(path.join(dir, 'SKILL.md'), source);
    if (fs.existsSync(path.join(from, 'references'))) {
      for (const name of fs.readdirSync(path.join(from, 'references'))) {
        if (!/^[a-z-]+\.md$/.test(name)) continue;
        atomic(path.join(dir, 'references', name), fs.readFileSync(path.join(from, 'references', name)));
      }
    }
    atomic(manifest, JSON.stringify({ owner: 'pngoung-capsule', version: VERSION, appRoot }, null, 2));
    installed.push(dir);
  }
  return installed;
}
export function doctor() {
  const checks = [
    { name: 'Node.js 22+', ok: Number(process.versions.node.split('.')[0]) >= 22, fix: 'Run the installer again' },
    ...['.agents', '.claude'].map(prefix => {
      const dir = path.join(skillsHome(), prefix, 'skills', 'pngoung-capsule');
      let ok = false;
      try {
        const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'CAPSULE_APP.json'), 'utf8'));
        const from = skillSource();
        const files = ['SKILL.md', ...fs.readdirSync(path.join(from, 'references')).filter(n => /^[a-z-]+\.md$/.test(n)).map(n => `references/${n}`)];
        ok = manifest.owner === 'pngoung-capsule' && manifest.version === VERSION && manifest.appRoot === appRoot && files.every(f => hash(fs.readFileSync(path.join(dir, f))) === hash(fs.readFileSync(path.join(from, f))));
      } catch {}
      return { name: `${prefix} skill`, ok, fix: 'Run install again; restart the agent to refresh skill discovery' };
    }),
    { name: 'Local setup', ok: (() => { try { const s = JSON.parse(fs.readFileSync(path.join(appHome(), 'setup.json'), 'utf8')); return s.version === VERSION && Number.isFinite(Date.parse(s.installedAt)); } catch { return false; } })(), fix: 'Run install again' },
  ];
  return { app: 'pngoung-capsule', version: VERSION, ok: checks.every(c => c.ok), checks, scope: 'local-runtime-and-skill-files', agentDiscovery: 'requires-agent-session-check', crossDevice: 'requires-second-device-readback', platform: process.platform };
}
