import { capabilityIndex, projectIndex, validateCapabilityRegistryReferences } from './capability-registry.mjs';
import { routeCapability } from './capability-router.mjs';
import { normalizeAdapterResult } from './adapter-contract.mjs';
import { createWorkResult } from './result-envelope.mjs';
import { createProjectRuntime } from './project-runtime.mjs';
import { createDefaultBuiltins } from './builtins.mjs';

const nonempty = value => typeof value === 'string' && value.trim() === value && value.length > 0;

function missingInputs(capability, input) {
  return capability.inputs.filter(item => item.required && (input?.[item.name] === undefined || input?.[item.name] === null))
    .map(item => item.name);
}

function authorityShapeMatches(authority, plan, capability) {
  if (!authority || authority.schema !== 'ai-core-authority-receipt/v1' || authority.status !== 'GRANTED') return false;
  if (authority.order_id !== plan.order_id || authority.work_id !== plan.work_id) return false;
  if (authority.capability_id !== capability.id || authority.project_id !== plan.project_id) return false;
  if (authority.subject_revision !== plan.subject_revision) return false;
  if (plan.work_id && authority.work_id !== plan.work_id) return false;
  if (!Array.isArray(authority.scopes) || typeof authority.ledger_head !== 'string' || !authority.ledger_head) return false;
  return capability.required_scopes.every(scope => authority.scopes.includes(scope));
}

