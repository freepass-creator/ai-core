import { readFile, readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const schema = JSON.parse(readFileSync(new URL('../contracts/project-registry.schema.json', import.meta.url), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

export function validateProjectRegistry(registry) {
  const errors = [];
  if (!validate(registry)) {
    errors.push(...validate.errors.map((error) => ({ code: `SCHEMA_${error.keyword.toUpperCase()}`, path: error.instancePath || '$' })));
    return { status: 'INVALID', errors };
  }
  const seen = { ids: new Set(), repositories: new Set(), paths: new Set() };
  const registryTime = Date.parse(registry.observed_at);
  for (const [index, project] of registry.projects.entries()) {
    const path = `projects/${index}`;
    for (const [field, set, value] of [
      ['project_id', seen.ids, project.project_id.toLowerCase()],
      ['repository', seen.repositories, project.repository.toLowerCase()],
      ['local_path', seen.paths, project.local_path?.toLowerCase()],
    ]) {
      if (!value) continue;
      if (set.has(value)) errors.push({ code: `${field.toUpperCase()}_DUPLICATE`, path: `${path}/${field}` });
      set.add(value);
    }
    if (project.status === 'ACTIVE' && (!project.commands.test || !project.commands.build)) {
      errors.push({ code: 'ACTIVE_PROJECT_CHECKS_INCOMPLETE', path: `${path}/commands` });
    }
    if (project.status === 'RETIRE' && project.deploy_targets.length) {
      errors.push({ code: 'RETIRED_PROJECT_HAS_DEPLOY_TARGET', path: `${path}/deploy_targets` });
    }
    if (!project.authoritative_sources.some((source) => source.kind === 'GIT' && source.revision === project.head_revision)) {
      errors.push({ code: 'HEAD_REVISION_NOT_SOURCE_BOUND', path: `${path}/head_revision` });
    }
    for (const [sourceIndex, source] of project.authoritative_sources.entries()) {
      if (Date.parse(source.observed_at) > registryTime) {
        errors.push({ code: 'SOURCE_OBSERVED_AFTER_REGISTRY', path: `${path}/authoritative_sources/${sourceIndex}/observed_at` });
      }
    }
  }
  return { status: errors.length ? 'INVALID' : 'VALID', errors };
}

if (process.argv[1]?.endsWith('validate-project-registry.mjs')) {
  if (!process.argv[2]) { console.error('Usage: node scripts/validate-project-registry.mjs <registry.json>'); process.exit(2); }
  const registry = JSON.parse(await new Promise((resolve, reject) => readFile(process.argv[2], 'utf8', (error, data) => error ? reject(error) : resolve(data))));
  const result = validateProjectRegistry(registry);
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'VALID') process.exitCode = 1;
}
