import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { createHash } from 'node:crypto';

const released = new Set(['MERGED', 'DEPLOYED']);
const schema = JSON.parse(readFileSync(new URL('../contracts/development-form.schema.json', import.meta.url)));
const contextSchema = JSON.parse(readFileSync(new URL('../contracts/development-form-context.schema.json', import.meta.url)));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateStructure = ajv.compile(schema);
const validateContextStructure = ajv.compile(contextSchema);

function normalizeContext(input) {
  if (input instanceof Date) return { now: input, trustedReviewReceipts: [], trustedAuthorityAttestations: [] };
  const now = input?.now instanceof Date ? input.now : new Date(input?.now ?? Date.now());
  return { now, trustedReviewReceipts: input?.trustedReviewReceipts ?? [], trustedAuthorityAttestations: input?.trustedAuthorityAttestations ?? [] };
}

export function validateDevelopmentContext(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return [{ code: 'CONTEXT_REQUIRED', path: '$' }];
  const serializable = { ...input };
  if (serializable.now instanceof Date) {
    if (!Number.isFinite(serializable.now.getTime())) return [{ code: 'CONTEXT_TIME_INVALID', path: 'now' }];
    serializable.now = serializable.now.toISOString();
  }
  if (!validateContextStructure(serializable)) return validateContextStructure.errors.map(error => ({ code: `CONTEXT_SCHEMA_${error.keyword.toUpperCase()}`, path: error.instancePath || '$' }));
  if (input.now !== undefined && !Number.isFinite(new Date(input.now).getTime())) return [{ code: 'CONTEXT_TIME_INVALID', path: 'now' }];
  return [];
}

export function createTrustedReviewReceipt(receipt) {
  return { id: receipt.id, artifact_digest: receipt.artifact_digest, subject_revision: receipt.subject_revision, reviewer: receipt.reviewer, issuer: receipt.issuer };
}

export function createAuthorityAttestation(authorization) {
  const canonical = {
    action: authorization.action, target: authorization.target, revision: authorization.revision,
    scope: [...authorization.scope].sort(),
    authorized_by: { kind: authorization.authorized_by.kind, id: authorization.authorized_by.id, authority_ref: authorization.authorized_by.authority_ref },
    authorized_at: authorization.authorized_at, expires_at: authorization.expires_at
  };
  return { authority_ref: authorization.authorized_by.authority_ref, digest: `sha256:${createHash('sha256').update(JSON.stringify(canonical)).digest('hex')}` };
}