export function createCapabilityEngine({
  capabilityRegistry,
  projectRegistry,
  builtins = null,
  runtime = createProjectRuntime(),
  verifyAuthority = null,
  authorityProvider = null,
  readWorkProjection = null,
  clock = Date.now,
} = {}) {
  validateCapabilityRegistryReferences(capabilityRegistry, projectRegistry);
  const capabilities = capabilityIndex(capabilityRegistry);
  const projects = projectIndex(projectRegistry);
  const builtinAdapters = builtins ?? createDefaultBuiltins({ readWorkProjection });

  function plan({ text, projectHint = null, orderId = null, workId = null } = {}) {
    const routed = routeCapability({ text, projectHint, capabilityRegistry, projectRegistry });
    if (routed.status !== 'ROUTED') return { status: 'HOLD', reason: routed.status, route: routed };
    const capability = capabilities.get(routed.capability_id);
    const project = projects.get(routed.project_id);
    if (!capability || !project) return { status: 'HOLD', reason: 'ROUTE_TARGET_MISSING', route: routed };
    if (project.status !== 'ACTIVE') return { status: 'HOLD', reason: 'PROJECT_NOT_ACTIVE', route: routed };
    return {
      status: 'PLANNED',
      capability_id: capability.id,
      project_id: project.project_id,
      subject_revision: project.head_revision,
      order_id: nonempty(orderId) ? orderId : null,
      work_id: nonempty(workId) ? workId : null,
      mode: capability.mode,
      adapter: structuredClone(capability.adapter),
      required_scopes: [...capability.required_scopes],
      walls: [...capability.walls],
      matched_terms: [...routed.matched_terms],
      route_score: routed.score,
      result_contract: capability.result_contract,
      authorization_source: null,
    };
  }

  async function run({ text, projectHint = null, orderId = null, workId = null, input = {}, perform = false, authority = null } = {}) {
    let preparedPlan = plan({ text, projectHint, orderId, workId });
    if (preparedPlan.status !== 'PLANNED') {
      return createWorkResult({
        plan: preparedPlan.route ? { capability_id: preparedPlan.route.capability_id ?? null, project_id: preparedPlan.route.project_id ?? null } : null,
        status: 'HOLD',
        summary: '실행 경로를 확정하지 못했습니다.',
        blockers: [preparedPlan.reason],
        nextAction: '요청 대상 또는 capability를 확인합니다.',
        clock,
      });
    }

    const capability = capabilities.get(preparedPlan.capability_id);
    const project = projects.get(preparedPlan.project_id);
    let effectiveAuthority = authority;
    const missing = missingInputs(capability, input);
    if (missing.length) {
      return createWorkResult({
        plan: preparedPlan,
        status: 'HOLD',
        summary: 'capability 입력이 부족합니다.',
        blockers: missing.map(name => `INPUT_REQUIRED_${name.toUpperCase()}`),
        nextAction: '필수 입력을 채운 뒤 다시 실행합니다.',
        clock,
      });
    }

    if (capability.mode === 'EXTERNAL_MUTATION') {
      if (!perform) {
        const command = ['PROJECT_COMMAND', 'PROJECT_REGISTRY_COMMAND'].includes(capability.adapter.kind)
          ? await runtime.prepareCommand(capability, project)
          : null;
        return createWorkResult({
          plan: preparedPlan,
          status: 'PREPARED',
          summary: '외부 변경 capability를 준비했습니다. 실행 권한은 아직 사용하지 않았습니다.',
          adapterResult: {
            data: { prepared: command, required_scopes: capability.required_scopes, walls: capability.walls },
            evidence: [],
            artifacts: [],
            checks: [{ name: 'authority', status: 'SKIP', detail: 'perform=false' }],
            blockers: [],
            external_effect: false,
          },
          performed: false,
          nextAction: 'Control Tower의 현재 revision 승인 receipt를 확인한 뒤 실행합니다.',
          clock,
        });
      }
      if (!preparedPlan.order_id || !preparedPlan.work_id) {
        return createWorkResult({
          plan: preparedPlan,
          status: 'HOLD',
          summary: '외부 변경은 정본 order/work 문맥 없이 실행할 수 없습니다.',
          blockers: ['EXECUTION_CONTEXT_REQUIRED'],
          nextAction: '현재 order_id와 work_id를 정본 projection에서 확인합니다.',
          clock,
        });
      }
      if (!effectiveAuthority && typeof authorityProvider === 'function') {
        effectiveAuthority = await authorityProvider({
          plan: structuredClone(preparedPlan),
          capability: structuredClone(capability),
        });
      }
      if (effectiveAuthority?.status === 'HOLD') {
        return createWorkResult({
          plan: preparedPlan,
          status: 'HOLD',
          summary: '현재 Control Tower 상태에서 실행 권한 receipt를 만들 수 없습니다.',
          blockers: [effectiveAuthority.reason ?? 'AUTHORITY_NOT_AVAILABLE'],
          nextAction: '현재 work 상태·direction·원장 head를 확인합니다.',
          clock,
        });
      }
      if (!authorityShapeMatches(effectiveAuthority, preparedPlan, capability)) {
        return createWorkResult({
          plan: preparedPlan,
          status: 'HOLD',
          summary: '외부 변경에 필요한 현재 revision 권한이 없습니다.',
          blockers: ['AUTHORITY_RECEIPT_INVALID'],
          nextAction: '현재 work/project/revision과 scope가 일치하는 승인 receipt가 필요합니다.',
          clock,
        });
      }
      if (typeof verifyAuthority !== 'function') {
        return createWorkResult({
          plan: preparedPlan,
          status: 'HOLD',
          summary: '승인 receipt를 검증할 신뢰 배선이 없습니다.',
          blockers: ['AUTHORITY_VERIFIER_REQUIRED'],
          nextAction: 'Control Tower 검증기를 실행 엔진에 주입합니다.',
          clock,
        });
      }
      const verified = await verifyAuthority({ authority: structuredClone(effectiveAuthority), plan: structuredClone(preparedPlan), capability: structuredClone(capability) });
      if (verified !== true) {
        return createWorkResult({
          plan: preparedPlan,
          status: 'HOLD',
          summary: '승인 receipt가 정본 검증을 통과하지 못했습니다.',
          blockers: ['AUTHORITY_NOT_VERIFIED'],
          nextAction: '원장 head와 승인 근거를 다시 확인합니다.',
          clock,
        });
      }
      preparedPlan = { ...preparedPlan, authorization_source: effectiveAuthority.receipt_id ?? effectiveAuthority.ledger_event_id ?? effectiveAuthority.ledger_head };
    }

    if (capability.mode === 'LOCAL_MUTATION' && !perform) {
      const command = ['PROJECT_COMMAND', 'PROJECT_REGISTRY_COMMAND'].includes(capability.adapter.kind)
        ? await runtime.prepareCommand(capability, project)
        : null;
      return createWorkResult({
        plan: preparedPlan,
        status: 'PREPARED',
        summary: '로컬 실행 capability를 준비했습니다.',
        adapterResult: {
          data: { prepared: command },
          evidence: [],
          artifacts: [],
          checks: [{ name: capability.id, status: 'SKIP', detail: 'perform=false' }],
          blockers: [],
          external_effect: false,
        },
        performed: false,
        nextAction: 'perform=true로 실행하면 현재 project revision을 다시 확인합니다.',
        clock,
      });
    }

    const startedAt = new Date(clock()).toISOString();
    try {
      let result;
      if (capability.adapter.kind === 'BUILTIN') {
        const adapter = builtinAdapters.get?.(capability.adapter.id) ?? builtinAdapters[capability.adapter.id];
        if (!adapter || typeof adapter.invoke !== 'function') throw new Error('BUILTIN_ADAPTER_MISSING');
        if (!adapter.modes.includes(capability.mode)) throw new Error('BUILTIN_ADAPTER_MODE_MISMATCH');
        result = await adapter.invoke({ plan: preparedPlan, capability, project, input, authority: effectiveAuthority ?? authority });
      } else if (capability.adapter.kind === 'PROJECT_MODULE') {
        result = normalizeAdapterResult(await runtime.runModule(capability, project, input));
      } else if (['PROJECT_COMMAND', 'PROJECT_REGISTRY_COMMAND'].includes(capability.adapter.kind)) {
        result = normalizeAdapterResult(await runtime.runCommand(capability, project));
      } else {
        throw new Error('CAPABILITY_ADAPTER_KIND_UNSUPPORTED');
      }
      const finalStatus = result.status === 'SUCCEEDED' ? 'SUCCEEDED' : result.status;
      return createWorkResult({
        plan: preparedPlan,
        status: finalStatus,
        adapterResult: result,
        performed: true,
        startedAt,
        clock,
      });
    } catch (error) {
      return createWorkResult({
        plan: preparedPlan,
        status: 'HOLD',
        summary: 'capability 실행 전제 또는 실행 경계에서 중단했습니다.',
        performed: false,
        startedAt,
        blockers: [error?.message || 'CAPABILITY_EXECUTION_FAILED'],
        nextAction: 'blocker를 해소한 뒤 같은 정본 revision에서 다시 계획합니다.',
        clock,
      });
    }
  }

  return Object.freeze({ plan, run });
}
