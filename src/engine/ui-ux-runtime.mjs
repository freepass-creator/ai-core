function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function sameArray(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
}

export function validateUiUxRuntimeSemantics({
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
  runtimeCss
}) {
  if (featureRegistry?.contract !== 'ai-core-ui-ux-feature-registry/v1') fail('UIUX_FEATURE_REGISTRY_INVALID');
  if (tokens?.contract !== 'ai-core-design-token-ssot/v1') fail('UIUX_TOKEN_CONTRACT_INVALID');
  if (components?.contract !== 'ai-core-ui-component-registry/v1') fail('UIUX_COMPONENT_CONTRACT_INVALID');
  if (patterns?.contract !== 'ai-core-ui-pattern-registry/v1') fail('UIUX_PATTERN_CONTRACT_INVALID');
  if (interactions?.contract !== 'ai-core-ui-interaction-contract/v1') fail('UIUX_INTERACTION_CONTRACT_INVALID');
  if (screenManifest?.contract !== 'ai-core-ui-screen-manifest/v1') fail('UIUX_SCREEN_MANIFEST_INVALID');
  if (governance?.contract !== 'ai-core-ui-ux-governance/v1') fail('UIUX_GOVERNANCE_CONTRACT_INVALID');
  if (consumers?.contract !== 'ai-core-ui-ux-consumers/v1') fail('UIUX_CONSUMER_CONTRACT_INVALID');

  const featureById = new Map((featureRegistry.features ?? []).map((feature) => [feature.id, feature]));
  if (featureById.size !== (featureRegistry.features ?? []).length) fail('UIUX_FEATURE_ID_DUPLICATE');

  const expectedComponentIds = (featureRegistry.features ?? [])
    .filter((feature) => feature.kind === 'component')
    .map((feature) => feature.id)
    .sort();

  const componentIds = (components.components ?? []).map((entry) => entry.feature_id);
  const uniqueComponentIds = new Set(componentIds);
  if (uniqueComponentIds.size !== componentIds.length) fail('UIUX_COMPONENT_ID_DUPLICATE');

  for (const id of componentIds) {
    const feature = featureById.get(id);
    if (!feature) fail('UIUX_COMPONENT_UNKNOWN_FEATURE', id);
    if (feature.kind !== 'component') fail('UIUX_COMPONENT_NON_COMPONENT_FEATURE', id);
  }

  const actualComponentIds = [...uniqueComponentIds].sort();
  if (!sameArray(expectedComponentIds, actualComponentIds)) {
    const missing = expectedComponentIds.filter((id) => !uniqueComponentIds.has(id));
    const extra = actualComponentIds.filter((id) => !expectedComponentIds.includes(id));
    fail('UIUX_COMPONENT_COVERAGE_MISMATCH', JSON.stringify({ missing, extra }));
  }


  const expectedPatternIds = (featureRegistry.features ?? [])
    .filter((feature) => ['pattern', 'workflow', 'surface'].includes(feature.kind))
    .map((feature) => feature.id)
    .sort();
  const patternIds = (patterns.patterns ?? []).map((entry) => entry.feature_id);
  const uniquePatternIds = new Set(patternIds);
  if (uniquePatternIds.size !== patternIds.length) fail('UIUX_PATTERN_ID_DUPLICATE');

  for (const entry of patterns.patterns ?? []) {
    const feature = featureById.get(entry.feature_id);
    if (!feature) fail('UIUX_PATTERN_UNKNOWN_FEATURE', entry.feature_id);
    if (!['pattern', 'workflow', 'surface'].includes(feature.kind)) {
      fail('UIUX_PATTERN_WRONG_KIND', entry.feature_id);
    }
    if (entry.layer !== feature.kind) fail('UIUX_PATTERN_LAYER_MISMATCH', entry.feature_id);
    for (const componentFeatureId of entry.component_feature_refs ?? []) {
      const componentFeature = featureById.get(componentFeatureId);
      if (!componentFeature || componentFeature.kind !== 'component') {
        fail('UIUX_PATTERN_UNKNOWN_COMPONENT', `${entry.feature_id}:${componentFeatureId}`);
      }
    }

    if (entry.implementation_status === 'RUNTIME_V2') {
      if (!entry.css_selector) fail('UIUX_PATTERN_RUNTIME_SELECTOR_REQUIRED', entry.feature_id);
      const className = entry.css_selector.match(/^[.]ui-[a-z0-9-]+/)?.[0];
      if (className && !runtimeCss.includes(className)) fail('UIUX_PATTERN_RUNTIME_MISSING', entry.feature_id);
    }
    if (entry.implementation_status === 'BASE_COMPAT') {
      if (!entry.css_selector) fail('UIUX_PATTERN_BASE_SELECTOR_REQUIRED', entry.feature_id);
      const className = entry.css_selector.match(/^[.]ui-[a-z0-9-]+/)?.[0];
      if (className && !legacyCss.includes(className)) fail('UIUX_PATTERN_BASE_MISSING', entry.feature_id);
    }
  }

  const actualPatternIds = [...uniquePatternIds].sort();
  if (!sameArray(expectedPatternIds, actualPatternIds)) {
    const missing = expectedPatternIds.filter((id) => !uniquePatternIds.has(id));
    const extra = actualPatternIds.filter((id) => !expectedPatternIds.includes(id));
    fail('UIUX_PATTERN_COVERAGE_MISMATCH', JSON.stringify({ missing, extra }));
  }

  const requiredControlRoles = {
    desktop_compact_px: 40,
    touch_minimum_px: 44,
    quick_action_preferred_px: 48,
    mobile_interactive_row_minimum_px: 64
  };
  for (const [key, expected] of Object.entries(requiredControlRoles)) {
    if (tokens.roles?.control?.[key] !== expected) fail('UIUX_TOKEN_ROLE_DRIFT', `${key}=${tokens.roles?.control?.[key]}`);
  }
  if (!sameArray(tokens.roles?.spacing_scale, [4, 8, 12, 16, 24, 32, 48])) fail('UIUX_SPACING_SCALE_DRIFT');
  if (tokens.roles?.density?.desktop_compact_row_px !== 40 ||
      tokens.roles?.density?.desktop_standard_row_px !== 48 ||
      tokens.roles?.density?.mobile_business_row_px !== 64) fail('UIUX_DENSITY_ROLE_DRIFT');
  if (tokens.roles?.layout?.grid_strategy !== 'CONTENT_DRIVEN' ||
      tokens.roles?.layout?.page_gutter_mobile_px !== 12 ||
      tokens.roles?.layout?.page_gutter_desktop_px !== 16 ||
      tokens.roles?.layout?.card_padding_mobile_px !== 16 ||
      tokens.roles?.layout?.card_padding_desktop_px !== 24 ||
      tokens.roles?.layout?.content_max_px !== 1200) fail('UIUX_LAYOUT_ROLE_DRIFT');
  if (tokens.roles?.focus?.ring_width_px !== 3 || tokens.roles?.focus?.offset_px !== 2) fail('UIUX_FOCUS_TOKEN_DRIFT');
  if (!sameArray(tokens.responsive?.regression_viewports_px, [360, 390, 412, 1280, 1440])) fail('UIUX_VIEWPORT_MATRIX_DRIFT');
  if (!sameArray(tokens.responsive?.zoom_percent, [200]) || tokens.responsive?.reflow_percent !== 400) fail('UIUX_REFLOW_MATRIX_DRIFT');


  const requiredRoleEvidence = [
    'control.desktop_compact_px',
    'control.touch_minimum_px',
    'control.quick_action_preferred_px',
    'density.mobile_business_row_px',
    'spacing_scale',
    'typography.body_default_px',
    'focus.ring_width_px',
    'layout.page_gutter_mobile_px',
    'responsive.regression_viewports_px'
  ];
  for (const key of requiredRoleEvidence) {
    const record = tokens.role_evidence?.[key];
    if (!record) fail('UIUX_TOKEN_EVIDENCE_MISSING', key);
    if (!Array.isArray(record.refs) || record.refs.length === 0) fail('UIUX_TOKEN_EVIDENCE_REFS_MISSING', key);
  }

  for (const [name, value] of Object.entries(tokens.css_variables ?? {})) {
    const declaration = `--${name}: ${value};`;
    if (!tokenCss.includes(declaration)) fail('UIUX_TOKEN_CSS_DRIFT', name);
  }

  const requiredInteractionRules = [
    'action_placement',
    'focus',
    'search_context',
    'search_discovery_composition',
    'variant_selection',
    'single_choice_flow',
    'async_write',
    'external_action',
    'responsive',
    'accessibility',
    'internationalization',
    'file_image_ui',
    'status_feedback',
    'input_method'
  ];
  for (const ruleName of requiredInteractionRules) {
    const rule = interactions.rules?.[ruleName];
    if (!rule) fail('UIUX_INTERACTION_RULE_MISSING', ruleName);
    for (const featureId of rule.feature_refs ?? []) {
      if (!featureById.has(featureId)) fail('UIUX_INTERACTION_UNKNOWN_FEATURE', `${ruleName}:${featureId}`);
    }
  }

  const requiredRuntimeSnippets = [
    '.ui-bottom-action',
    'var(--safe-area-bottom)',
    'border-inline-start',
    'inset-inline-end',
    '[dir="rtl"]',
    'forced-colors: active',
    'prefers-contrast: more',
    'prefers-reduced-motion: reduce',
    'text-align: end',
    'row-height-mobile-min'
  ];
  for (const snippet of requiredRuntimeSnippets) {
    if (!runtimeCss.includes(snippet)) fail('UIUX_RUNTIME_RULE_MISSING', snippet);
  }

  if (!runtimeCss.includes('.ui-directional-icon[data-mirror="true"]')) fail('UIUX_RTL_MIRROR_CONTRACT_MISSING');
  if (runtimeCss.includes('[dir="rtl"] * { transform: scaleX(-1)')) fail('UIUX_RTL_BLANKET_MIRROR_FORBIDDEN');

  const exceptionRules = featureRegistry.global_rules?.exceptions ?? [];
  if (!exceptionRules.some((rule) => /expiry|review date/i.test(rule))) fail('UIUX_EXCEPTION_EXPIRY_REQUIRED');



  const consumerIds = new Set();
  let conformantConsumers = 0;
  for (const consumer of consumers.consumers ?? []) {
    if (consumerIds.has(consumer.id)) fail('UIUX_CONSUMER_ID_DUPLICATE', consumer.id);
    consumerIds.add(consumer.id);
    for (const featureId of consumer.feature_refs ?? []) {
      if (!featureById.has(featureId)) fail('UIUX_CONSUMER_UNKNOWN_FEATURE', `${consumer.id}:${featureId}`);
    }
    if (consumer.adoption_status === 'CONFORMANT') {
      conformantConsumers += 1;
      if (consumer.relation !== 'CANONICAL_CONSUMER') fail('UIUX_CONFORMANT_RELATION_INVALID', consumer.id);
      if (!/^[a-f0-9]{40}$/.test(consumer.conformance_revision ?? '')) fail('UIUX_CONFORMANCE_REVISION_REQUIRED', consumer.id);
      if (!Array.isArray(consumer.conformance_receipts) || consumer.conformance_receipts.length === 0) {
        fail('UIUX_CONFORMANCE_RECEIPT_REQUIRED', consumer.id);
      }
    }
  }
  if (consumers.definition_of_done?.current_conformant_consumers !== conformantConsumers) {
    fail('UIUX_CONSUMER_COUNT_DRIFT', String(conformantConsumers));
  }
  const requiredConformant = consumers.definition_of_done?.required_conformant_consumers ?? 2;
  const expectedDodStatus = conformantConsumers >= requiredConformant ? 'SATISFIED' : 'OPEN';
  if (consumers.definition_of_done?.status !== expectedDodStatus) fail('UIUX_CONSUMER_DOD_STATUS_DRIFT', expectedDodStatus);

  for (const featureId of screenManifest.feature_ids ?? []) {
    if (!featureById.has(featureId)) fail('UIUX_SCREEN_UNKNOWN_FEATURE', featureId);
  }
  const exceptionIds = new Set((governance.exceptions ?? []).map((entry) => entry.id));
  for (const exceptionId of screenManifest.exceptions ?? []) {
    if (!exceptionIds.has(exceptionId)) fail('UIUX_SCREEN_UNKNOWN_EXCEPTION', exceptionId);
  }
  for (const ref of screenManifest.contracts?.data_api ?? []) {
    if (!ref.startsWith('C:')) fail('UIUX_SCREEN_DATA_BOUNDARY_INVALID', ref);
  }
  for (const ref of screenManifest.contracts?.workflow ?? []) {
    if (!ref.startsWith('D:')) fail('UIUX_SCREEN_WORKFLOW_BOUNDARY_INVALID', ref);
  }

  const governanceIds = new Set();
  for (const exception of governance.exceptions ?? []) {
    if (governanceIds.has(exception.id)) fail('UIUX_GOVERNANCE_ID_DUPLICATE', exception.id);
    governanceIds.add(exception.id);
    if (!featureById.has(exception.feature_id)) fail('UIUX_EXCEPTION_UNKNOWN_FEATURE', exception.feature_id);
  }
  for (const deprecation of governance.deprecations ?? []) {
    if (governanceIds.has(deprecation.id)) fail('UIUX_GOVERNANCE_ID_DUPLICATE', deprecation.id);
    governanceIds.add(deprecation.id);
    if (deprecation.kind === 'feature' && deprecation.status !== 'REMOVED' && !featureById.has(deprecation.deprecated_item)) {
      fail('UIUX_DEPRECATION_UNKNOWN_FEATURE', deprecation.deprecated_item);
    }
    if (deprecation.kind === 'feature' && deprecation.replacement && !featureById.has(deprecation.replacement)) {
      fail('UIUX_DEPRECATION_UNKNOWN_REPLACEMENT', deprecation.replacement);
    }
  }

  return {
    status: 'VALID',
    features: featureById.size,
    components: uniqueComponentIds.size,
    patterns: uniquePatternIds.size,
    screen_features: screenManifest.feature_ids?.length ?? 0,
    interaction_rules: requiredInteractionRules.length,
    tokens: Object.keys(tokens.css_variables ?? {}).length,
    governance_entries: (governance.exceptions?.length ?? 0) + (governance.deprecations?.length ?? 0),
    consumers: consumerIds.size,
    conformant_consumers: conformantConsumers
  };
}
