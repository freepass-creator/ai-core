export function compileContext({
  task,
  sourcePointers = [],
  capabilityRefs = [],
  failures = [],
  decisions = []
}) {
  const unresolved = sourcePointers.filter(source => (
    source.status === 'unresolved' || !source.revision_or_sha
  ));

  return {
    task_id: task.task_id,
    source_pointers: sourcePointers.filter(source => source.status === 'authoritative'),
    capability_refs: capabilityRefs.filter(reference => (
      ['authoritative', 'adopted'].includes(reference.status)
    )),
    relevant_failures: failures.filter(failure => applies(failure.scope, task)),
    relevant_decisions: decisions.filter(decision => applies(decision.scope, task)),
    uncertainties: unresolved.map(source => ({
      system: source.system,
      kind: source.kind,
      location: source.location,
      reason: source.reason ?? 'unresolved_or_unversioned'
    })),
    omitted_context_reason: 'Only context that can change the current decision is included',
    status: unresolved.some(source => source.required) ? 'HOLD' : 'COMPILED'
  };
}

function applies(scope = '', task) {
  return Boolean(scope) && (
    scope === '*'
    || scope.includes(task.project ?? '')
    || scope.includes(task.domain ?? '')
  );
}
