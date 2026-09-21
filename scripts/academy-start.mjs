import { execFileSync, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAcademyStartReceipt, TRACK_DOCS } from '../src/academy/start-gate.mjs';
import { installAcademyStarterKit } from '../src/academy/starter-kit.mjs';

const coreRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const argv = process.argv.slice(2);
const value = name => { const i = argv.indexOf(name); return i < 0 ? null : argv[i + 1] ?? null; };
const task = value('--task');
const track = value('--track') ?? 'development';
const root = resolve(value('--root') ?? process.cwd());
const requestedProject = value('--project');
const create = value('--create');
const kit = value('--kit');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
const read = path => readFile(path, 'utf8');

if (!task || !TRACK_DOCS[track]) {
  console.error('사용법: npm run academy:start -- --task "할 일" --root <repo> [--project id] [--track development|design|data|operations|document] [--create "새 자산" --decision ... --selected ... --reason ...]');
  process.exit(2);
}

const registry = JSON.parse(await read(join(coreRoot, 'registry', 'projects.json')));
let remote = null, branch = null, revision = null, dirty = true;
try {
  remote = git(['remote', 'get-url', 'origin']);
  branch = git(['branch', '--show-current']);
  revision = git(['rev-parse', 'HEAD']);
  dirty = Boolean(git(['status', '--porcelain']));
} catch {}
const repository = remote?.replaceAll('\\', '/').replace(/\.git$/, '').match(/(?:github\.com[/:])([^/]+\/[^/]+)$/i)?.[1] ?? null;
const project = registry.projects.find(item => item.project_id === requestedProject || (!requestedProject && item.repository.toLowerCase() === repository?.toLowerCase())) ?? null;

const baseDocs = ['docs/AI_WORKING_STANDARD.md', ...TRACK_DOCS[track]];
const readings = [];
for (const path of [...new Set(baseDocs)]) readings.push({ path, body: await read(join(coreRoot, path)), purpose: path.endsWith('AI_WORKING_STANDARD.md') ? 'constitution' : 'track_rule' });
const instructions = [];
for (const name of ['AGENTS.md', 'CLAUDE.md', 'WORK_READ_FIRST.md', 'README.md']) {
  try { instructions.push({ path: join(root, name), body: await read(join(root, name)) }); } catch {}
}

let reuse = null;
if (create) {
  const args = [join(coreRoot, 'scripts', 'reuse-preflight.mjs'), create, '--root', root];
  for (const option of ['--decision', '--selected', '--reason']) if (value(option)) args.push(option, value(option));
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', windowsHide: true });
  try { reuse = JSON.parse(result.stdout); } catch { reuse = { verdict: { status: 'HOLD', reason: 'REUSE_CHECK_FAILED' }, candidates: [] }; }
}

const receipt = buildAcademyStartReceipt({ task, track, project, repository, branch, revision, dirty, instructions, readings, reuse, observedAt: new Date().toISOString() });
if (receipt.target) {
  receipt.target.root = root;
  receipt.target.display_name = basename(root);
}
console.log(JSON.stringify(receipt, null, 2));
if (receipt.status === 'READY' && kit) {
  const coreRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: coreRoot, encoding: 'utf8', windowsHide: true }).trim();
  const operatingKnowledge = JSON.parse(await read(join(coreRoot, 'registry', 'operating-knowledge.json')));
  const catalog=[];
  for(const name of ['projects.json','capabilities.json','work-map.json']) catalog.push({name,source:`registry/${name}`,data:JSON.parse(await read(join(coreRoot,'registry',name)))});
  const installed = await installAcademyStarterKit({ output: resolve(root, kit), receipt, readings, coreRevision, operatingKnowledge, catalog });
  console.error(JSON.stringify(installed, null, 2));
}
if (receipt.status !== 'READY') process.exitCode = 3;
