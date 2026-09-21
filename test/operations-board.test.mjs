import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOperationsBoard, buildSessionHandoff, validateDependencyCatalog } from '../src/operations/operations-board.mjs';

const sha = (character) => character.repeat(40);

function snapshot() {
  return {
    schema: 'ai-core-operations-observation/v1', observed_at: '2026-09-21T00:00:00Z', source: { local: 'test' },
    projects: [
      {
        project_id: 'producer', repository: 'example/producer', default_branch: 'main', registry_registered: true,
        registry_path: '/producer', registry_revision: sha('a'),
        local: { path: '/producer', exists: true, branch: 'main', head: sha('a'), dirty_entries: 0 },
        github: { main_head: sha('a'), open_prs: [] }, next_order: 'continue',
      },
      {
        project_id: 'consumer', repository: 'example/consumer', default_branch: 'main', registry_registered: true,
        registry_path: '/consumer', registry_revision: sha('b'),
        local: { path: '/consumer', exists: true, branch: 'main', head: sha('b'), dirty_entries: 1 },
        github: { main_head: sha('b'), open_prs: [] }, next_order: 'clean safely',
      },
    ],
    sessions: [
      { session_id: 'source', project_id: 'producer', state: 'active' },
      { session_id: 'target', project_id: 'consumer', state: 'idle' },
    ],
    dependencies: [{
      dependency_id: 'flow', readiness: 'READY',
      bindings: [{ project_id: 'producer', revision: sha('a') }, { project_id: 'consumer', revision: sha('b') }],
      evidence_refs: ['contract.json'],
    }],
    route_receipts: [],
  };
}

test('board keeps active work separate from dirty integrity HOLD', () => {
  const board = buildOperationsBoard(snapshot());
  assert.equal(board.projects.find((item) => item.project_id === 'producer').status, 'IN_PROGRESS');
  const consumer = board.projects.find((item) => item.project_id === 'consumer');
  assert.equal(consumer.work_status, 'WAITING');
  assert.equal(consumer.status, 'HOLD');
  assert.deepEqual(consumer.integrity.reasons, ['LOCAL_DIRTY']);
  assert.equal(board.dependencies[0].status, 'BOUND');
  assert.equal(board.order_roundtrips.status, 'HOLD');
  assert.deepEqual(board.order_roundtrips.reasons, ['NO_DURABLE_ROUTE_RECEIPT']);
});

test('roundtrip is verified only with observed target and returned evidence', () => {
  const input = snapshot();
  input.route_receipts.push({
    order_id: 'ORD-1', source_session_id: 'source', target_session_id: 'target', project_id: 'consumer',
    result_returned_to: 'source', completion_evidence: ['ci:1'],
  });
  assert.equal(buildOperationsBoard(input).order_roundtrips.status, 'VERIFIED');
  input.route_receipts[0].result_returned_to = 'elsewhere';
  assert.equal(buildOperationsBoard(input).order_roundtrips.status, 'HOLD');
});

test('handoff binds exact observed revision and completion evidence', () => {
  const board = buildOperationsBoard(snapshot());
  const handoff = buildSessionHandoff(board, {
    session_id: 'source', project_id: 'producer', authoritative_path: 'docs/SSOT.md', revision: sha('a'), closed_at: '2026-09-21T01:00:00Z',
    result_status: 'COMPLETED', completion_evidence: ['test:pass'], next_order: 'next', return_to_session_id: 'source',
  });
  assert.match(handoff.digest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(handoff.authority, 'EVIDENCE_ONLY_NO_MERGE_DEPLOY_OR_EXTERNAL_WRITE');
  assert.throws(() => buildSessionHandoff(board, {
    session_id: 'source', project_id: 'producer', authoritative_path: 'docs/SSOT.md', revision: sha('c'), closed_at: '2026-09-21T01:00:00Z',
    result_status: 'COMPLETED', completion_evidence: ['test:pass'], next_order: 'next',
  }), /REVISION_NOT_OBSERVED/);
  assert.throws(() => buildSessionHandoff(board, {
    session_id: 'source', project_id: 'producer', authoritative_path: '../outside.md', revision: sha('a'), closed_at: '2026-09-21T01:00:00Z',
    result_status: 'COMPLETED', completion_evidence: ['test:pass'], next_order: 'next',
  }), /AUTHORITATIVE_PATH_INVALID/);
});

test('dependency catalog requires every producer and consumer binding', () => {
  const input = snapshot();
  const catalog = {
    schema: 'ai-core-operations-dependencies/v1',
    relationships: [{ dependency_id: 'flow', producer_project_id: 'producer', consumer_project_ids: ['consumer'] }],
  };
  assert.equal(validateDependencyCatalog(input, catalog), true);
  input.dependencies[0].bindings.pop();
  assert.throws(() => validateDependencyCatalog(input, catalog), /DEPENDENCY_CONSUMER_BINDING_MISSING/);
});
