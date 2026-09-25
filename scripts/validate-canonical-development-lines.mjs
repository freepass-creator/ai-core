import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

async function exists(path) {
  try { await access(resolve(root, path)); return true; } catch { return false; }
}

export async function validateCanonicalDevelopmentLines(base = root) {
  const errors = [];
  const registryPath = resolve(base, 'registry/canonical-development-lines.json');
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));

  if (registry.schema !== 'ai-core-canonical-development-lines/v1') errors.push('CANONICAL_LINES_SCHEMA_INVALID');
  if (registry.policy?.one_canonical_line_per_concern !== true) errors.push('CANONICAL_LINES_POLICY_INVALID');

  const ids = new Set();
  for (const line of registry.lines ?? []) {
    if (!line.id || ids.has(line.id)) errors.push(`CANONICAL_LINE_ID_INVALID:${line.id ?? 'missing'}`);
    ids.add(line.id);
    if (!line.canonical_entrypoint || !(await exists(line.canonical_entrypoint))) {
      errors.push(`CANONICAL_ENTRYPOINT_MISSING:${line.id}`);
    }
  }

  const historicalDocs = [
    ['design/claude-v1/CONCEPT.md', 'NOT_CANONICAL'],
    ['design/claude-v1/DECISIONS.md', 'NOT_CANONICAL'],
  ];
  for (const [path, marker] of historicalDocs) {
    const text = await readFile(resolve(base, path), 'utf8');
    if (!text.includes(marker)) errors.push(`HISTORICAL_AUTHORITY_MARKER_MISSING:${path}`);
  }

  const aiopsReadme = await readFile(resolve(base, 'aiops/README.md'), 'utf8');
  if (!aiopsReadme.includes('docs/CONTROL_PLANE.md') || !aiopsReadme.includes('AI Core 전체의 현재 권위')) {
    errors.push('AIOPS_IMPORTED_AUTHORITY_BOUNDARY_MISSING');
  }

  const adapterRuntime = await readFile(resolve(base, 'src/engine/adapter-contract.mjs'), 'utf8');
  if (!adapterRuntime.includes('NOT a second provider/port Adapter standard')) {
    errors.push('CAPABILITY_ADAPTER_BOUNDARY_UNDECLARED');
  }

  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = await validateCanonicalDevelopmentLines();
  if (errors.length) {
    errors.forEach(error => console.error(`FAIL: ${error}`));
    process.exitCode = 1;
  } else {
    console.log('PASS: canonical development lines are singular and legacy authority is demoted');
  }
}
