import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCapabilityCell, capabilityEdges, resolveCapability, resolveBest } from '../src/semantic-capability.mjs';

function cell(overrides = {}) {
  return {
    capability_id: 'cap.format.distance',
    kind: 'ENGINE',
    purpose: 'Format a distance value for display',
    semantic_key: 'distance.format.display',
    scope: 'DOMAIN',
    lifecycle: 'EXECUTION_VERIFIED',
    implementation_refs: [{ repo: 'freepasserp4', path: 'lib/format.ts', revision: '1234567', export: 'kmValue' }],
    contract: {
      inputs: [{ name: 'distance_km', type: 'number', unit: 'km', nullable: false, semantic_note: null }],
      outputs: [{ name: 'display_text', type: 'string', unit: null, nullable: false, semantic_note: null }],
      invariants: ['input unit is kilometers'],
      errors: [],
      side_effect: { class: 'NONE', idempotency: 'NOT_APPLICABLE', authority_required: false },
    },
    implements_ports: [],
    depends_on: [],
    wraps_connectors: [],
    compatibility: { runtimes: ['node'], frameworks: [], projects: ['freepasserp4'] },
    semantic_provenance: 'SOURCE_DERIVED',
    evidence_state: 'EXECUTED',
    evidence_refs: ['fixture:kmValue:11cases'],
    unknowns: [],
    supersedes: null,
    fingerprint: null,
    ...overrides,
  };
}

const query = {
  query_id: 'q1',
  semantic_key: 'distance.format.display',
  allowed_kinds: ['ENGINE'],
  required_inputs: ['distance_km'],
  required_outputs: ['display_text'],
  required_port: null,
  target_project: 'freepasserp4',
  target_runtime: 'node',
  adapter_allowed: true,
  side_effect_policy: 'NONE_ONLY',
  minimum_evidence: 'EXECUTED',
};

test('exact semantic and contract match can be reused', () => {
  assert.equal(resolveCapability(query, cell()).decision, 'REUSE_EXACT');
});

test('same meaning with shape mismatch may require adapter', () => {
  const changed = cell({
    contract: {
      ...cell().contract,
      inputs: [{ name: 'meters', type: 'number', unit: 'm', nullable: false, semantic_note: null }],
    },
  });
  assert.equal(resolveCapability(query, changed).decision, 'REUSE_WITH_ADAPTER');
});

test('static discovery alone is not reusable semantics', () => {
  const discovered = cell({ lifecycle: 'DISCOVERED', evidence_state: 'STATIC_ONLY', semantic_provenance: 'AI_INFERRED' });
  assert.equal(resolveCapability(query, discovered).decision, 'HOLD_SEMANTICS_UNKNOWN');
});

test('insufficient evidence cannot satisfy query', () => {
  const weak = cell({ evidence_state: 'SYNTHETIC' });
  assert.equal(resolveCapability(query, weak).decision, 'HOLD_EVIDENCE_INSUFFICIENT');
});

test('write side effect cannot satisfy NONE_ONLY query', () => {
  const writer = cell({
    kind: 'ADAPTER',
    contract: {
      ...cell().contract,
      side_effect: { class: 'WRITE_EXTERNAL', idempotency: 'SUPPORTED', authority_required: true },
    },
  });
  assert.equal(resolveCapability({ ...query, allowed_kinds: ['ADAPTER'] }, writer).decision, 'HOLD_SIDE_EFFECT_MISMATCH');
});

test('external writer without idempotency is invalid', () => {
  const writer = cell({
    kind: 'ADAPTER',
    contract: {
      ...cell().contract,
      side_effect: { class: 'WRITE_EXTERNAL', idempotency: 'UNKNOWN', authority_required: true },
    },
  });
  assert.ok(validateCapabilityCell(writer).problems.includes('SIDE_EFFECT_IDEMPOTENCY_NOT_PROVEN'));
});

test('AI inferred semantics cannot self-adopt', () => {
  const inferred = cell({ semantic_provenance: 'AI_INFERRED', lifecycle: 'ADOPTED_WITHIN_SCOPE' });
  assert.ok(validateCapabilityCell(inferred).problems.includes('AI_INFERRED_SEMANTICS_CANNOT_SELF_ADOPT'));
});

test('capability graph exposes semantic dependency edges', () => {
  const adapter = cell({
    capability_id: 'cap.adapter.sheet.vehicle',
    kind: 'ADAPTER',
    implements_ports: ['port.vehicle.read'],
    depends_on: ['cap.mapping.vehicle'],
    wraps_connectors: ['connector.google.sheets'],
    supersedes: 'cap.adapter.sheet.vehicle.v0',
  });
  const edges = capabilityEdges(adapter);
  assert.ok(edges.some((x) => x.type === 'IMPLEMENTS_PORT' && x.to === 'port.vehicle.read'));
  assert.ok(edges.some((x) => x.type === 'WRAPS_CONNECTOR' && x.to === 'connector.google.sheets'));
  assert.ok(edges.some((x) => x.type === 'SUPERSEDES'));
});

test('resolver ranks exact reuse ahead of new capability', () => {
  const unrelated = cell({ capability_id: 'cap.other', semantic_key: 'file.size.display' });
  const ranked = resolveBest(query, [unrelated, cell()]);
  assert.equal(ranked[0].capability_id, 'cap.format.distance');
  assert.equal(ranked[0].decision, 'REUSE_EXACT');
});

test('runtime mismatch is held instead of guessed', () => {
  assert.equal(resolveCapability({ ...query, target_runtime: 'python' }, cell()).decision, 'HOLD_COMPATIBILITY_UNKNOWN');
});