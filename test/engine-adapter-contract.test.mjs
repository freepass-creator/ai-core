import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEngineContract, validateAdapterContract, resolveBinding } from '../src/engine-adapter-contract.mjs';

const engine = {
  engine_id: 'rental.quote',
  version: '2.0.0',
  source: { locator: 'project/src/quote-engine.mjs', revision: 'abc123' },
  inputs: ['vehicle','term'],
  outputs: ['quote'],
  invariants: ['same semantic input must preserve quote meaning'],
  required_ports: ['vehicle.read','quote.write'],
  side_effects: true,
  verification_profile: ['unit','state','integration']
};

const readAdapter = {
  adapter_id: 'adapter.vehicle.mock',
  port_id: 'vehicle.read',
  provider_scope: 'mock',
  source: { locator: 'test/mock-vehicle.mjs', revision: 'def456' },
  compatibility: { port_versions: ['1'] },
  mapping: ['vehicle.id -> id'],
  side_effects: false,
  idempotency: 'NOT_APPLICABLE',
  retry_policy: 'none',
  timeout_ms: 1000,
  auth_boundary: 'none',
  data_classification: ['synthetic'],
  failure_mapping: ['not_found -> VEHICLE_NOT_FOUND'],
  health_check: 'fixture-load',
  verification_profile: ['contract']
};

const writeAdapter = {
  adapter_id: 'adapter.quote.mock',
  port_id: 'quote.write',
  provider_scope: 'mock',
  source: { locator: 'test/mock-quote.mjs', revision: 'ghi789' },
  compatibility: { port_versions: ['1'] },
  mapping: ['quote.amount -> amount'],
  side_effects: true,
  idempotency: 'REQUIRED',
  retry_policy: 'bounded-no-retry-in-test',
  timeout_ms: 1000,
  auth_boundary: 'test-only',
  data_classification: ['synthetic'],
  failure_mapping: ['write_failed -> QUOTE_WRITE_FAILED'],
  health_check: 'fixture-write',
  verification_profile: ['contract','idempotency']
};

const profile = {
  profile_id: 'profile.freepass.test',
  project_id: 'freepass',
  environment: 'test',
  subject_revision: 'abc123',
  engine_bindings: [{
    engine_id: 'rental.quote',
    engine_version: '2.0.0',
    ports: [
      { port_id: 'vehicle.read', adapter_id: 'adapter.vehicle.mock' },
      { port_id: 'quote.write', adapter_id: 'adapter.quote.mock' }
    ]
  }],
  verification_state: 'NOT_RUN'
};

test('valid engine contract passes', () => {
  assert.equal(validateEngineContract(engine).ok, true);
});

test('engine side effect without port is blocked', () => {
  const broken = { ...engine, required_ports: [] };
  assert.ok(validateEngineContract(broken).errors.includes('ENGINE_SIDE_EFFECT_REQUIRES_PORT'));
});

test('side-effect adapter without idempotency support is blocked', () => {
  const broken = { ...writeAdapter, idempotency: 'UNSUPPORTED' };
  assert.ok(validateAdapterContract(broken).errors.includes('SIDE_EFFECT_ADAPTER_IDEMPOTENCY_UNSUPPORTED'));
});

test('binding resolves complete port set', () => {
  const result = resolveBinding({ engine, adapters: [readAdapter, writeAdapter], profile });
  assert.equal(result.status, 'RESOLVED');
  assert.equal(result.authorization, 'NOT_GRANTED');
  assert.deepEqual(result.errors, []);
});

test('missing port binding holds', () => {
  const brokenProfile = structuredClone(profile);
  brokenProfile.engine_bindings[0].ports = brokenProfile.engine_bindings[0].ports.filter((p) => p.port_id !== 'quote.write');
  const result = resolveBinding({ engine, adapters: [readAdapter, writeAdapter], profile: brokenProfile });
  assert.equal(result.status, 'HOLD');
  assert.ok(result.errors.includes('PORT_UNRESOLVED:quote.write'));
});

test('duplicate binding holds', () => {
  const brokenProfile = structuredClone(profile);
  brokenProfile.engine_bindings[0].ports.push({ port_id: 'vehicle.read', adapter_id: 'adapter.vehicle.mock' });
  const result = resolveBinding({ engine, adapters: [readAdapter, writeAdapter], profile: brokenProfile });
  assert.equal(result.status, 'HOLD');
  assert.ok(result.errors.includes('PORT_DUPLICATE_BINDING:vehicle.read'));
});

test('adapter port mismatch holds', () => {
  const wrong = { ...readAdapter, port_id: 'customer.read' };
  const result = resolveBinding({ engine, adapters: [wrong, writeAdapter], profile });
  assert.equal(result.status, 'HOLD');
  assert.ok(result.errors.includes('ADAPTER_PORT_MISMATCH:adapter.vehicle.mock'));
});
