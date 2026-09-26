import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateProjectAuditReadinessRegistry } from '../src/engine/project-audit-readiness.mjs';

const readRegistry = async () =>
  JSON.parse(await readFile(new URL('../registry/project-audit-readiness.json', import.meta.url), 'utf8'));

test('machine-enforced axis requires a canonical source', async () => {
  const registry = await readRegistry();
  registry.axes.find(axis => axis.id === 'ui-ux').canonical_sources = [];
  assert.throws(
    () => validateProjectAuditReadinessRegistry(registry),
    /AUDIT_READINESS_CANONICAL_SOURCES_REQUIRED:ui-ux/,
  );
});
