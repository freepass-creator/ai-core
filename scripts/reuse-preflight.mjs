import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { queryTokens, rankReuseCandidates, validateReuseDecision } from '../src/reuse/reuse-preflight.mjs';

const coreRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const argv = process.argv.slice(2);
const take = (name) => { const index = argv.indexOf(name); return index >= 0 ? argv[index + 1] : null; };
const skip = new Set();
for (const name of ['--root','--decision','--selected','--reason']) {
  const index = argv.indexOf(name); if (index >= 0) { skip.add(index); skip.add(index + 1); }
}
const query = argv.filter((_, index) => !skip.has(index)).join(' ').trim();
if (!query) {
  console.error('사용법: npm run reuse:check -- "<만들려는 것>" [--root path] [--decision ... --selected id,path --reason "..."]');
  process.exit(2);
}

const searchRoot = resolve(take('--root') ?? process.cwd());
const tokens = queryTokens(query);
const fileResult = spawnSync('rg', ['--files', searchRoot], { encoding: 'utf8', windowsHide: true });
const paths = (fileResult.stdout ?? '').split(/\r?\n/).filter(Boolean).slice(0, 20000);
const fileCandidates = paths.map((path) => ({ kind: 'FILE', path: relative(searchRoot, path) || path }));

const contentCandidates = [];
if (tokens.length) {
  const contentResult = spawnSync('rg', ['-n','-i','-m','2','--glob','!node_modules/**','--glob','!.git/**', tokens.slice(0, 8).join('|'), searchRoot], { encoding: 'utf8', windowsHide: true });
  for (const line of (contentResult.stdout ?? '').split(/\r?\n/).filter(Boolean).slice(0, 200)) {
    const match = line.match(/^(.*?):(\d+):(.*)$/);
    if (match) contentCandidates.push({ kind: 'CONTENT', path: relative(searchRoot, match[1]), line: +match[2], text: match[3].trim().slice(0, 240) });
  }
}

let capabilities = [];
try {
  const registry = JSON.parse(await readFile(join(coreRoot, 'registry', 'capabilities.json'), 'utf8'));
  capabilities = registry.capabilities.map((item) => ({ kind: 'CAPABILITY', id: item.id, title: item.title, text: `${item.domains?.join(' ') ?? ''} ${item.status} ${item.hold_reason ?? ''}` }));
} catch {}

const candidates = rankReuseCandidates(query, [...capabilities, ...fileCandidates, ...contentCandidates]);
const decision = take('--decision');
const selected = (take('--selected') ?? '').split(',').map((value) => value.trim()).filter(Boolean);
const verdict = validateReuseDecision({ decision, selected, reason: take('--reason') ?? '', candidateCount: candidates.length });
const output = {
  schema: 'ai-core-reuse-preflight/v1',
  query,
  search_root: searchRoot,
  searched: { capability_registry: true, file_names: paths.length, content_matches: contentCandidates.length },
  candidates,
  verdict,
  next_action: verdict.status === 'PASS' ? 'PROCEED_WITH_RECORDED_DECISION' : 'INSPECT_CANDIDATES_BEFORE_CREATING',
};
console.log(JSON.stringify(output, null, 2));
if (verdict.status !== 'PASS') process.exitCode = 3;
