import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluateUiUxConsumerPromotion } from '../src/engine/ui-ux-consumer-promotion.mjs';

const [manifest, receipt] = await Promise.all([
  readFile(new URL('../examples/ui-ux-consumer.manifest.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../examples/ui-ux-conformance.receipt.json', import.meta.url), 'utf8').then(JSON.parse)
]);

const registryConsumer = {
  id: 'example-product',
  repository: 'freepass-creator/example-product',
  adoption_status: 'EVIDENCE_ONLY'
};

test('EVIDENCE_ONLY promotes to MAPPED only with revision-bound PR and CI evidence', () => {
  const mapped = structuredClone(manifest);
  mapped.adoption_status = 'MAPPED';
  const result = evaluateUiUxConsumerPromotion({
    registryConsumer,
    manifest: mapped,
    mappingEvidence: {
      subject_revision: '1111111111111111111111111111111111111111',
      manifest_revision: '1111111111111111111111111111111111111111',
      pull_request: 'https://github.com/freepass-creator/example-product/pull/1',
      ci_run: 'https://github.com/freepass-creator/example-product/actions/runs/1'
    }
  });
  assert.equal(result.status, 'PROMOTABLE');
  assert.equal(result.to, 'MAPPED');
});

test('promotion cannot skip MAPPED and jump directly to PILOT', () => {
  const pilot = structuredClone(manifest);
  pilot.adoption_status = 'PILOT';
  assert.throws(
    () => evaluateUiUxConsumerPromotion({ registryConsumer, manifest: pilot, receipt }),
    /UIUX_PROMOTION_SKIP_FORBIDDEN/
  );
});

test('MAPPED promotes to PILOT only with matching PASS PILOT receipt', () => {
  const pilotRegistry = { ...registryConsumer, adoption_status: 'MAPPED' };
  const pilot = structuredClone(manifest);
  pilot.adoption_status = 'PILOT';
  pilot.product.mapping_base_revision = receipt.product.subject_revision;
  pilot.ai_core.revision = receipt.ai_core.revision;
  pilot.ai_core.feature_registry_version = receipt.ai_core.feature_registry_version;
  const result = evaluateUiUxConsumerPromotion({
    registryConsumer: pilotRegistry,
    manifest: pilot,
    receipt,
    targetRevision: receipt.product.subject_revision
  });
  assert.equal(result.status, 'PROMOTABLE');
  assert.equal(result.to, 'PILOT');
});

test('promotion rejects PASS receipt that hides a non-pass feature result', () => {
  const pilotRegistry = { ...registryConsumer, adoption_status: 'MAPPED' };
  const pilot = structuredClone(manifest);
  pilot.adoption_status = 'PILOT';
  pilot.product.mapping_base_revision = receipt.product.subject_revision;
  pilot.ai_core.revision = receipt.ai_core.revision;
  pilot.ai_core.feature_registry_version = receipt.ai_core.feature_registry_version;
  const contradictoryReceipt = structuredClone(receipt);
  contradictoryReceipt.feature_results[0].status = 'FAIL';

  assert.throws(
    () => evaluateUiUxConsumerPromotion({
      registryConsumer: pilotRegistry,
      manifest: pilot,
      receipt: contradictoryReceipt,
      targetRevision: contradictoryReceipt.product.subject_revision
    }),
    /UIUX_RECEIPT_PASS_WITH_NONPASS_FEATURE/
  );
});

test('PILOT cannot become CONFORMANT on candidate Core or unresolved pending checks', () => {
  const conformantRegistry = { ...registryConsumer, adoption_status: 'PILOT' };
  const conformant = structuredClone(manifest);
  conformant.adoption_status = 'CONFORMANT';
  conformant.product.mapping_base_revision = receipt.product.subject_revision;
  conformant.ai_core.revision = receipt.ai_core.revision;
  conformant.ai_core.feature_registry_version = receipt.ai_core.feature_registry_version;
  const conformantReceipt = structuredClone(receipt);
  conformantReceipt.claim_level = 'CONFORMANT';

  assert.throws(
    () => evaluateUiUxConsumerPromotion({
      registryConsumer: conformantRegistry,
      manifest: conformant,
      receipt: conformantReceipt,
      targetRevision: conformantReceipt.product.subject_revision,
      canonicalCoreRevision: conformant.ai_core.revision
    }),
    /UIUX_PROMOTION_CANONICAL_CORE_REQUIRED/
  );
});

test('CONFORMANT requires exact canonical revision and clean manifest', () => {
  const conformantRegistry = { ...registryConsumer, adoption_status: 'PILOT' };
  const conformant = structuredClone(manifest);
  conformant.adoption_status = 'CONFORMANT';
  conformant.ai_core.status = 'CANONICAL';
  conformant.verification.viewports = [360,390,412,1280,1440];
  conformant.verification.input_modes = ['keyboard','touch','pointer','ime-composition'];
  conformant.verification.locales = ['ko-KR','en-US','de-DE','ar-SA'];
  conformant.verification.pending_conformance = [];
  conformant.product.mapping_base_revision = receipt.product.subject_revision;
  conformant.ai_core.revision = receipt.ai_core.revision;
  conformant.ai_core.feature_registry_version = receipt.ai_core.feature_registry_version;
  const conformantReceipt = structuredClone(receipt);
  conformantReceipt.claim_level = 'CONFORMANT';
  conformantReceipt.ai_core.status = 'CANONICAL';

  const result = evaluateUiUxConsumerPromotion({
    registryConsumer: conformantRegistry,
    manifest: conformant,
    receipt: conformantReceipt,
    targetRevision: conformantReceipt.product.subject_revision,
    canonicalCoreRevision: conformant.ai_core.revision
  });
  assert.equal(result.status, 'PROMOTABLE');
  assert.equal(result.to, 'CONFORMANT');
});
