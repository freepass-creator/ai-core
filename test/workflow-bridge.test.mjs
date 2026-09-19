import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { validateWorkflowBridges } from '../scripts/validate-workflow-bridges.mjs';

const bridges = JSON.parse(readFileSync(new URL('../registry/workflow-bridges.json', import.meta.url), 'utf8'));
const workflows = JSON.parse(readFileSync(new URL('../registry/workflows.json', import.meta.url), 'utf8'));

test('workflow bridge registry is schema-valid and semantically consistent', () => {
  const result = validateWorkflowBridges(bridges, workflows);
  assert.equal(result.status, 'VALID', JSON.stringify(result.errors));
});

test('SHADOW bridges are pinned to exact source blobs', () => {
  for (const bridge of bridges.bridges.filter(item => item.adoption_status === 'SHADOW')) {
    assert.ok(bridge.source_authority, bridge.bridge_id);
    for (const source of bridge.source_authority.files) {
      const actual = execFileSync('git', ['hash-object', source.path], {
        cwd: new URL('..', import.meta.url),
        encoding: 'utf8',
      }).trim();
      assert.equal(actual, source.blob_sha, `${bridge.bridge_id}:${source.path}`);
    }
  }
});

test('capability result bridges can feed evidence but can never auto-transition Work', () => {
  const links = bridges.bridges.filter(item =>
    item.bridge_id.includes('capability-result') || item.bridge_id.includes('reconciled-capability-result')
  );
  assert.equal(links.length, 2);
  for (const link of links) {
    assert.equal(link.relation, 'EVIDENCE_FEED');
    assert.equal(link.target.workflow_id, 'ai-core.work-lifecycle');
    assert.equal(link.target.kind, 'WORKFLOW_EVIDENCE');
    assert.equal(link.dispatch.mode, 'NONE');
    assert.equal(link.direct_transition_allowed, false);
    assert.equal(Object.hasOwn(link.target, 'command_id'), false);
    assert.equal(link.authority.required, true);
  }
});

test('requirement revision invalidation fans out to all child tasks in the same transaction', () => {
  const bridge = bridges.bridges.find(item => item.bridge_id === 'ai-core.order-revision.invalidates-order-tasks');
  assert.ok(bridge);
  assert.equal(bridge.relation, 'INVALIDATION_TRIGGER');
  assert.equal(bridge.source.raw_event_type, 'REVISE');
  assert.equal(bridge.target.workflow_id, 'ai-core.order-task-lifecycle');
  assert.equal(bridge.target.command_id, 'order-task.invalidate');
  assert.equal(bridge.dispatch.mode, 'SAME_TRANSACTION');
  assert.equal(bridge.dispatch.cardinality, 'ALL_CHILDREN');
  assert.equal(bridge.direct_transition_allowed, true);
});

test('parent Order status is projection-only and cannot become an independent transition', () => {
  const bridge = bridges.bridges.find(item => item.bridge_id === 'ai-core.order-task-state.derives-order-status');
  assert.ok(bridge);
  assert.equal(bridge.relation, 'PROJECTION_DEPENDENCY');
  assert.equal(bridge.target.kind, 'DERIVED_PROJECTION');
  assert.equal(bridge.target.projection_ref, 'order.status');
  assert.equal(bridge.dispatch.mode, 'NONE');
  assert.equal(bridge.direct_transition_allowed, false);
});

test('validator rejects evidence feeds that dispatch or target a command', () => {
  const broken = structuredClone(bridges);
  const target = broken.bridges.find(item => item.relation === 'EVIDENCE_FEED');
  target.dispatch.mode = 'OUTBOX';
  target.direct_transition_allowed = true;
  target.target.kind = 'WORKFLOW_COMMAND';
  target.target.command_id = 'work.close';

  const result = validateWorkflowBridges(broken, workflows);
  assert.equal(result.status, 'INVALID');
  assert.ok(result.errors.some(item => item.code === 'BRIDGE_EVIDENCE_FEED_REQUIRES_EVIDENCE_TARGET'));
  assert.ok(result.errors.some(item => item.code === 'BRIDGE_EVIDENCE_FEED_MUST_NOT_DISPATCH'));
  assert.ok(result.errors.some(item => item.code === 'BRIDGE_EVIDENCE_FEED_DIRECT_TRANSITION_FORBIDDEN'));
});

test('validator rejects unknown target workflow command and missing SHADOW provenance', () => {
  const broken = structuredClone(bridges);
  const target = broken.bridges.find(item => item.relation === 'INVALIDATION_TRIGGER');
  target.target.command_id = 'order-task.no-such-command';
  delete target.source_authority;

  const result = validateWorkflowBridges(broken, workflows);
  assert.equal(result.status, 'INVALID');
  assert.ok(result.errors.some(item => item.code === 'BRIDGE_TARGET_COMMAND_UNKNOWN'));
  assert.ok(result.errors.some(item => item.code === 'SHADOW_BRIDGE_SOURCE_AUTHORITY_REQUIRED'));
});
