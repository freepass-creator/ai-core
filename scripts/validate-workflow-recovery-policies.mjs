import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const schema = JSON.parse(readFileSync(new URL('../contracts/workflow-recovery-policy.schema.json', import.meta.url), 'utf8'));

function issue(code, path, details = {}) {
  return { code, path, ...details };
}

function duplicates(values) {
  const seen = new Set();
  const dup = new Set();
  for (const value of values) {
    if (seen.has(value)) dup.add(value);
    seen.add(value);
  }
  return [...dup];
}

export function validateRecoveryPolicies(registry) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const errors = [];
  const warnings = [];

  if (!validate(registry)) {
    for (const item of validate.errors ?? []) {
      errors.push(issue('RECOVERY_POLICY_SCHEMA_INVALID', item.instancePath || '/', {
        keyword: item.keyword,
        message: item.message,
      }));
    }
    return { status: 'INVALID', errors, warnings };
  }

  for (const id of duplicates(registry.policies.map(item => item.policy_id))) {
    errors.push(issue('RECOVERY_POLICY_ID_DUPLICATE', '/policies', { policy_id: id }));
  }

  registry.policies.forEach((policy, index) => {
    const path = `/policies/${index}`;

    if (policy.evidence_level === 'CROSS_PROJECT_VERIFIED' && policy.source_projects.length < 2) {
      errors.push(issue('RECOVERY_CROSS_PROJECT_EVIDENCE_REQUIRED', path));
    }
    if (policy.adoption_status === 'COMMON_ADOPTED'
      && policy.evidence_level !== 'COMMON_ADOPTED') {
      errors.push(issue('RECOVERY_COMMON_ADOPTION_EVIDENCE_REQUIRED', path));
    }
    if (policy.adoption_status === 'COMMON_ADOPTED'
      && policy.contract_dependency.identity_contract_status !== 'BOUND') {
      errors.push(issue('RECOVERY_COMMON_ADOPTION_IDENTITY_CONTRACT_REQUIRED', path));
    }
    if (policy.execution_paths.includes('FALLBACK')
      && !policy.success_reconciliation.evidence_sources.includes('NATIVE_EXECUTION')) {
      errors.push(issue('RECOVERY_NATIVE_SUCCESS_RECONCILIATION_REQUIRED', path));
    }
    if (policy.execution_paths.includes('FALLBACK')
      && !policy.success_reconciliation.evidence_sources.includes('RECOVERY_HISTORY')) {
      errors.push(issue('RECOVERY_HISTORY_RECONCILIATION_REQUIRED', path));
    }

    for (const sourcePath of duplicates(policy.source_authority.files.map(item => item.path))) {
      errors.push(issue('RECOVERY_SOURCE_PATH_DUPLICATE', `${path}/source_authority/files`, { source_path: sourcePath }));
    }

    if (policy.adoption_status === 'PILOT') {
      warnings.push(issue('RECOVERY_POLICY_PILOT_SECOND_PROJECT_REQUIRED', path, {
        policy_id: policy.policy_id,
      }));
    }
  });

  return { status: errors.length ? 'INVALID' : 'VALID', errors, warnings };
}

if (process.argv[1]?.endsWith('validate-workflow-recovery-policies.mjs')) {
  const path = process.argv[2] ?? new URL('../registry/workflow-recovery-policies.json', import.meta.url);
  const result = validateRecoveryPolicies(JSON.parse(await readFile(path, 'utf8')));
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'VALID') process.exitCode = 1;
}
