const REQUIRED_VIEWPORTS = [360, 390, 412, 1280, 1440];
const REQUIRED_LOCALES = ['ko-KR', 'en-US', 'de-DE', 'ar-SA'];
const REQUIRED_INPUTS = ['keyboard', 'touch', 'pointer', 'ime-composition'];
const REQUIRED_PREFERENCES = ['reduced-motion', 'forced-colors', '200%-zoom'];
const REQUIRED_STATES = ['loading', 'empty', 'error', 'populated'];

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function includesAll(actual = [], required = []) {
  return required.every((value) => actual.includes(value));
}

export function validateUiUxConformanceReceiptSemantics(receipt, knownFeatureIds = []) {
  if (receipt?.contract !== 'ai-core-ui-ux-conformance-receipt/v1') {
    fail('UIUX_RECEIPT_CONTRACT_INVALID');
  }

  const known = new Set(knownFeatureIds);
  const featureIds = new Set();
  let nonPass = 0;
  for (const result of receipt.feature_results ?? []) {
    if (featureIds.has(result.feature_id)) fail('UIUX_RECEIPT_FEATURE_DUPLICATE', result.feature_id);
    featureIds.add(result.feature_id);
    if (known.size && !known.has(result.feature_id)) fail('UIUX_RECEIPT_UNKNOWN_FEATURE', result.feature_id);
    if (result.status !== 'PASS') nonPass += 1;
  }

  if (receipt.status === 'PASS' && nonPass > 0) fail('UIUX_RECEIPT_PASS_WITH_NONPASS_FEATURE');

  if (!includesAll(receipt.required_matrix?.viewports, REQUIRED_VIEWPORTS)) fail('UIUX_RECEIPT_VIEWPORT_MATRIX_INCOMPLETE');
  if (!includesAll(receipt.required_matrix?.locales, REQUIRED_LOCALES)) fail('UIUX_RECEIPT_LOCALE_MATRIX_INCOMPLETE');
  if (!includesAll(receipt.required_matrix?.input_modes, REQUIRED_INPUTS)) fail('UIUX_RECEIPT_INPUT_MATRIX_INCOMPLETE');
  if (!includesAll(receipt.required_matrix?.preferences, REQUIRED_PREFERENCES)) fail('UIUX_RECEIPT_PREFERENCE_MATRIX_INCOMPLETE');
  if (!includesAll(receipt.required_matrix?.states, REQUIRED_STATES)) fail('UIUX_RECEIPT_STATE_MATRIX_INCOMPLETE');

  if (receipt.claim_level === 'CONFORMANT') {
    if (receipt.ai_core?.status !== 'CANONICAL') fail('UIUX_RECEIPT_CONFORMANT_CORE_NOT_CANONICAL');
    if (receipt.status !== 'PASS') fail('UIUX_RECEIPT_CONFORMANT_NOT_PASS');
  }

  return {
    status: 'VALID',
    claim_level: receipt.claim_level,
    receipt_status: receipt.status,
    features: featureIds.size
  };
}
