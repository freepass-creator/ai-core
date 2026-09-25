const PILOT_VIEWPORTS = [360, 390, 412, 1280, 1440];
const PILOT_INPUTS = ['keyboard', 'touch', 'pointer', 'ime-composition'];
const PILOT_LOCALES = ['ko-KR', 'en-US', 'de-DE', 'ar-SA'];

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

export function validateUiUxConsumerManifestSemantics(manifest, knownFeatureIds = []) {
  if (manifest?.contract !== 'ai-core-ui-ux-consumer/v1') fail('UIUX_CONSUMER_MANIFEST_INVALID');

  const known = new Set(knownFeatureIds);
  const bindings = new Map();
  for (const binding of manifest.feature_bindings ?? []) {
    if (bindings.has(binding.feature_id)) fail('UIUX_CONSUMER_BINDING_DUPLICATE', binding.feature_id);
    bindings.set(binding.feature_id, binding);
    if (known.size && !known.has(binding.feature_id)) fail('UIUX_CONSUMER_UNKNOWN_FEATURE', binding.feature_id);
  }

  for (const featureId of manifest.required_feature_ids ?? []) {
    if (!bindings.has(featureId)) fail('UIUX_CONSUMER_REQUIRED_FEATURE_UNMAPPED', featureId);
  }

  for (const exception of manifest.exceptions ?? []) {
    if (!bindings.has(exception.feature_id)) fail('UIUX_CONSUMER_EXCEPTION_UNKNOWN_FEATURE', exception.feature_id);
  }

  if (['PILOT', 'CONFORMANT'].includes(manifest.adoption_status)) {
    for (const width of PILOT_VIEWPORTS) {
      if (!manifest.verification?.viewports?.includes(width)) fail('UIUX_CONSUMER_PILOT_VIEWPORT_MISSING', String(width));
    }
    for (const input of PILOT_INPUTS) {
      if (!manifest.verification?.input_modes?.includes(input)) fail('UIUX_CONSUMER_PILOT_INPUT_MISSING', input);
    }
    for (const locale of PILOT_LOCALES) {
      if (!manifest.verification?.locales?.includes(locale)) fail('UIUX_CONSUMER_PILOT_LOCALE_MISSING', locale);
    }
  }

  if (manifest.adoption_status === 'CONFORMANT') {
    if (manifest.ai_core?.status !== 'CANONICAL') fail('UIUX_CONSUMER_CONFORMANT_CORE_NOT_CANONICAL');
    if (!manifest.conformance_receipts?.length) fail('UIUX_CONSUMER_CONFORMANCE_RECEIPT_REQUIRED');
    if (manifest.verification?.pending_conformance?.length) fail('UIUX_CONSUMER_PENDING_CONFORMANCE_REMAINS');
    if (manifest.exceptions?.length) fail('UIUX_CONSUMER_CONFORMANT_ACTIVE_EXCEPTION');
  }

  return {
    status: 'VALID',
    product: manifest.product?.id,
    adoption_status: manifest.adoption_status,
    bindings: bindings.size
  };
}
