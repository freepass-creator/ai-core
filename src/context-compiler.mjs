import { effectiveDomains } from './domain-policy.mjs';

export function compileContext({
  task,
  sourcePointers = [],
  capabilityRefs = [],
  failures = [],
  decisions = []
}) {
  const safeSources = Array.isArray(sourcePointers) ? sourcePointers : [];
  const safeCapabilities = Array.isArray(capabilityRefs) ? capabilityRefs : [];
  const safeFailures = Array.isArray(failures) ? failures : [];
  const safeDecisions = Array.isArray(decisions) ? decisions : [];
  const unresolved = safeSources.filter(source => (
    source.status === 'unresolved' || !source.revision_or_sha
  ));

  return {
    task_id: task.task_id,
    source_pointers: safeSources
      .filter(source => source.status === 'authoritative')
      .map(safePointer),
    capability_refs: safeCapabilities.filter(reference => (
      ['authoritative', 'adopted'].includes(reference.status)
    )).map(safeCapabilityRef),
    relevant_failures: safeFailures
      .filter(failure => applies(failure, task))
      .map(safeContextEntry),
    relevant_decisions: safeDecisions
      .filter(decision => applies(decision, task))
      .map(safeContextEntry),
    uncertainties: unresolved.map(source => ({
      system: source.system,
      kind: source.kind,
      location: source.location,
      reason: safeReason(source.reason)
    })),
    omitted_context_reason: 'Only context that can change the current decision is included',
    status: unresolved.some(source => source.required) ? 'HOLD' : 'COMPILED'
  };
}

function safeReason(reason) {
  return typeof reason === 'string' && /^[A-Z0-9_:-]+$/.test(reason)
    ? reason
    : 'unresolved_or_unversioned';
}

function safePointer(pointer) {
  return {
    system: pointer?.system ?? null,
    kind: pointer?.kind ?? null,
    status: pointer?.status ?? null,
    location: pointer?.location ?? null,
    revision_or_sha: pointer?.revision_or_sha ?? null,
    ...(pointer?.revision_kind ? { revision_kind: pointer.revision_kind } : {}),
    ...(pointer?.scope ? { scope: pointer.scope } : {})
  };
}

function safeCapabilityRef(reference) {
  return {
    scope: reference?.scope ?? null,
    asset_id: reference?.asset_id ?? null,
    status: reference?.status ?? null,
    location: reference?.location ?? null,
    revision_or_sha: reference?.revision_or_sha ?? null,
    ...(reference?.revision_kind ? { revision_kind: reference.revision_kind } : {})
  };
}

function safeContextEntry(entry) {
  const output = {
    id: entry?.id ?? null,
    scope: entry.scope
  };
  for (const field of ['kind', 'rule_key', 'decision', 'status', 'severity', 'observed_at']) {
    if (typeof entry?.[field] === 'string') output[field] = entry[field];
  }
  if (entry?.sanitized === true && typeof entry?.summary === 'string') {
    output.summary = entry.summary;
    output.sanitized = true;
  }
  if (
    entry?.source_ref?.location
    && (entry.source_ref.revision_or_sha || entry.source_ref.observed_at)
  ) {
    output.source_ref = {
      location: entry.source_ref.location,
      ...(entry.source_ref.revision_or_sha
        ? { revision_or_sha: entry.source_ref.revision_or_sha }
        : { observed_at: entry.source_ref.observed_at })
    };
  }
  if (entry?.authority === 'transfer_gate') output.authority = 'transfer_gate';
  return output;
}

function matchesSelector(scope, selector, kind) {
  if (!selector) return false;
  const root = `${kind}:${selector}`;
  return scope === root
    || scope.startsWith(`${root}.`)
    || scope.startsWith(`${root}/`)
    || scope.startsWith(`${root}:`);
}

function applies(entry, task) {
  const rawScope = entry?.scope;
  if (typeof rawScope !== 'string') return false;
  const scope = rawScope.trim();
  if (!scope) return false;
  if (scope === '*') {
    return entry.authority === 'transfer_gate' && entry.sanitized === true;
  }
  if (matchesSelector(scope, task.project, 'project')) return true;
  const domains = effectiveDomains(task);
  return domains.some(domain => matchesSelector(scope, domain, 'domain'));
}
