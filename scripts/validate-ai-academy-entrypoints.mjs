import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const coreRoot = resolve(import.meta.dirname, '..');
const userHome = homedir();
const requiredCorePaths = [
  join(coreRoot, 'docs', 'AI_WORKING_STANDARD.md'),
  join(coreRoot, 'docs', 'AI_ACADEMY_CURRICULUM.md'),
];
const entrypoints = [
  { tool: 'codex', required: true, path: join(userHome, '.codex', 'AGENTS.md') },
  { tool: 'claude', required: true, path: join(userHome, '.claude', 'CLAUDE.md') },
  { tool: 'gemini', required: false, path: join(userHome, '.gemini', 'GEMINI.md') },
  { tool: 'cursor', required: false, path: join(userHome, '.cursor', 'rules', 'ai-core-academy.mdc') },
];
const requiredTerms = [
  'AI_WORKING_STANDARD.md',
  'AI_ACADEMY_CURRICULUM.md',
  'academy:start',
  'next_start_here',
];
const preflightTerms = [
  ['목적', 'purpose'],
  ['정본', 'canonical source'],
  ['규격', 'applicable rules'],
  ['노하우', 'reusable knowledge'],
  ['검증', 'completion verification'],
];

const results = [];
for (const path of requiredCorePaths) {
  try {
    await readFile(path, 'utf8');
    results.push({ target: 'core', path, status: 'PASS', missing: [] });
  } catch (error) {
    results.push({ target: 'core', path, status: 'FAIL', missing: [error.code ?? 'READ_FAILED'] });
  }
}

for (const entry of entrypoints) {
  try {
    const body = await readFile(entry.path, 'utf8');
    const missing = requiredTerms.filter((term) => !body.includes(term));
    for (const alternatives of preflightTerms) {
      if (!alternatives.some((term) => body.toLowerCase().includes(term.toLowerCase()))) missing.push(alternatives.join('|'));
    }
    if (entry.tool === 'cursor' && !/alwaysApply:\s*true/.test(body)) missing.push('alwaysApply:true');
    results.push({ target: entry.tool, required: entry.required, path: entry.path, status: missing.length ? 'FAIL' : 'PASS', missing });
  } catch (error) {
    results.push({ target: entry.tool, required: entry.required, path: entry.path, status: entry.required ? 'FAIL' : 'OPTIONAL_UNAVAILABLE', missing: [error.code ?? 'READ_FAILED'] });
  }
}

const status = results.every((result) => result.target === 'core' ? result.status === 'PASS' : (!result.required || result.status === 'PASS')) ? 'PASS' : 'FAIL';
console.log(JSON.stringify({ schema: 'ai-core-academy-entrypoints/v1', status, results }, null, 2));
if (status !== 'PASS') process.exitCode = 1;
