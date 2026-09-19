import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const bridgeSchema = JSON.parse(readFileSync(new URL('../contracts/workflow-bridge.schema.json', import.meta.url), 'utf8'));

function duplicates(values) {
  const seen = new Set();
  const dup = new Set();
  for (const value of values) {
    if (seen.has(value)) dup.add(value);
    seen.add(value);
  }
  return [...dup];
}

function issue(code, path, details = {}) {
  return { code, path, ...details };
}

export function validateWorkflowBridges(bridgeRegistry, workflowRegistry) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(bridgeSchema);
  const errors = [];
  const warnings = [];

  if (!validate(bridgeRegistry)) {
    for (const item of validate.errors ?? []) {
      errors.push(issue('WORKFLOW_BRIDGE_SCHEMA_INVALID', item.instancePath || '/', {
        keyword: item.keyword,
        message: item.message,
      }));
    }
    return { status: 'INVALID', errors, warnings };
  }

  if (!workflowRegistry || !Array.isArray(workflowRegistry.workflows)) {
    return {
      status: 'INVALID',
      errors: [issue('WORKFLOW_REGISTRY_REQUIRED', '/')],
      warnings,
    };
  }

  const workflows = new Map(workflowRegistry.workflows.map(workflow => [workflow.workflow_id, workflow]));

  for (const id of duplicates(bridgeRegistry.bridges.map(bridge => bridge.bridge_id))) {
    errors.push(issue('WORKFLOW_BRIDGE_ID_DUPLICATE', '/bridges', { bridge_id: id }));
  }

  bridgeRegistry.bridges.forEach((bridge, index) => {
    const path = `/bridges/${index}`;

    if (bridge.adoption_status === 'SHADOW' && !bridge.source_authority) {
      errors.push(issue('SHADOW_BRIDGE_SOURCE_AUTHORITY_REQUIRED', path));
    }
    if (bridge.source_authority) {
      for (const sourcePath of duplicates(bridge.source_authority.files.map(item => item.path))) {
        errors.push(issue('SHADOW_BRIDGE_SOURCE_PATH_DUPLICATE', `${path}/source_authority/files`, { path: sourcePath }));
      }
    }

    const sourceWorkflow = bridge.source.workflow_id
      ? workflows.get(bridge.source.workflow_id)
      : null;

    if (bridge.source.kind === 'WORKFLOW_EVENT') {
      if (!sourceWorkflow) {
        errors.push(issue('BRIDGE_SOURCE_WORKFLOW_UNKNOWN', `${path}/source`, { workflow_id: bridge.source.workflow_id ?? null }));
      } else if (!sourceWorkflow.events.some(event => event.event_type === bridge.source.event_type)) {
        errors.push(issue('BRIDGE_SOURCE_EVENT_UNKNOWN', `${path}/source`, {
          workflow_id: bridge.source.workflow_id,
          event_type: bridge.source.event_type ?? null,
        }));
      }
    }

    if (bridge.source.kind === 'STATE_PROJECTION' && !sourceWorkflow) {
      errors.push(issue('BRIDGE_SOURCE_WORKFLOW_UNKNOWN', `${path}/source`, { workflow_id: bridge.source.workflow_id ?? null }));
    }

    if (bridge.source.kind === 'DOMAIN_EVENT'
      && !bridge.source.event_type
      && !bridge.source.raw_event_type) {
      errors.push(issue('BRIDGE_DOMAIN_EVENT_REQUIRED', `${path}/source`));
    }

    const targetWorkflow = bridge.target.workflow_id
      ? workflows.get(bridge.target.workflow_id)
      : null;

    if (['WORKFLOW_COMMAND', 'WORKFLOW_EVIDENCE'].includes(bridge.target.kind) && !targetWorkflow) {
      errors.push(issue('BRIDGE_TARGET_WORKFLOW_UNKNOWN', `${path}/target`, {
        workflow_id: bridge.target.workflow_id ?? null,
      }));
    }

    if (bridge.target.kind === 'WORKFLOW_COMMAND' && targetWorkflow) {
      if (!targetWorkflow.commands.some(command => command.command_id === bridge.target.command_id)) {
        errors.push(issue('BRIDGE_TARGET_COMMAND_UNKNOWN', `${path}/target`, {
          workflow_id: bridge.target.workflow_id,
          command_id: bridge.target.command_id ?? null,
        }));
      }
    }

    if (['COMMAND_TRIGGER', 'INVALIDATION_TRIGGER'].includes(bridge.relation)) {
      if (bridge.target.kind !== 'WORKFLOW_COMMAND') {
        errors.push(issue('BRIDGE_TRIGGER_REQUIRES_COMMAND_TARGET', path));
      }
      if (bridge.dispatch.mode === 'NONE') {
        errors.push(issue('BRIDGE_TRIGGER_REQUIRES_DISPATCH', path));
      }
      if (!bridge.direct_transition_allowed) {
        warnings.push(issue('BRIDGE_TRIGGER_DIRECT_TRANSITION_DISABLED', path));
      }
    }

    if (bridge.relation === 'EVIDENCE_FEED') {
      if (bridge.target.kind !== 'WORKFLOW_EVIDENCE') {
        errors.push(issue('BRIDGE_EVIDENCE_FEED_REQUIRES_EVIDENCE_TARGET', path));
      }
      if (bridge.dispatch.mode !== 'NONE') {
        errors.push(issue('BRIDGE_EVIDENCE_FEED_MUST_NOT_DISPATCH', path));
      }
      if (bridge.direct_transition_allowed) {
        errors.push(issue('BRIDGE_EVIDENCE_FEED_DIRECT_TRANSITION_FORBIDDEN', path));
      }
      if (bridge.target.command_id) {
        errors.push(issue('BRIDGE_EVIDENCE_FEED_COMMAND_FORBIDDEN', path));
      }
    }

    if (bridge.relation === 'PROJECTION_DEPENDENCY') {
      if (bridge.target.kind !== 'DERIVED_PROJECTION') {
        errors.push(issue('BRIDGE_PROJECTION_REQUIRES_DERIVED_TARGET', path));
      }
      if (bridge.dispatch.mode !== 'NONE') {
        errors.push(issue('BRIDGE_PROJECTION_MUST_NOT_DISPATCH', path));
      }
      if (bridge.direct_transition_allowed) {
        errors.push(issue('BRIDGE_PROJECTION_DIRECT_TRANSITION_FORBIDDEN', path));
      }
    }

    if (bridge.dispatch.mode === 'SAME_TRANSACTION'
      && !['INVALIDATION_TRIGGER', 'COMMAND_TRIGGER'].includes(bridge.relation)) {
      errors.push(issue('BRIDGE_SAME_TRANSACTION_RELATION_INVALID', path));
    }
  });

  return { status: errors.length ? 'INVALID' : 'VALID', errors, warnings };
}

if (process.argv[1]?.endsWith('validate-workflow-bridges.mjs')) {
  const bridgePath = process.argv[2] ?? new URL('../registry/workflow-bridges.json', import.meta.url);
  const workflowPath = process.argv[3] ?? new URL('../registry/workflows.json', import.meta.url);
  const [bridgeText, workflowText] = await Promise.all([
    readFile(bridgePath, 'utf8'),
    readFile(workflowPath, 'utf8'),
  ]);
  const result = validateWorkflowBridges(JSON.parse(bridgeText), JSON.parse(workflowText));
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'VALID') process.exitCode = 1;
}
