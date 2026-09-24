import { validateUiUxConformanceReceiptSemantics } from './ui-ux-conformance-receipt.mjs';

const ORDER = ['EVIDENCE_ONLY', 'MAPPED', 'PILOT', 'CONFORMANT'];

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function nextStatus(current) {
  const index = ORDER.indexOf(current);
  return index >= 0 && index < ORDER.length - 1 ? ORDER[index + 1] : null;
}

export function evaluateUiUxConsumerPromotion({
  registryConsumer,
  manifest,
  receipt = null,
  mappingEvidence = null,
  targetRevision = null,
  canonicalCoreRevision = null
}) {
  if (!registryConsumer?.id || !manifest?.product?.id) fail('UIUX_PROMOTION_INPUT_INVALID');
  if (registryConsumer.id !== manifest.product.id) fail('UIUX_PROMOTION_PRODUCT_ID_MISMATCH');
  if (registryConsumer.repository !== manifest.product.repository) fail('UIUX_PROMOTION_REPOSITORY_MISMATCH');

  const from = registryConsumer.adoption_status;
  const to = manifest.adoption_status;
  if (!ORDER.includes(from) || !ORDER.includes(to)) fail('UIUX_PROMOTION_STATUS_INVALID');

  if (to === from) {
    return { status: 'NO_CHANGE', from, to, product: registryConsumer.id };
  }

  if (nextStatus(from) !== to) {
    fail('UIUX_PROMOTION_SKIP_FORBIDDEN', `${from}->${to}`);
  }

  if (to === 'MAPPED') {
    if (!mappingEvidence?.subject_revision || !mappingEvidence?.ci_run || !mappingEvidence?.pull_request) {
      fail('UIUX_PROMOTION_MAPPING_EVIDENCE_REQUIRED');
    }
    if (!/^[a-f0-9]{40}$/.test(mappingEvidence.subject_revision)) {
      fail('UIUX_PROMOTION_MAPPING_REVISION_INVALID');
    }
    if (mappingEvidence.manifest_revision !== mappingEvidence.subject_revision) {
      fail('UIUX_PROMOTION_MAPPING_REVISION_UNBOUND');
    }
    return {
      status: 'PROMOTABLE',
      from,
      to,
      product: registryConsumer.id,
      subject_revision: mappingEvidence.subject_revision,
      evidence: [mappingEvidence.pull_request, mappingEvidence.ci_run]
    };
  }

  if (!receipt) fail('UIUX_PROMOTION_RECEIPT_REQUIRED', to);
  if (receipt.product?.id !== manifest.product.id) fail('UIUX_PROMOTION_RECEIPT_PRODUCT_MISMATCH');
  if (receipt.product?.repository !== manifest.product.repository) fail('UIUX_PROMOTION_RECEIPT_REPOSITORY_MISMATCH');
  if (!/^[a-f0-9]{40}$/.test(receipt.product?.subject_revision ?? '')) {
    fail('UIUX_PROMOTION_RECEIPT_REVISION_INVALID');
  }
  if (!/^[a-f0-9]{40}$/.test(targetRevision ?? '')) {
    fail('UIUX_PROMOTION_TARGET_REVISION_REQUIRED');
  }
  if (receipt.product.subject_revision !== targetRevision) {
    fail('UIUX_PROMOTION_SUBJECT_REVISION_MISMATCH');
  }
  if (receipt.ai_core?.revision !== manifest.ai_core?.revision) fail('UIUX_PROMOTION_CORE_REVISION_MISMATCH');
  if (receipt.ai_core?.feature_registry_version !== manifest.ai_core?.feature_registry_version) {
    fail('UIUX_PROMOTION_REGISTRY_VERSION_MISMATCH');
  }
  if (receipt.status !== 'PASS') fail('UIUX_PROMOTION_RECEIPT_NOT_PASS');

  if (to === 'PILOT') {
    if (receipt.claim_level !== 'PILOT') fail('UIUX_PROMOTION_PILOT_RECEIPT_REQUIRED');
    validateUiUxConformanceReceiptSemantics(receipt);
    return {
      status: 'PROMOTABLE',
      from,
      to,
      product: registryConsumer.id,
      subject_revision: receipt.product.subject_revision,
      evidence: receipt.artifacts?.map((artifact) => artifact.ref) ?? []
    };
  }

  if (to === 'CONFORMANT') {
    if (receipt.claim_level !== 'CONFORMANT') fail('UIUX_PROMOTION_CONFORMANT_RECEIPT_REQUIRED');
    if (manifest.ai_core?.status !== 'CANONICAL' || receipt.ai_core?.status !== 'CANONICAL') {
      fail('UIUX_PROMOTION_CANONICAL_CORE_REQUIRED');
    }
    if (!canonicalCoreRevision || canonicalCoreRevision !== manifest.ai_core.revision) {
      fail('UIUX_PROMOTION_CANONICAL_REVISION_MISMATCH');
    }
    if (manifest.verification?.pending_conformance?.length) fail('UIUX_PROMOTION_PENDING_CONFORMANCE');
    if (manifest.exceptions?.length) fail('UIUX_PROMOTION_ACTIVE_EXCEPTION_REVIEW_REQUIRED');
    validateUiUxConformanceReceiptSemantics(receipt);
    return {
      status: 'PROMOTABLE',
      from,
      to,
      product: registryConsumer.id,
      subject_revision: receipt.product.subject_revision,
      evidence: receipt.artifacts?.map((artifact) => artifact.ref) ?? []
    };
  }

  fail('UIUX_PROMOTION_TARGET_UNSUPPORTED', to);
}
