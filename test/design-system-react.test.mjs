import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { checkDesignSystemReact } from '../scripts/check-design-system-react.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function sandbox(t) {
  const base = mkdtempSync(join(tmpdir(), 'ds-react-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  mkdirSync(join(base, 'design-system'), { recursive: true });
  cpSync(join(root, 'design-system/tokens.runtime.css'), join(base, 'design-system/tokens.runtime.css'));
  cpSync(join(root, 'design-system/react/src'), join(base, 'design-system/react/src'), { recursive: true });
  cpSync(join(root, 'design-system/react/PROVENANCE.json'), join(base, 'design-system/react/PROVENANCE.json'));
  return base;
}

test('HQ React atoms are bound only to HQ design-system tokens', () => {
  const result = checkDesignSystemReact();
  assert.deepEqual(result.errors, []);
  assert.equal(result.status, 'PASS');
});

test('an undefined CSS variable in an atom is caught', t => {
  const base = sandbox(t);
  const file = join(base, 'design-system/react/src/ui/status-badge.tsx');
  writeFileSync(file, readFileSync(file, 'utf8') + "\nexport const _probe = 'var(--text-main)';\n");
  const result = checkDesignSystemReact({ base });
  assert.ok(result.errors.some(error => error.includes('--text-main is not defined')));
});

test('a literal color outside tokens.ts is caught', t => {
  const base = sandbox(t);
  const file = join(base, 'design-system/react/src/ui/wizard.tsx');
  writeFileSync(file, readFileSync(file, 'utf8') + "\nexport const _probe = '#ff0000';\n");
  assert.ok(checkDesignSystemReact({ base }).errors.some(error => error.includes('literal color #ff0000')));
});

test('a project import leaking into the package is caught', t => {
  const base = sandbox(t);
  const file = join(base, 'design-system/react/src/lib/haptics.ts');
  writeFileSync(file, "import { useSession } from '@/lib/session';\n" + readFileSync(file, 'utf8'));
  assert.ok(checkDesignSystemReact({ base }).errors.some(error => error.includes("import '@/lib/session' leaves the package")));
});

test('an unrecorded file and a drifted exact copy are caught', t => {
  const base = sandbox(t);
  writeFileSync(join(base, 'design-system/react/src/ui/stray.tsx'), 'export const stray = 1;\n');
  const exact = join(base, 'design-system/react/src/lib/use-mobile.ts');
  writeFileSync(exact, readFileSync(exact, 'utf8') + '\n');
  const errors = checkDesignSystemReact({ base }).errors;
  assert.ok(errors.some(error => error.includes('stray.tsx: not recorded')));
  assert.ok(errors.some(error => error.includes('use-mobile.ts: content differs')));
});
