import { readFileSync } from 'node:fs';

const registry = JSON.parse(readFileSync(new URL('../../registry/workflows.json', import.meta.url), 'utf8'));

export function getWorkflow(workflowId) {
  const workflow = registry.workflows.find(item => item.workflow_id === workflowId);
  if (!workflow) throw new Error(`WORKFLOW_NOT_REGISTERED:${workflowId}`);
  return workflow;
}

export function lifecycleGraph(workflowId, axisId = 'lifecycle') {
  const workflow = getWorkflow(workflowId);
  const axis = workflow.state_axes.find(item => item.axis_id === axisId);
  if (!axis) throw new Error(`WORKFLOW_AXIS_NOT_REGISTERED:${workflowId}:${axisId}`);

  const transitions = new Map();
  for (const state of axis.states) transitions.set(state.state_id, []);

  for (const transition of workflow.transitions) {
    if (transition.axis_id !== axisId || transition.purpose === 'REOBSERVE') continue;
    for (const from of transition.from) {
      const list = transitions.get(from);
      if (!list) throw new Error(`WORKFLOW_TRANSITION_FROM_UNKNOWN:${transition.transition_id}:${from}`);
      if (!list.includes(transition.to)) list.push(transition.to);
    }
  }

  const reobservable = workflow.transitions
    .filter(transition =>
      transition.axis_id === axisId
      && transition.purpose === 'REOBSERVE'
      && transition.from.length === 1
      && transition.from[0] === transition.to)
    .map(transition => transition.to);

  const verifiedPath = [...new Set(
    workflow.transitions
      .filter(transition =>
        transition.axis_id === axisId
        && transition.guards.includes('work.verified-revision-present'))
      .map(transition => transition.to),
  )];

  return Object.freeze({
    workflow,
    axis,
    transitions,
    reobservable,
    verifiedPath,
  });
}

export function workflowRegistrySnapshot() {
  return structuredClone(registry);
}
