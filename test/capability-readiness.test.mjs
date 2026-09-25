import test from 'node:test';
import assert from 'node:assert/strict';
import { assessCapabilityReadiness } from '../src/engine/capability-readiness.mjs';

const project = (id, overrides = {}) => ({
  project_id: id,
  repository_lifecycle_status: 'ACTIVE',
  execution_readiness_status: 'ACTIVE',
  head_revision: 'a'.repeat(40),
  local_path: `C:\\dev\\${id}`,
  commands: { test: 'npm test', build: 'npm run build', install: 'npm ci' },
  required_approvals: [],
  known_blockers: [],
  ...overrides,
});

const capability = (overrides = {}) => ({
  id: 'sales.customer-search',
  title: 'Customer search',
  status: 'HOLD',
  domains: ['sales'],
  projects: ['sales'],
  mode: 'READ_ONLY',
  priority: 50,
  inputs: [],
  required_scopes: [],
  walls: [],
  result_contract: 'ai-core-work-result/v1',
  hold_reason: 'adapter not bound',
  ...overrides,
});

const assess = (cap, projects = [project('sales')]) => assessCapabilityReadiness({
  capabilityRegistry: { schema_version: '1.0', capabilities: [cap] },
  projectRegistry: { schema_version: '1.1', projects },
}).items[0];

test('HOLD remains blocked when adapter and execution-ready project are missing', () => {
  const item = assess(capability(), [project('sales', { execution_readiness_status: 'HOLD' })]);
  assert.equal(item.readiness, 'BLOCKED');
  assert.deepEqual(item.machine_blockers.map(x => x.code), ['PROJECT_EXECUTION_NOT_READY', 'ADAPTER_CONTRACT_MISSING']);
  assert.equal(item.promotion_allowed, false);
});

test('REFERENCE lifecycle may execute when readiness is ACTIVE but is surfaced as advisory', () => {
  const item = assess(capability({ adapter: { kind: 'BUILTIN', id: 'sales.customer-search' } }), [
    project('sales', { repository_lifecycle_status: 'REFERENCE', execution_readiness_status: 'ACTIVE' }),
  ]);
  assert.equal(item.readiness, 'REVIEW_REQUIRED');
  assert.ok(item.advisories.some(x => x.code === 'PROJECT_REFERENCE_LIFECYCLE'));
});

test('RETIRE lifecycle is fail-closed even if malformed input claims execution ACTIVE', () => {
  const item = assess(capability({ adapter: { kind: 'BUILTIN', id: 'sales.customer-search' } }), [
    project('sales', { repository_lifecycle_status: 'RETIRE', execution_readiness_status: 'ACTIVE' }),
  ]);
  assert.equal(item.readiness, 'BLOCKED');
  assert.ok(item.machine_blockers.some(x => x.code === 'PROJECT_RETIRED'));
});

test('machine-ready HOLD becomes REVIEW_REQUIRED, never auto-promoted', () => {
  const item = assess(capability({ adapter: { kind: 'BUILTIN', id: 'sales.customer-search' } }));
  assert.equal(item.readiness, 'REVIEW_REQUIRED');
  assert.deepEqual(item.machine_blockers, []);
  assert.equal(item.declared_hold_reason, 'adapter not bound');
  assert.equal(item.promotion_allowed, false);
});

test('external mutation requires authority scopes and reports missing terminal receipt as advisory', () => {
  const item = assess(capability({
    id: 'sales.message',
    mode: 'EXTERNAL_MUTATION',
    adapter: { kind: 'PROJECT_MODULE', entrypoint: 'lib/message.mjs', export: 'send' },
  }));
  assert.equal(item.readiness, 'BLOCKED');
  assert.ok(item.machine_blockers.some(x => x.code === 'EXTERNAL_AUTHORITY_SCOPE_MISSING'));
  assert.ok(item.advisories.some(x => x.code === 'TERMINAL_RECEIPT_NOT_CONFIGURED'));
});

test('external mutation does not treat a blank authority scope as execution-ready', () => {
  const item = assess(capability({
    id: 'sales.message',
    status: 'ACTIVE',
    hold_reason: undefined,
    mode: 'EXTERNAL_MUTATION',
    required_scopes: ['   '],
    adapter: { kind: 'PROJECT_MODULE', entrypoint: 'lib/message.mjs', export: 'send' },
  }));
  assert.equal(item.readiness, 'ACTIVE_WITH_GAP');
  assert.ok(item.machine_blockers.some(x => x.code === 'EXTERNAL_AUTHORITY_SCOPE_MISSING'));
});

test('ACTIVE module capability reports a runtime gap when project local path is unavailable', () => {
  const item = assess(capability({
    status: 'ACTIVE',
    hold_reason: undefined,
    adapter: { kind: 'PROJECT_MODULE', entrypoint: 'lib/search.mjs', export: 'search' },
  }), [project('sales', { local_path: null })]);
  assert.equal(item.readiness, 'ACTIVE_WITH_GAP');
  assert.ok(item.machine_blockers.some(x => x.code === 'PROJECT_LOCAL_PATH_MISSING'));
});

test('wildcard project registry command is route-dependent rather than globally blocked', () => {
  const item = assess(capability({
    id: 'project.verify',
    projects: ['*'],
    adapter: { kind: 'PROJECT_REGISTRY_COMMAND', command_key: 'test' },
  }));
  assert.equal(item.readiness, 'REVIEW_REQUIRED');
  assert.deepEqual(item.machine_blockers, []);
  assert.ok(item.advisories.some(x => x.code === 'TARGET_PROJECT_RESOLVED_AT_ROUTE_TIME'));
});
