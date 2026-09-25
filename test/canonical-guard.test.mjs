import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { checkRepository, globToRegExp } from '../src/governance/canonical-guard.mjs';
import { canonicalPaths, overlaps, touches } from '../scripts/check-branch-discipline.mjs';

const registry = JSON.parse(readFileSync(new URL('../registry/canonical-development-lines.json', import.meta.url), 'utf8'));

test('AI Core itself keeps one canonical line per concern', () => {
  assert.deepEqual(checkRepository(new URL('..', import.meta.url).pathname, registry), []);
});

test('canon-guard self-test catches every known-bad sample', () => {
  const r = spawnSync(process.execPath, ['scripts/canon-guard.mjs', '--self-test'], { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('glob, canonical path and overlap helpers', () => {
  assert.ok(globToRegExp('**/*.css').test('a/b/c.css'));
  assert.ok(globToRegExp('**/*.css').test('c.css'));
  assert.ok(!globToRegExp('**/*.css').test('c.cssx'));
  assert.ok(touches('design-system/tokens.json', 'design-system/'));
  assert.ok(touches('contracts/core-adapter.schema.json', 'contracts/core-'));
  assert.ok(!touches('docs/UI_UX_START_HERE.md.bak', 'docs/UI_UX_START_HERE.md'));
  const roots = canonicalPaths(registry);
  assert.ok(roots.includes('design-system/'));
  assert.deepEqual(overlaps(['design-system/tokens.json'], ['design-system/runtime-v2.css'], ['design-system/']), ['design-system/']);
  assert.deepEqual(overlaps(['design-system/tokens.json'], ['docs/x.md'], ['design-system/']), []);
});

test('every repository guard states why it exists', () => {
  for (const guard of Object.values(registry.repository_guards)) assert.ok(guard.why);
  for (const b of registry.baseline) { assert.ok(b.reason); assert.match(b.expires, /^\d{4}-\d{2}-\d{2}$/); }
});
