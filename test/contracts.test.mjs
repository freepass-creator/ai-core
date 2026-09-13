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