export function validateDevelopmentForm(form, input) {
  const contextErrors = input instanceof Date ? (Number.isFinite(input.getTime()) ? [] : [{ code: 'CONTEXT_TIME_INVALID', path: 'now' }]) : validateDevelopmentContext(input ?? {});
  const context = normalizeContext(input);
  const now = context.now;
  const errors = [];
  errors.push(...contextErrors);
  const add = (code, path) => errors.push({ code, path });
  if (!form || typeof form !== 'object' || Array.isArray(form)) return [{ code: 'FORM_REQUIRED', path: '$' }];
  if (!validateStructure(form)) return validateStructure.errors.map(error => ({ code: `SCHEMA_${error.keyword.toUpperCase()}`, path: error.instancePath || '$' }));

  const request = form.request ?? {};
  const sources = form.project?.authoritative_sources ?? [];
  if (!request.title?.trim()) add('TITLE_REQUIRED', 'request.title');
  if (!request.user_intent?.trim()) add('USER_INTENT_REQUIRED', 'request.user_intent');
  if (request.stage === 'READY') {
    if ((request.unknowns ?? []).length) add('READY_HAS_UNKNOWNS', 'request.unknowns');
    if ((request.decisions_required ?? []).length) add('READY_NEEDS_DECISIONS', 'request.decisions_required');
    if (!sources.length || sources.some(source => !source.revision || !source.verified_at)) add('READY_SOURCE_NOT_REVISIONED', 'project.authoritative_sources');
  }

  const criteria = form.acceptance_criteria ?? [];
  const verification = form.verification ?? {};
  const review = form.review ?? {};
  const release = form.release ?? {};
  if (!criteria.length) add('ACCEPTANCE_CRITERIA_REQUIRED', 'acceptance_criteria');
  const ids = criteria.map(item => item.id);
  if (new Set(ids).size !== ids.length) add('ACCEPTANCE_ID_DUPLICATE', 'acceptance_criteria');
  const coverage = form.delivery.coverage;
  const requiredLayers = ['FRONTEND','BACKEND','API','DATABASE','INFRA','UI','UX'];
  const layers = coverage.map(item => item.layer);
  if (new Set(layers).size !== layers.length || requiredLayers.some(layer => !layers.includes(layer))) add('COVERAGE_INCOMPLETE', 'delivery.coverage');
  for (const item of coverage) {
    if (item.status === 'IN_SCOPE' && (!item.change?.trim() || !item.affected_refs.length || !item.verification_refs.length || item.verification_refs.some(ref => !ids.includes(ref)))) add('LAYER_PLAN_INCOMPLETE', `delivery.coverage.${item.layer}`);
    if (item.status === 'OUT_OF_SCOPE' && (item.change !== null || item.affected_refs.length || item.verification_refs.length)) add('OUT_OF_SCOPE_HAS_CHANGES', `delivery.coverage.${item.layer}`);
  }
  const deliveryAdvanced = ['READY','IN_PROGRESS','IMPLEMENTED','CLOSED'].includes(request.stage) || verification.status !== 'NOT_RUN' || review.status === 'PASSED' || release.state !== 'NOT_REQUESTED';
  if (deliveryAdvanced && coverage.some(item => item.status === 'UNKNOWN')) add('DELIVERY_COVERAGE_UNKNOWN', 'delivery.coverage');
  const journey = form.delivery.journey;
  if (coverage.some(item => item.layer === 'UX' && item.status === 'IN_SCOPE') && (!journey.primary_user?.trim() || !journey.entry_point?.trim() || !journey.steps.length || !journey.success_feedback?.trim() || !journey.failure_recovery?.trim())) add('UX_JOURNEY_INCOMPLETE', 'delivery.journey');
  if (coverage.some(item => item.layer === 'UI' && item.status === 'IN_SCOPE') && (!journey.surfaces.length || journey.surfaces.some(surface => !surface.devices.length || !['DEFAULT','LOADING','EMPTY','ERROR'].every(state => surface.states.includes(state) || surface.state_exclusions.some(exclusion => exclusion.state === state && exclusion.reason.trim()))))) add('UI_STATES_INCOMPLETE', 'delivery.journey.surfaces');
  const dataLayers = coverage.filter(item => ['API','DATABASE'].includes(item.layer) && item.status === 'IN_SCOPE');
  if (dataLayers.length && !form.delivery.data_flow.length) add('DATA_FLOW_REQUIRED', 'delivery.data_flow');
  if (form.delivery.data_flow.some(flow => !flow.from.trim() || !flow.through.trim() || !flow.to.trim() || !flow.data.trim())) add('DATA_FLOW_INCOMPLETE', 'delivery.data_flow');
  if (Object.values(form.delivery.quality).some(decision => decision.details.some(detail => !detail.trim()))) add('QUALITY_DECISION_EMPTY', 'delivery.quality');
  const candidateAuthorization = form.authorization;
  const authorizationTimeValid = candidateAuthorization.status === 'GRANTED' && candidateAuthorization.authorized_by?.kind === 'HUMAN' && Date.parse(candidateAuthorization.authorized_at) <= now.getTime() && Date.parse(candidateAuthorization.expires_at) > now.getTime();
  const candidateAttestation = authorizationTimeValid ? createAuthorityAttestation(candidateAuthorization) : null;
  const authorizationTrusted = candidateAttestation && context.trustedAuthorityAttestations.some(item => item.authority_ref === candidateAttestation.authority_ref && item.digest === candidateAttestation.digest);
  const authorityRefs = new Set(sources.filter(source => source.revision && source.verified_at).map(source => source.ref));
  if (authorizationTrusted) authorityRefs.add(candidateAuthorization.authorized_by.authority_ref);
  if (form.delivery.data_flow.some(flow => flow.write && (!flow.authority?.trim() || !authorityRefs.has(flow.authority)))) add('DATA_WRITE_AUTHORITY_REQUIRED', 'delivery.data_flow');
  if (verification.status === 'PASS') {
    if (!verification.subject_revision) add('VERIFICATION_REVISION_REQUIRED', 'verification.subject_revision');
    if (!(verification.checks ?? []).some(check => check.status === 'PASS')) add('VERIFICATION_PASS_CHECK_REQUIRED', 'verification.checks');
    const evidence = [...verification.checks, ...verification.artifacts];
    if (new Set(evidence.map(item => item.id)).size !== evidence.length) add('EVIDENCE_ID_DUPLICATE', 'verification');
    const byId = new Map(evidence.map(item => [item.id, item]));
    for (const criterion of criteria) {
      const refs = criterion.evidence_refs ?? [];
      if (criterion.status !== 'PASS' || !refs.length || refs.some(ref => !byId.has(ref) || byId.get(ref).status !== 'PASS' || byId.get(ref).revision !== verification.subject_revision)) {
        add('CRITERION_NOT_PROVEN', `acceptance_criteria.${criterion.id}`);
      }
    }
  }

  if (review.status === 'PASSED') {
    if (new Set(review.receipts.map(receipt => receipt.id)).size !== review.receipts.length) add('REVIEW_RECEIPT_ID_DUPLICATE', 'review.receipts');
    const validReceipts = review.receipts.filter(receipt => receipt.verdict === 'PASS' && receipt.subject_revision === review.subject_revision && receipt.reviewer !== form.lane.actor && review.reviewers.includes(receipt.reviewer) && receipt.issuer !== form.lane.actor && receipt.artifact_digest);
    if (review.subject_revision !== verification.subject_revision || !validReceipts.length) add('REVIEW_PROOF_REQUIRED', 'review');
    if (!validReceipts.some(receipt => context.trustedReviewReceipts.some(trusted => trusted.id === receipt.id && trusted.artifact_digest === receipt.artifact_digest && trusted.subject_revision === receipt.subject_revision && trusted.reviewer === receipt.reviewer && trusted.issuer === receipt.issuer))) add('REVIEW_ATTESTATION_UNVERIFIED', 'review.receipts');
    if (!(review.reviewers ?? []).some(reviewer => reviewer !== form.lane?.actor)) add('INDEPENDENT_REVIEW_REQUIRED', 'review.reviewers');
    if ((review.findings ?? []).some(finding => ['FAIL', 'HOLD'].includes(finding.status))) add('REVIEW_FINDING_UNRESOLVED', 'review.findings');
  }
  const authorization = form.authorization ?? {};
  if (authorization.required && authorization.status === 'NOT_REQUIRED') add('AUTHORIZATION_STATE_INVALID', 'authorization.status');
  if (authorization.status === 'GRANTED') {
    if (authorization.authorized_by?.kind !== 'HUMAN' || !authorization.authorized_at || !authorization.expires_at || !authorization.action || !authorization.target?.trim() || !authorization.revision || !(authorization.scope ?? []).length) add('AUTHORIZATION_PROOF_REQUIRED', 'authorization');
    else if (Date.parse(authorization.authorized_at) > now.getTime() || Date.parse(authorization.expires_at) <= Date.parse(authorization.authorized_at) || Date.parse(authorization.expires_at) <= now.getTime()) add('AUTHORIZATION_EXPIRED', 'authorization.expires_at');
    const expectedAttestation = authorization.authorized_by?.kind === 'HUMAN' ? createAuthorityAttestation(authorization) : null;
    if (!expectedAttestation || !context.trustedAuthorityAttestations.some(attestation => attestation.authority_ref === expectedAttestation.authority_ref && attestation.digest === expectedAttestation.digest)) add('AUTHORITY_ATTESTATION_UNVERIFIED', 'authorization.authorized_by.authority_ref');
  }

  if (release.state === 'READY') {
    if (!release.requested_action || !release.target?.trim() || !release.revision) add('RELEASE_REQUEST_INCOMPLETE', 'release');
    if (authorization.required && (authorization.action !== release.requested_action || authorization.target !== release.target || authorization.revision !== release.revision)) add('RELEASE_AUTHORIZATION_SCOPE_MISMATCH', 'authorization');
  }
  if (released.has(release.state)) {
    if (verification.status !== 'PASS' || !release.revision || release.revision !== verification.subject_revision) add('RELEASE_REVISION_NOT_VERIFIED', 'release.revision');
    if (!release.target?.trim() || !release.released_at) add('RELEASE_TARGET_TIME_REQUIRED', 'release');
    if (authorization.required && authorization.status !== 'GRANTED') add('RELEASE_NOT_AUTHORIZED', 'authorization.status');
    if (review.status !== 'PASSED' || review.subject_revision !== release.revision) add('RELEASE_NOT_REVIEWED', 'review');
    const expectedAction = release.state === 'DEPLOYED' ? 'DEPLOY' : 'MERGE';
    if (authorization.required && (authorization.action !== expectedAction || authorization.target !== release.target || authorization.revision !== release.revision)) add('RELEASE_AUTHORIZATION_SCOPE_MISMATCH', 'authorization');
  }
  const outcome = form.outcome ?? {};
  if (outcome.status === 'SUCCESS') {
    if (!released.has(release.state)) add('SUCCESS_WITHOUT_RELEASE', 'outcome.status');
    if (!(outcome.observations ?? []).some(item => item.status === 'PASS' && item.kind === 'OBSERVATION' && item.revision === release.revision && item.target === release.target && item.observed_at && release.released_at && Date.parse(item.observed_at) >= Date.parse(release.released_at))) add('SUCCESS_OBSERVATION_REQUIRED', 'outcome.observations');
  }
  if (request.stage === 'CLOSED') {
    if (criteria.some(item => item.status !== 'PASS')) add('CLOSED_WITH_OPEN_CRITERIA', 'acceptance_criteria');
    if (release.state !== 'NOT_REQUESTED' && outcome.status !== 'SUCCESS') add('CLOSED_OUTCOME_UNRESOLVED', 'outcome.status');
  }
  return errors;
}

