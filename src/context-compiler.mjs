export function compileContext({ task, sourcePointers = [], capabilityRefs = [], failures = [], decisions = [] }) {
  const unresolved = sourcePointers.filter(x => x.status === 'unresolved' || !x.revision_or_sha);
  return {
    task_id: task.task_id,
    source_pointers: sourcePointers.filter(x => x.status === 'authoritative'),
    capability_refs: capabilityRefs.filter(x => ['authoritative','adopted'].includes(x.status)),
    relevant_failures: failures.filter(x => applies(x.scope, task)),
    relevant_decisions: decisions.filter(x => applies(x.scope, task)),
    uncertainties: unresolved.map(x => ({ location: x.location, reason: 'unresolved_or_unversioned' })),
    omitted_context_reason: 'Only context that can change the current decision is included',
    status: unresolved.some(x => x.required) ? 'HOLD' : 'COMPILED'
  };
}
function applies(scope = '', task) {
  return Boolean(scope) && (scope === '*' || scope.includes(task.project ?? '') || scope.includes(task.domain ?? ''));
}
