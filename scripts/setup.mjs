import fs from 'node:fs';
import path from 'node:path';
import { atomic, VERSION } from '../src/core.mjs';
import { appHome, installSkills, doctor } from '../src/local.mjs';
import { runDemo } from '../src/demo.mjs';

const installed = installSkills();
const home = appHome();
fs.mkdirSync(home, { recursive: true, mode: 0o700 });
const demoFile = path.join(home, 'demo.json');
let demo = null;
if (!fs.existsSync(demoFile)) { demo = runDemo(path.join(home, 'practice')); atomic(demoFile, JSON.stringify(demo, null, 2)); }
atomic(path.join(home, 'setup.json'), JSON.stringify({ version: VERSION, installedAt: new Date().toISOString() }, null, 2));
const result = doctor();
console.log(JSON.stringify({ ...result, installed, demo: demo?.proof || 'previous-demo-retained', next: 'Open the welcome page or ask your agent to use pngoung-capsule. Restart the agent if the skill is not listed.' }, null, 2));
if (!result.ok) process.exitCode = 1;
