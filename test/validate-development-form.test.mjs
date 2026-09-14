import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateDevelopmentForm } from '../scripts/validate-development-form.mjs';

const example = JSON.parse(await readFile(new URL('../examples/development-form.json', import.meta.url)));
const clone = value => structuredClone(value);
const codes = form => validateDevelopmentForm(form).map(error => error.code);

test('draft example is semantically valid', () => assert.deepEqual(validateDevelopmentForm(example), []));
test('ready requires decisions resolved and sources revisioned', () => { const f=clone(example); f.request.stage='READY'; f.request.decisions_required=['choose']; assert.ok(codes(f).includes('READY_NEEDS_DECISIONS')); assert.ok(codes(f).includes('READY_SOURCE_NOT_REVISIONED')); });
test('verification pass requires revision checks and criterion evidence', () => { const f=clone(example); f.verification.status='PASS'; const c=codes(f); assert.ok(c.includes('VERIFICATION_REVISION_REQUIRED')); assert.ok(c.includes('VERIFICATION_PASS_CHECK_REQUIRED')); assert.ok(c.includes('CRITERION_NOT_PROVEN')); });
test('review requires a reviewer other than implementer', () => { const f=clone(example); f.review={status:'PASSED',reviewers:['CODEX'],findings:[]}; assert.ok(codes(f).includes('INDEPENDENT_REVIEW_REQUIRED')); });
test('granted authorization requires proof and scope', () => { const f=clone(example); f.authorization.status='GRANTED'; assert.ok(codes(f).includes('AUTHORIZATION_PROOF_REQUIRED')); });
test('release requires exact verified revision and approval', () => { const f=clone(example); f.authorization={...f.authorization,required:true,status:'PENDING'}; f.release={state:'DEPLOYED',target:'prod',revision:'a'.repeat(40),rollback:'revert'}; const c=codes(f); assert.ok(c.includes('RELEASE_REVISION_NOT_VERIFIED')); assert.ok(c.includes('RELEASE_NOT_AUTHORIZED')); });
test('success requires released target observation', () => { const f=clone(example); f.outcome.status='SUCCESS'; const c=codes(f); assert.ok(c.includes('SUCCESS_WITHOUT_RELEASE')); assert.ok(c.includes('SUCCESS_OBSERVATION_REQUIRED')); });
test('closed work cannot retain failed criteria', () => { const f=clone(example); f.request.stage='CLOSED'; f.acceptance_criteria[0].status='FAIL'; assert.ok(codes(f).includes('CLOSED_WITH_OPEN_CRITERIA')); });