export function deriveActions(form, context = {}) {
  const invalid = validateDevelopmentForm(form, context);
  const structural = invalid.filter(error => error.code.startsWith('SCHEMA_') || error.code.startsWith('CONTEXT_'));
  const result = {};
  const set = (name, reasons) => { const all = [...new Set([...structural.map(error => error.code), ...reasons])]; result[name] = { enabled: all.length === 0, reasons: all }; };
  set('save_draft', !form?.request?.title || !form?.request?.user_intent ? ['IDENTITY_OR_INTENT_REQUIRED'] : []);
  set('mark_ready', [
    (form?.request?.unknowns ?? []).length && 'UNKNOWNS',
    (form?.request?.decisions_required ?? []).length && 'DECISIONS',
    (!(form?.project?.authoritative_sources ?? []).length || form.project.authoritative_sources.some(source => !source.revision || !source.verified_at)) && 'SOURCES',
    form?.delivery?.coverage?.some(item => item.status === 'UNKNOWN') && 'COVERAGE_UNKNOWN',
    invalid.some(error => ['COVERAGE_INCOMPLETE','LAYER_PLAN_INCOMPLETE','OUT_OF_SCOPE_HAS_CHANGES','UX_JOURNEY_INCOMPLETE','UI_STATES_INCOMPLETE','DATA_FLOW_REQUIRED','DATA_FLOW_INCOMPLETE','DATA_WRITE_AUTHORITY_REQUIRED','QUALITY_DECISION_EMPTY'].includes(error.code)) && 'DELIVERY_PLAN_INVALID'
  ].filter(Boolean));
  const deliveryInvalid = invalid.some(error => ['DELIVERY_COVERAGE_UNKNOWN','COVERAGE_INCOMPLETE','LAYER_PLAN_INCOMPLETE','OUT_OF_SCOPE_HAS_CHANGES','UX_JOURNEY_INCOMPLETE','UI_STATES_INCOMPLETE','DATA_FLOW_REQUIRED','DATA_FLOW_INCOMPLETE','DATA_WRITE_AUTHORITY_REQUIRED','QUALITY_DECISION_EMPTY'].includes(error.code));
  set('start_isolated_work', [form?.request?.stage !== 'READY' && 'REQUEST_NOT_READY', !context.laneAvailable && 'LANE_NOT_AVAILABLE', deliveryInvalid && 'DELIVERY_PLAN_INVALID'].filter(Boolean));
  set('run_verification', [!form?.lane?.head_revision && 'IMPLEMENTATION_REVISION_REQUIRED', !context.implementationExists && 'IMPLEMENTATION_NOT_FOUND', deliveryInvalid && 'DELIVERY_PLAN_INVALID'].filter(Boolean));
  set('request_review', [!(form?.verification?.status === 'PASS' && form.verification.subject_revision === form.lane?.head_revision) && 'CURRENT_REVISION_NOT_VERIFIED', deliveryInvalid && 'DELIVERY_PLAN_INVALID'].filter(Boolean));
  set('request_authorization', [!(form?.authorization?.required && !['PENDING','GRANTED'].includes(form.authorization.status)) && 'AUTHORIZATION_REQUEST_NOT_NEEDED', deliveryInvalid && 'DELIVERY_PLAN_INVALID'].filter(Boolean));
  set('safe_commit_push', [form?.request?.stage !== 'IN_PROGRESS' && 'WORK_NOT_IN_PROGRESS', !context.checksConfigured && 'CHECKS_NOT_CONFIGURED', !(context.selectedPaths ?? []).length && 'PATHS_NOT_SELECTED', deliveryInvalid && 'DELIVERY_PLAN_INVALID'].filter(Boolean));
  set('merge_or_deploy', [form?.release?.state !== 'READY' && 'RELEASE_NOT_READY', !form?.release?.requested_action && 'RELEASE_ACTION_REQUIRED', !form?.release?.target?.trim() && 'RELEASE_TARGET_REQUIRED', form?.release?.revision !== form?.verification?.subject_revision && 'RELEASE_REVISION_MISMATCH', form?.verification?.status !== 'PASS' && 'VERIFICATION_REQUIRED', form?.review?.status !== 'PASSED' && 'REVIEW_REQUIRED', invalid.length && 'FORM_OR_GATE_INVALID', form?.authorization?.required && form.authorization.status !== 'GRANTED' && 'AUTHORIZATION_REQUIRED'].filter(Boolean));
  set('observe_outcome', [!released.has(form?.release?.state) && 'RELEASE_REQUIRED', (!form?.release?.revision || !form?.release?.target?.trim() || !form?.release?.released_at) && 'RELEASE_EVIDENCE_REQUIRED', invalid.length && 'FORM_OR_GATE_INVALID'].filter(Boolean));
  set('close', [!form?.acceptance_criteria?.every(item => item.status === 'PASS') && 'CRITERIA_NOT_COMPLETE', form?.release?.state !== 'NOT_REQUESTED' && form?.outcome?.status !== 'SUCCESS' && 'OUTCOME_NOT_PROVEN', invalid.length && 'FORM_OR_GATE_INVALID'].filter(Boolean));
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = process.argv[2];
  if (!path) { console.error(JSON.stringify({ status: 'HOLD_FORM_PATH_REQUIRED' })); process.exitCode = 1; }
  else try {
    const errors = validateDevelopmentForm(JSON.parse(await readFile(resolve(path), 'utf8')));
    console.log(JSON.stringify({ status: errors.length ? 'HOLD_INVALID_FORM' : 'PASS', errors }, null, 2));
    if (errors.length) process.exitCode = 1;
  } catch (error) { console.error(JSON.stringify({ status: 'HOLD_FORM_READ_FAILED', reason: error.message })); process.exitCode = 1; }
}
