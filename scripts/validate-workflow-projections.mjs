import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';

const schema = JSON.parse(readFileSync(new URL('../contracts/workflow-projection.schema.json', import.meta.url), 'utf8'));

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

export function validateWorkflowProjections(projectionRegistry, workflowRegistry) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const errors = [];
  const warnings = [];

  if (!validate(projectionRegistry)) {
    for (const item of validate.errors ?? []) {
      errors.push(issue('WORKFLOW_PROJECTION_SCHEMA_INVALID', item.instancePath || '/', {
        keyword: item.keyword,
        message: item.message,
      }));
    }
    return { status: 'INVALID', errors, warnings };
  }

  if (!workflowRegistry || !Array.isArray(workflowRegistry.workflows)) {
    return { status: 'INVALID', errors: [issue('WORKFLOW_REGISTRY_REQUIRED', '/')], warnings };
  }

  const workflows = new Map(workflowRegistry.workflows.map(item => [item.workflow_id, item]));

  for (const id of duplicates(projectionRegistry.projections.map(item => item.projection_id))) {
    errors.push(issue('WORKFLOW_PROJECTION_ID_DUPLICATE', '/projections', { projection_id: id }));
  }

  projectionRegistry.projections.forEach((projection, pi) => {
    const base = `/projections/${pi}`;
    const workflow = workflows.get(projection.workflow_id);
    if (!workflow) {
      errors.push(issue('WORKFLOW_PROJECTION_WORKFLOW_UNKNOWN', `${base}/workflow_id`, { workflow_id: projection.workflow_id }));
      return;
    }

    if (projection.adoption_status === 'PILOT' && !projection.adoption_evidence) {
      errors.push(issue('PILOT_PROJECTION_ADOPTION_EVIDENCE_REQUIRED', base));
    }
    if (projection.adoption_evidence) {
      const evidencePath = `${base}/adoption_evidence`;
      const evidenceFiles = projection.adoption_evidence.verification.files.map(item => item.path);
      for (const pathValue of duplicates(evidenceFiles)) {
        errors.push(issue('WORKFLOW_PROJECTION_ADOPTION_EVIDENCE_PATH_DUPLICATE', `${evidencePath}/verification/files`, { path: pathValue }));
      }
      if (projection.adoption_status === 'SHADOW'
        && ['RUNTIME_PILOT', 'RUNTIME_CANONICAL'].includes(projection.adoption_evidence.stage)) {
        errors.push(issue('SHADOW_PROJECTION_CANNOT_CLAIM_RUNTIME_ADOPTION', evidencePath, {
          stage: projection.adoption_evidence.stage,
        }));
      }
      if (projection.adoption_evidence.stage === 'SOURCE_PARITY_VERIFIED'
        && (projection.adoption_evidence.verification.kind !== 'CI'
          || projection.adoption_evidence.verification.conclusion !== 'SUCCESS')) {
        errors.push(issue('SOURCE_PROJECTION_PARITY_REQUIRES_SUCCESSFUL_CI', evidencePath));
      }
      if (projection.adoption_status === 'PILOT'
        && projection.adoption_evidence.stage !== 'RUNTIME_PILOT') {
        errors.push(issue('PILOT_PROJECTION_REQUIRES_RUNTIME_PILOT_EVIDENCE', evidencePath, {
          stage: projection.adoption_evidence.stage,
        }));
      }
    }

    const allowed = new Set(projection.output.allowed_values);
    if (!allowed.has(projection.default_result)) {
      errors.push(issue('WORKFLOW_PROJECTION_DEFAULT_UNKNOWN', `${base}/default_result`));
    }

    for (const id of duplicates(projection.rules.map(rule => rule.rule_id))) {
      errors.push(issue('WORKFLOW_PROJECTION_RULE_ID_DUPLICATE', `${base}/rules`, { rule_id: id }));
    }
    for (const priority of duplicates(projection.rules.map(rule => rule.priority))) {
      errors.push(issue('WORKFLOW_PROJECTION_PRIORITY_DUPLICATE', `${base}/rules`, { priority }));
    }

    const axes = new Map(workflow.state_axes.map(axis => [axis.axis_id, new Set(axis.states.map(state => state.state_id))]));
    const facts = new Set(workflow.facts.map(fact => fact.fact_id));

    projection.rules.forEach((rule, ri) => {
      const path = `${base}/rules/${ri}`;
      if (!allowed.has(rule.result)) {
        errors.push(issue('WORKFLOW_PROJECTION_RESULT_UNKNOWN', path, { result: rule.result }));
      }
      rule.all.forEach((condition, ci) => {
        const cpath = `${path}/all/${ci}`;
        if (condition.kind === 'STATE_EQUALS') {
          if (!axes.has(condition.axis_id)) {
            errors.push(issue('WORKFLOW_PROJECTION_AXIS_UNKNOWN', cpath, { axis_id: condition.axis_id }));
          } else if (!axes.get(condition.axis_id).has(condition.value)) {
            errors.push(issue('WORKFLOW_PROJECTION_STATE_UNKNOWN', cpath, {
              axis_id: condition.axis_id,
              state: condition.value,
            }));
          }
        } else if (condition.kind === 'FACT_EQUALS' && !facts.has(condition.fact_id)) {
          errors.push(issue('WORKFLOW_PROJECTION_FACT_UNKNOWN', cpath, { fact_id: condition.fact_id }));
        }
      });
    });
  });

  return { status: errors.length ? 'INVALID' : 'VALID', errors, warnings };
}

if (process.argv[1]?.endsWith('validate-workflow-projections.mjs')) {
  const projectionPath = process.argv[2] ?? new URL('../registry/workflow-projections.json', import.meta.url);
  const workflowPath = process.argv[3] ?? new URL('../registry/workflows.json', import.meta.url);
  const [projectionText, workflowText] = await Promise.all([
    readFile(projectionPath, 'utf8'),
    readFile(workflowPath, 'utf8'),
  ]);
  const result = validateWorkflowProjections(JSON.parse(projectionText), JSON.parse(workflowText));
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'VALID') process.exitCode = 1;
}
