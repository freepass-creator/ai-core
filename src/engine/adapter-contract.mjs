export const ADAPTER_CONTRACT = 'ai-core-capability-adapter/v1';
export const ADAPTER_STATUSES = Object.freeze(['SUCCEEDED', 'HOLD', 'FAILED']);

const need = (condition, code) => { if (!condition) throw new Error(code); };
const nonempty = value => typeof value === 'string' && value.trim() === value && value.length > 0;

export function normalizeAdapterResult(value) {
  need(value && typeof value === 'object' && !Array.isArray(value), 'ADAPTER_RESULT_INVALID');
  need(ADAPTER_STATUSES.includes(value.status), 'ADAPTER_STATUS_INVALID');
  const evidence = value.evidence ?? [];
  const artifacts = value.artifacts ?? [];
  const checks = value.checks ?? [];
  const blockers = value.blockers ?? [];
  need(Array.isArray(evidence) && evidence.every(nonempty), 'ADAPTER_EVIDENCE_INVALID');
  need(Array.isArray(artifacts) && artifacts.every(nonempty), 'ADAPTER_ARTIFACTS_INVALID');
  need(Array.isArray(blockers) && blockers.every(nonempty), 'ADAPTER_BLOCKERS_INVALID');
  need(Array.isArray(checks) && checks.every(item => item && typeof item === 'object'
    && nonempty(item.name) && ['PASS', 'FAIL', 'SKIP'].includes(item.status)), 'ADAPTER_CHECKS_INVALID');
  need(value.execution_authorized !== true && value.completion_authorized !== true, 'ADAPTER_MUST_NOT_GRANT_AUTHORITY');
  return {
    status: value.status,
    summary: nonempty(value.summary) ? value.summary : '',
    data: value.data ?? null,
    evidence: [...evidence],
    artifacts: [...artifacts],
    checks: checks.map(item => ({ name: item.name, status: item.status, detail: item.detail ?? null })),
    blockers: [...blockers],
    next_action: nonempty(value.next_action) ? value.next_action : null,
    external_effect: value.external_effect === true,
  };
}

export function defineCapabilityAdapter({ id, modes, invoke }) {
  need(nonempty(id), 'ADAPTER_ID_REQUIRED');
  need(Array.isArray(modes) && modes.length > 0
    && modes.every(mode => ['READ_ONLY', 'LOCAL_MUTATION', 'EXTERNAL_MUTATION'].includes(mode)), 'ADAPTER_MODES_INVALID');
  need(typeof invoke === 'function', 'ADAPTER_INVOKE_REQUIRED');
  return Object.freeze({
    contract: ADAPTER_CONTRACT,
    id,
    modes: Object.freeze([...new Set(modes)]),
    async invoke(context) {
      const result = await invoke(context);
      return normalizeAdapterResult(result);
    },
  });
}
