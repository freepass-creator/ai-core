import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const released = new Set(['MERGED', 'DEPLOYED']);

export function validateDevelopmentForm(form) {
  const errors = [];
  const add = (code, path) => errors.push({ code, path });
  if (!form || typeof form !== 'object' || Array.isArray(form)) return [{ code: 'FORM_REQUIRED', path: '$' }];
  if (form.schema_version !== '1.0') add('SCHEMA_VERSION_UNSUPPORTED', 'schema_version');
  if (!form.change_id || !/^[A-Z][A-Z0-9_-]*-[0-9]{3,}$/.test(form.change_id)) add('CHANGE_ID_INVALID', 'change_id');

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
    for (const criterion of criteria) if (criterion.status !== 'PASS' || !(criterion.evidence_refs ?? []).length) add('CRITERION_NOT_PROVEN', `acceptance_criteria.${criterion.id ?? '?'}`);
  }

  const review = form.review ?? {};
  if (review.status === 'PASSED') {
    if (!(review.reviewers ?? []).some(reviewer => reviewer !== form.lane?.actor)) add('INDEPENDENT_REVIEW_REQUIRED', 'review.reviewers');
    if ((review.findings ?? []).some(finding => ['FAIL', 'HOLD'].includes(finding.status))) add('REVIEW_FINDING_UNRESOLVED', 'review.findings');
  }
  const authorization = form.authorization ?? {};
  if (authorization.required && authorization.status === 'NOT_REQUIRED') add('AUTHORIZATION_STATE_INVALID', 'authorization.status');
  if (authorization.status === 'GRANTED' && (!authorization.authorized_by || !authorization.authorized_at || !(authorization.scope ?? []).length)) add('AUTHORIZATION_PROOF_REQUIRED', 'authorization');

  const release = form.release ?? {};
  if (released.has(release.state)) {
    if (verification.status !== 'PASS' || !release.revision || release.revision !== verification.subject_revision) add('RELEASE_REVISION_NOT_VERIFIED', 'release.revision');
    if (authorization.required && authorization.status !== 'GRANTED') add('RELEASE_NOT_AUTHORIZED', 'authorization.status');
  }
  const outcome = form.outcome ?? {};
  if (outcome.status === 'SUCCESS') {
    if (!released.has(release.state)) add('SUCCESS_WITHOUT_RELEASE', 'outcome.status');
    if (!(outcome.observations ?? []).some(item => item.status === 'PASS' && item.kind === 'OBSERVATION')) add('SUCCESS_OBSERVATION_REQUIRED', 'outcome.observations');
  }
  if (request.stage === 'CLOSED') {
    if (criteria.some(item => item.status !== 'PASS')) add('CLOSED_WITH_OPEN_CRITERIA', 'acceptance_criteria');
    if (!['SUCCESS', 'NOT_OBSERVED'].includes(outcome.status)) add('CLOSED_OUTCOME_UNRESOLVED', 'outcome.status');
  }
  return errors;
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
