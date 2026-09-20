import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';

const schema = JSON.parse(readFileSync(new URL('../contracts/workflow-progression.schema.json', import.meta.url), 'utf8'));

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

export function validateWorkflowProgressions(progressionRegistry, workflowRegistry) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const errors = [];
  const warnings = [];

  if (!validate(progressionRegistry)) {
    for (const item of validate.errors ?? []) {
      errors.push(issue('WORKFLOW_PROGRESSION_SCHEMA_INVALID', item.instancePath || '/', {
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

  for (const id of duplicates(progressionRegistry.progressions.map(item => item.progression_id))) {
    errors.push(issue('WORKFLOW_PROGRESSION_ID_DUPLICATE', '/progressions', { progression_id: id }));
  }

  progressionRegistry.progressions.forEach((progression, pi) => {
    const base = `/progressions/${pi}`;
    const workflow = workflows.get(progression.workflow_id);
    if (!workflow) {
      errors.push(issue('WORKFLOW_PROGRESSION_WORKFLOW_UNKNOWN', `${base}/workflow_id`, {
        workflow_id: progression.workflow_id,
      }));
      return;
    }

    const axis = workflow.state_axes.find(item => item.axis_id === progression.axis_id);
    if (!axis) {
      errors.push(issue('WORKFLOW_PROGRESSION_AXIS_UNKNOWN', `${base}/axis_id`, {
        axis_id: progression.axis_id,
      }));
      return;
    }

    const states = new Set(axis.states.map(state => state.state_id));
    const facts = new Set(workflow.facts.map(fact => fact.fact_id));

    progression.ordered_states.forEach((state, si) => {
      if (!states.has(state)) {
        errors.push(issue('WORKFLOW_PROGRESSION_STATE_UNKNOWN', `${base}/ordered_states/${si}`, { state }));
      }
      const stateDef = axis.states.find(item => item.state_id === state);
      if (stateDef?.terminal && si !== progression.ordered_states.length - 1) {
        errors.push(issue('WORKFLOW_PROGRESSION_TERMINAL_STATE_MUST_BE_LAST', `${base}/ordered_states/${si}`, { state }));
      }
    });

    for (const id of duplicates(progression.inference_rules.map(rule => rule.rule_id))) {
      errors.push(issue('WORKFLOW_PROGRESSION_INFERENCE_ID_DUPLICATE', `${base}/inference_rules`, { rule_id: id }));
    }

    progression.inference_rules.forEach((rule, ri) => {
      const path = `${base}/inference_rules/${ri}`;
      if (!progression.ordered_states.includes(rule.when_target_at_or_after)) {
        errors.push(issue('WORKFLOW_PROGRESSION_INFERENCE_THRESHOLD_UNKNOWN', path, {
          state: rule.when_target_at_or_after,
        }));
      }
      if (!facts.has(rule.inferred_fact_id)) {
        errors.push(issue('WORKFLOW_PROGRESSION_INFERRED_FACT_UNKNOWN', path, {
          fact_id: rule.inferred_fact_id,
        }));
      }
      for (const factId of rule.forbidden_completion_fact_ids) {
        if (!facts.has(factId)) {
          errors.push(issue('WORKFLOW_PROGRESSION_FORBIDDEN_FACT_UNKNOWN', path, { fact_id: factId }));
        }
        if (factId === rule.inferred_fact_id) {
          errors.push(issue('WORKFLOW_PROGRESSION_INFERRED_FACT_CANNOT_BE_FORBIDDEN', path, { fact_id: factId }));
        }
      }
    });

    if (progression.adoption_status === 'SHADOW' && !progression.source_authority) {
      errors.push(issue('SHADOW_PROGRESSION_SOURCE_AUTHORITY_REQUIRED', base));
    }
    if (progression.source_authority) {
      for (const pathValue of duplicates(progression.source_authority.files.map(item => item.path))) {
        errors.push(issue('WORKFLOW_PROGRESSION_SOURCE_PATH_DUPLICATE', `${base}/source_authority/files`, { path: pathValue }));
      }
    }
    if (progression.adoption_status === 'PILOT' && !progression.adoption_evidence) {
      errors.push(issue('PILOT_PROGRESSION_ADOPTION_EVIDENCE_REQUIRED', base));
    }
    if (progression.adoption_evidence) {
      const evidencePath = `${base}/adoption_evidence`;
      for (const pathValue of duplicates(progression.adoption_evidence.verification.files.map(item => item.path))) {
        errors.push(issue('WORKFLOW_PROGRESSION_ADOPTION_EVIDENCE_PATH_DUPLICATE', `${evidencePath}/verification/files`, { path: pathValue }));
      }
      if (progression.adoption_status === 'SHADOW'
        && ['RUNTIME_PILOT', 'RUNTIME_CANONICAL'].includes(progression.adoption_evidence.stage)) {
        errors.push(issue('SHADOW_PROGRESSION_CANNOT_CLAIM_RUNTIME_ADOPTION', evidencePath));
      }
      if (progression.adoption_evidence.stage === 'SOURCE_PARITY_VERIFIED'
        && (progression.adoption_evidence.verification.kind !== 'CI'
          || progression.adoption_evidence.verification.conclusion !== 'SUCCESS')) {
        errors.push(issue('SOURCE_PROGRESSION_PARITY_REQUIRES_SUCCESSFUL_CI', evidencePath));
      }
      if (progression.adoption_status === 'PILOT'
        && progression.adoption_evidence.stage !== 'RUNTIME_PILOT') {
        errors.push(issue('PILOT_PROGRESSION_REQUIRES_RUNTIME_PILOT_EVIDENCE', evidencePath));
      }
    }
  });

  return { status: errors.length ? 'INVALID' : 'VALID', errors, warnings };
}

if (process.argv[1]?.endsWith('validate-workflow-progressions.mjs')) {
  const progressionPath = process.argv[2] ?? new URL('../registry/workflow-progressions.json', import.meta.url);
  const workflowPath = process.argv[3] ?? new URL('../registry/workflows.json', import.meta.url);
  const [progressionText, workflowText] = await Promise.all([
    readFile(progressionPath, 'utf8'),
    readFile(workflowPath, 'utf8'),
  ]);
  const result = validateWorkflowProgressions(JSON.parse(progressionText), JSON.parse(workflowText));
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'VALID') process.exitCode = 1;
}
