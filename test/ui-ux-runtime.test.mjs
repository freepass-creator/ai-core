import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateUiUxRuntimeSemantics } from '../src/engine/ui-ux-runtime.mjs';

async function json(path) {
  return JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
}

const [featureRegistry, tokens, components, patterns, interactions, governance, consumers, screenManifest, tokenCss, legacyCss, runtimeCss] = await Promise.all([
  json('registry/ui-ux-features.json'),
  json('design-system/tokens.json'),
  json('design-system/components.registry.json'),
  json('design-system/patterns.registry.json'),
  json('design-system/interaction.contract.json'),
  json('registry/ui-ux-governance.json'),
  json('registry/ui-ux-consumers.json'),
  json('examples/ui-screen.manifest.json'),
  readFile(new URL('../design-system/tokens.runtime.css', import.meta.url), 'utf8'),
  readFile(new URL('../design-system/components.css', import.meta.url), 'utf8'),
  readFile(new URL('../design-system/runtime-v2.css', import.meta.url), 'utf8')
]);

function validate(overrides = {}) {
  return validateUiUxRuntimeSemantics({
    featureRegistry,
    tokens,
    components,
    patterns,
    interactions,
    governance,
    consumers,
    screenManifest,
    tokenCss,
    legacyCss,
    runtimeCss,
    ...overrides
  });
}

test('B2 runtime covers every component feature and locked global probes', () => {
  const result = validate();
  assert.equal(result.status, 'VALID');
  assert.equal(result.features, 86);
  assert.equal(result.components, 33);
  assert.equal(result.patterns, 47);
  assert.equal(result.screen_features, 9);
  assert.equal(result.interaction_rules, 13);
  assert.ok(result.tokens >= 40);
  assert.equal(result.governance_entries, 0);
  assert.equal(result.consumers, 3);
  assert.equal(result.conformant_consumers, 0);
});

test('component registry cannot silently omit a canonical component feature', () => {
  const broken = structuredClone(components);
  broken.components = broken.components.filter((entry) => entry.feature_id !== 'overlay.tooltip');
  assert.throws(() => validate({ components: broken }), /UIUX_COMPONENT_COVERAGE_MISMATCH/);
});

test('component registry cannot bind an unknown feature', () => {
  const broken = structuredClone(components);
  broken.components[0].feature_id = 'local.magic-button';
  assert.throws(() => validate({ components: broken }), /UIUX_COMPONENT_UNKNOWN_FEATURE/);
});

test('token CSS projection cannot drift from machine SSOT', () => {
  const brokenCss = tokenCss.replace('--control-height-touch-min: 44px;', '--control-height-touch-min: 43px;');
  assert.throws(() => validate({ tokenCss: brokenCss }), /UIUX_TOKEN_CSS_DRIFT:control-height-touch-min/);
});

test('interaction contract cannot reference a non-existent common feature', () => {
  const broken = structuredClone(interactions);
  broken.rules.focus.feature_refs.push('workflow.screen-invented-state');
  assert.throws(() => validate({ interactions: broken }), /UIUX_INTERACTION_UNKNOWN_FEATURE/);
});

test('runtime must retain RTL, safe-area, forced-color and logical-layout rules', () => {
  for (const marker of ['[dir="rtl"]', 'var(--safe-area-bottom)', 'forced-colors: active', 'border-inline-start', 'text-align: end']) {
    assert.ok(runtimeCss.includes(marker), marker);
  }
  const broken = runtimeCss.replaceAll('forced-colors: active', 'forced-colors: disabled');
  assert.throws(() => validate({ runtimeCss: broken }), /UIUX_RUNTIME_RULE_MISSING:forced-colors: active/);
});

test('blanket RTL mirroring is forbidden', () => {
  const broken = runtimeCss + '\n[dir="rtl"] * { transform: scaleX(-1); }\n';
  assert.throws(() => validate({ runtimeCss: broken }), /UIUX_RTL_BLANKET_MIRROR_FORBIDDEN/);
});

test('governance exceptions must reference canonical feature ids', () => {
  const broken = structuredClone(governance);
  broken.exceptions.push({
    id: 'uxe-invalid-feature',
    feature_id: 'local.unregistered-control',
    product: 'example',
    reason: 'temporary migration',
    owner: 'ui-core',
    evidence: ['example'],
    review_on: '2026-12-31',
    status: 'ACTIVE'
  });
  assert.throws(() => validate({ governance: broken }), /UIUX_EXCEPTION_UNKNOWN_FEATURE/);
});

test('pattern registry must cover every pattern workflow and surface feature exactly once', () => {
  const broken = structuredClone(patterns);
  broken.patterns = broken.patterns.filter((entry) => entry.feature_id !== 'data.table');
  assert.throws(() => validate({ patterns: broken }), /UIUX_PATTERN_COVERAGE_MISMATCH/);
});

test('pattern component references must resolve to component-kind features', () => {
  const broken = structuredClone(patterns);
  broken.patterns.find((entry) => entry.feature_id === 'data.filter').component_feature_refs.push('workflow.submit');
  assert.throws(() => validate({ patterns: broken }), /UIUX_PATTERN_UNKNOWN_COMPONENT/);
});

test('screen manifests cannot invent feature ids or bypass C D boundaries', () => {
  const unknownFeature = structuredClone(screenManifest);
  unknownFeature.feature_ids.push('local.screen-feature');
  assert.throws(() => validate({ screenManifest: unknownFeature }), /UIUX_SCREEN_UNKNOWN_FEATURE/);

  const badData = structuredClone(screenManifest);
  badData.contracts.data_api = ['local:data'];
  assert.throws(() => validate({ screenManifest: badData }), /UIUX_SCREEN_DATA_BOUNDARY_INVALID/);

  const badWorkflow = structuredClone(screenManifest);
  badWorkflow.contracts.workflow = ['local:workflow'];
  assert.throws(() => validate({ screenManifest: badWorkflow }), /UIUX_SCREEN_WORKFLOW_BOUNDARY_INVALID/);
});

test('locked token roles require machine-readable evidence maturity', () => {
  assert.equal(tokens.role_evidence['density.mobile_business_row_px'].evidence_level, 'PROJECT_VERIFIED');
  assert.equal(tokens.role_evidence['control.touch_minimum_px'].evidence_level, 'PLATFORM_CONSENSUS');

  const broken = structuredClone(tokens);
  delete broken.role_evidence['control.touch_minimum_px'];
  assert.throws(() => validate({ tokens: broken }), /UIUX_TOKEN_EVIDENCE_MISSING:control.touch_minimum_px/);
});

test('consumer conformance cannot be claimed without revision-bound receipts', () => {
  const fakeDone = structuredClone(consumers);
  fakeDone.definition_of_done.current_conformant_consumers = 2;
  fakeDone.definition_of_done.status = 'SATISFIED';
  for (const consumer of fakeDone.consumers) {
    consumer.relation = 'CANONICAL_CONSUMER';
    consumer.adoption_status = 'CONFORMANT';
  }
  assert.throws(() => validate({ consumers: fakeDone }), /UIUX_CONFORMANCE_REVISION_REQUIRED/);
});

test('consumer feature mappings must resolve to canonical features', () => {
  const broken = structuredClone(consumers);
  broken.consumers[0].feature_refs.push('local.consumer-only-feature');
  assert.throws(() => validate({ consumers: broken }), /UIUX_CONSUMER_UNKNOWN_FEATURE/);
});
