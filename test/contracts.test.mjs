import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function readContract(name) {
  return JSON.parse(fs.readFileSync(new URL(`../contracts/${name}`, import.meta.url), 'utf8'));
}

test('task schema preserves fail-closed human action inputs', () => {
  const schema = readContract('task.schema.json');
  assert.ok(schema.required.includes('external_effect'));
  assert.equal(schema.properties.applicable_domains.uniqueItems, true);
  const action = schema.properties.proposed_actions.items;
  assert.deepEqual(action.required, ['description', 'effect', 'reversible']);
  assert.equal(action.additionalProperties, false);
  assert.ok(schema.properties.allowed_scope);
  assert.ok(schema.properties.forbidden_scope);
  assert.equal(schema.additionalProperties, false);
  assert.ok(schema.properties.decision_questions.items.properties.resolution_ref);
});

test('human context schema binds sanitized memories and verified answers', () => {
  const schema = readContract('human-context.schema.json');
  assert.equal(schema.additionalProperties, false);
  const memory = schema.$defs.memoryClaim;
  assert.ok(memory.required.includes('rule_key'));
  assert.ok(memory.required.includes('authority'));
  assert.ok(memory.required.includes('sanitized'));
  assert.equal(memory.additionalProperties, false);
  assert.ok(memory.allOf.some(rule => (
    rule.if?.properties?.kind?.enum?.includes('preference')
    && rule.then?.required?.includes('expires_at')
  )));

  const resolution = schema.$defs.verifiedQuestionResolution;
  assert.ok(resolution.required.includes('task_id'));
  assert.ok(resolution.required.includes('question_context_digest'));
  assert.ok(resolution.required.includes('resolution_summary'));
  assert.ok(resolution.required.includes('sanitized'));
  assert.equal(resolution.additionalProperties, false);

  const confirmation = schema.$defs.verifiedIntentConfirmation;
  assert.ok(confirmation.required.includes('task_id'));
  assert.ok(confirmation.required.includes('intent_context_digest'));
});

test('proof receipt schema binds source and capability revision sets', () => {
  const schema = readContract('proof-receipt.schema.json');
  assert.ok(schema.required.includes('source_revision_set_digest'));
  assert.ok(schema.required.includes('capability_revision_set_digest'));
  assert.ok(schema.required.includes('failures'));
  assert.ok(schema.required.includes('skips'));
});

test('Plan Slice, Runtime Head and Work Return contracts are strict and non-authorizing', () => {
  const plan = readContract('plan-slice.schema.json');
  const runtime = readContract('runtime-head.schema.json');
  const workReturn = readContract('work-return.schema.json');
  const stewardship = readContract('stewardship-state.schema.json');
  const portfolio = readContract('portfolio-snapshot.schema.json');
  assert.equal(plan.additionalProperties, false);
  assert.equal(plan.properties.authorization.const, 'NOT_GRANTED');
  assert.equal(plan.properties.trust_boundary.properties.issued_slice_store.const, 'NOT_IMPLEMENTED');
  assert.equal(runtime.additionalProperties, false);
  assert.equal(runtime.properties.authorization.const, 'NOT_GRANTED');
  assert.ok(runtime.required.includes('latest_slice_issued_at'));
  assert.equal(workReturn.additionalProperties, false);
  assert.equal(workReturn.properties.action_results.items.additionalProperties, false);
  assert.equal(
    workReturn.properties.action_results.items.properties.start_subject_revision.type,
    'string',
  );
  assert.equal(stewardship.additionalProperties, false);
  assert.equal(stewardship.properties.composite_support_score.type, 'null');
  assert.equal(portfolio.additionalProperties, false);
  assert.equal(portfolio.properties.commitments.items.additionalProperties, false);
  for (const field of ['dependencies', 'resource_claims', 'priority']) {
    assert.ok(portfolio.properties.commitments.items.required.includes(field));
  }
  for (const field of ['system', 'kind', 'location', 'revision_or_sha']) {
    assert.equal(plan.properties.source_revision_set.items.properties[field].type, 'string');
  }
  for (const field of ['id', 'scope', 'location', 'revision_or_sha']) {
    assert.equal(plan.properties.capability_revision_set.items.properties[field].type, 'string');
  }
});
