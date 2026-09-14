import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const released = new Set(['MERGED', 'DEPLOYED']);
const schema = JSON.parse(readFileSync(new URL('../contracts/development-form.schema.json', import.meta.url)));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateStructure = ajv.compile(schema);

export function validateDevelopmentForm(form) {
  const errors = [];
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
  if (!criteria.length) add('ACCEPTANCE_CRITERIA_REQUIRED', 'acceptance_criteria');
  const ids = criteria.map(item => item.id);
  if (new Set(ids).size !== ids.length) add('ACCEPTANCE_ID_DUPLICATE', 'acceptance_criteria');
  const verification = form.verification ?? {};
  if (verification.status === 'PASS') {
    if (!verification.subject_revision) add('VERIFICATION_REVISION_REQUIRED', 'verification.subject_revision');
    if (!(verification.checks ?? []).some(check => check.status === 'PASS')) add('VERIFICATION_PASS_CHECK_REQUIRED', 'verification.checks');
    const evidence = [...verification.checks, ...verification.artifacts];
    const byId = new Map(evidence.map(item => [item.id, item]));
    for (const criterion of criteria) {
      const refs = criterion.evidence_refs ?? [];
      if (criterion.status !== 'PASS' || !refs.length || refs.some(ref => !byId.has(ref) || byId.get(ref).status !== 'PASS' || byId.get(ref).revision !== verification.subject_revision)) {
        add('CRITERION_NOT_PROVEN', `acceptance_criteria.${criterion.id}`);
      }
    }
  }

  const review = form.review ?? {};
  if (review.status === 'PASSED') {
    if (review.subject_revision !== verification.subject_revision || !review.receipt_refs.length) add('REVIEW_PROOF_REQUIRED', 'review');
    if (!(review.reviewers ?? []).some(reviewer => reviewer !== form.lane?.actor)) add('INDEPENDENT_REVIEW_REQUIRED', 'review.reviewers');
    if ((review.findings ?? []).some(finding => ['FAIL', 'HOLD'].includes(finding.status))) add('REVIEW_FINDING_UNRESOLVED', 'review.findings');
  }
  const authorization = form.authorization ?? {};
  if (authorization.required && authorization.status === 'NOT_REQUIRED') add('AUTHORIZATION_STATE_INVALID', 'authorization.status');
  if (authorization.status === 'GRANTED' && (!authorization.authorized_by || ['CODEX','CURSOR','CLAUDE','GEMINI'].includes(authorization.authorized_by.toUpperCase()) || !authorization.authorized_at || !authorization.expires_at || !authorization.action || !authorization.target || !authorization.revision || !(authorization.scope ?? []).length)) add('AUTHORIZATION_PROOF_REQUIRED', 'authorization');

  const release = form.release ?? {};
  if (released.has(release.state)) {
    if (verification.status !== 'PASS' || !release.revision || release.revision !== verification.subject_revision) add('RELEASE_REVISION_NOT_VERIFIED', 'release.revision');
    if (authorization.required && authorization.status !== 'GRANTED') add('RELEASE_NOT_AUTHORIZED', 'authorization.status');
    if (review.status !== 'PASSED' || review.subject_revision !== release.revision) add('RELEASE_NOT_REVIEWED', 'review');
    const expectedAction = release.state === 'DEPLOYED' ? 'DEPLOY' : 'MERGE';
    if (authorization.required && (authorization.action !== expectedAction || authorization.target !== release.target || authorization.revision !== release.revision)) add('RELEASE_AUTHORIZATION_SCOPE_MISMATCH', 'authorization');
  }
  const outcome = form.outcome ?? {};
  if (outcome.status === 'SUCCESS') {
    if (!released.has(release.state)) add('SUCCESS_WITHOUT_RELEASE', 'outcome.status');
    if (!(outcome.observations ?? []).some(item => item.status === 'PASS' && item.kind === 'OBSERVATION' && item.revision === release.revision && item.target === release.target && item.observed_at)) add('SUCCESS_OBSERVATION_REQUIRED', 'outcome.observations');
  }
  if (request.stage === 'CLOSED') {
    if (criteria.some(item => item.status !== 'PASS')) add('CLOSED_WITH_OPEN_CRITERIA', 'acceptance_criteria');
    if (release.state !== 'NOT_REQUESTED' && outcome.status !== 'SUCCESS') add('CLOSED_OUTCOME_UNRESOLVED', 'outcome.status');
  }
  return errors;
}

export function deriveActions(form) {
  const invalid = validateDevelopmentForm(form);
  const has = code => invalid.some(error => error.code === code);
  const result = {};
  const set = (name, reasons) => { result[name] = { enabled: reasons.length === 0, reasons }; };
  set('save_draft', !form?.request?.title || !form?.request?.user_intent ? ['IDENTITY_OR_INTENT_REQUIRED'] : []);
  set('mark_ready', [
    (form?.request?.unknowns ?? []).length && 'UNKNOWNS',
    (form?.request?.decisions_required ?? []).length && 'DECISIONS',
    (!(form?.project?.authoritative_sources ?? []).length || form.project.authoritative_sources.some(source => !source.revision || !source.verified_at)) && 'SOURCES'
  ].filter(Boolean));
  set('start_isolated_work', form?.request?.stage === 'READY' ? [] : ['REQUEST_NOT_READY']);
  set('run_verification', form?.lane?.head_revision ? [] : ['IMPLEMENTATION_REVISION_REQUIRED']);
  set('request_review', form?.verification?.status === 'PASS' && form.verification.subject_revision === form.lane?.head_revision ? [] : ['CURRENT_REVISION_NOT_VERIFIED']);
  set('safe_commit_push', form?.request?.stage === 'IN_PROGRESS' ? [] : ['WORK_NOT_IN_PROGRESS']);
  set('request_authorization', form?.authorization?.required && form.authorization.status === 'PENDING' ? [] : ['AUTHORIZATION_NOT_PENDING']);
  set('merge_or_deploy', released.has(form?.release?.state) && !invalid.some(error => error.code.startsWith('RELEASE_')) ? [] : ['RELEASE_GATE_CLOSED']);
  set('observe_outcome', released.has(form?.release?.state) && form.release.revision ? [] : ['RELEASE_REQUIRED']);
  set('close', form?.acceptance_criteria?.every(item => item.status === 'PASS') && (form.release?.state === 'NOT_REQUESTED' || form.outcome?.status === 'SUCCESS') ? [] : ['COMPLETION_EVIDENCE_REQUIRED']);
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
