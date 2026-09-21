export function validateUiUxEntrypointSemantics(entry) {
  if (entry?.contract !== 'ai-core-ui-ux-entrypoint/v1') {
    throw new Error('UIUX_ENTRY_CONTRACT_INVALID');
  }
  if (entry?.status !== 'CANONICAL_ENTRYPOINT') {
    throw new Error('UIUX_ENTRY_STATUS_INVALID');
  }
  if (entry?.start_document !== 'docs/UI_UX_START_HERE.md') {
    throw new Error('UIUX_ENTRY_START_DOCUMENT_INVALID');
  }

  const readOrder = entry?.entry_read_order ?? [];
  const requiredReadOrder = [
    'docs/UI_UX_START_HERE.md',
    'docs/UI_UX_CONSTITUTION.md',
    'docs/SCREEN_DESIGN_STANDARD.md',
    'docs/RESPONSIVE_STANDARD.md',
    'registry/ui-ux-features.json',
    'design-system/tokens.json',
    'design-system/components.registry.json',
    'design-system/patterns.registry.json',
    'design-system/interaction.contract.json',
    'design-system/runtime-v2.css'
  ];
  for (const path of requiredReadOrder) {
    if (!readOrder.includes(path)) throw new Error(`UIUX_ENTRY_REQUIRED_SOURCE_MISSING:${path}`);
  }
  if (readOrder[0] !== 'docs/UI_UX_START_HERE.md') {
    throw new Error('UIUX_ENTRY_START_NOT_FIRST');
  }

  const sources = entry?.machine_sources ?? {};
  const expectedSources = {
    feature_registry: 'registry/ui-ux-features.json',
    tokens: 'design-system/tokens.json',
    components: 'design-system/components.registry.json',
    patterns: 'design-system/patterns.registry.json',
    interaction_contract: 'design-system/interaction.contract.json',
    runtime_css: 'design-system/runtime-v2.css'
  };
  for (const [key, value] of Object.entries(expectedSources)) {
    if (sources[key] !== value) throw new Error(`UIUX_ENTRY_MACHINE_SOURCE_INVALID:${key}`);
  }

  if (entry?.product_profiles?.FREEPASS !== 'docs/FREEPASS_PRODUCT_UI_PROFILE.md') {
    throw new Error('UIUX_ENTRY_FREEPASS_PROFILE_MISSING');
  }
  if (entry?.execution?.design_hub_repository !== 'freepass-creator/devcenter') {
    throw new Error('UIUX_ENTRY_DESIGN_HUB_REPOSITORY_INVALID');
  }
  if (entry?.execution?.design_hub_entry !== 'hubs/design/README.md') {
    throw new Error('UIUX_ENTRY_DESIGN_HUB_ENTRY_INVALID');
  }
  if (entry?.execution?.design_hub_binding !== 'hubs/design/core-binding.json') {
    throw new Error('UIUX_ENTRY_DESIGN_HUB_BINDING_INVALID');
  }
  if (entry?.execution?.quality_hub_entry !== 'hubs/quality/README.md') {
    throw new Error('UIUX_ENTRY_QUALITY_HUB_ENTRY_INVALID');
  }

  const requiredSequence = [
    'PIN_AI_CORE_REVISION',
    'READ_START_HERE',
    'READ_NORMATIVE_BASELINE',
    'MAP_FEATURE_IDS',
    'LOAD_MACHINE_SOURCES',
    'LOAD_PRODUCT_PROFILE',
    'RESOLVE_BRAND_SSOT',
    'ROUTE_TO_DESIGN_HUB',
    'IMPLEMENT_PROJECT',
    'QUALITY_HUB_VERIFY',
    'DELIVERY_VERIFY_IF_DEPLOYED'
  ];
  const sequence = entry?.mandatory_sequence ?? [];
  for (const step of requiredSequence) {
    if (!sequence.includes(step)) throw new Error(`UIUX_ENTRY_SEQUENCE_MISSING:${step}`);
  }

  const requiredFailClosed = [
    'BRAND_UNRESOLVED_HOLD',
    'PRODUCT_PROFILE_REQUIRED',
    'NO_LOCAL_STANDARD_FORK',
    'CONTRACT_ONLY_RUNTIME_HOLD',
    'DESIGN_HUB_BINDING_MUST_MATCH_CANONICAL_UIUX_SOURCE_SET',
    'RESPONSIVE_PROBES_REQUIRED',
    'VISUAL_QA_REQUIRED_FOR_VERIFIED',
    'PREVIEW_IS_NOT_CONFORMANCE'
  ];
  const failClosed = entry?.fail_closed_rules ?? [];
  for (const rule of requiredFailClosed) {
    if (!failClosed.includes(rule)) throw new Error(`UIUX_ENTRY_FAIL_CLOSED_MISSING:${rule}`);
  }

  return {
    status: 'VALID',
    readSources: readOrder.length,
    sequenceSteps: sequence.length,
    failClosedRules: failClosed.length
  };
}

function collectRequiredBoundSourcePaths(
  entry,
  { entryPath = 'registry/ui-ux-entrypoint.json' } = {}
) {
  return [
    ...new Set([
      entryPath,
      ...(entry?.entry_read_order ?? []),
      ...Object.values(entry?.product_profiles ?? {})
    ])
  ];
}

export function getUiUxRequiredBoundSourcePaths(
  entry,
  { entryPath = 'registry/ui-ux-entrypoint.json' } = {}
) {
  validateUiUxEntrypointSemantics(entry);
  return collectRequiredBoundSourcePaths(entry, { entryPath });
}

export function validateUiUxTargetBinding(
  entry,
  {
    coreRepository = 'freepass-creator/ai-core',
    currentCoreRevision,
    currentSourceBlobs,
    designHubBinding,
    entryPath = 'registry/ui-ux-entrypoint.json'
  } = {}
) {
  validateUiUxEntrypointSemantics(entry);

  if (typeof currentCoreRevision !== 'string' || currentCoreRevision.trim() === '') {
    throw new Error('UIUX_PREFLIGHT_CORE_REVISION_REQUIRED');
  }
  if (!currentSourceBlobs || typeof currentSourceBlobs !== 'object') {
    throw new Error('UIUX_PREFLIGHT_SOURCE_BLOBS_REQUIRED');
  }
  if (!designHubBinding || typeof designHubBinding !== 'object') {
    throw new Error('UIUX_PREFLIGHT_DESIGN_HUB_BINDING_REQUIRED');
  }
  if (designHubBinding.contract !== 'devcenter-design-core-binding/v1') {
    throw new Error('UIUX_DESIGN_HUB_BINDING_CONTRACT_INVALID');
  }
  if (designHubBinding?.ai_core?.repository !== coreRepository) {
    throw new Error('UIUX_DESIGN_HUB_CORE_REPOSITORY_MISMATCH');
  }
  if (
    typeof designHubBinding?.ai_core?.revision !== 'string' ||
    designHubBinding.ai_core.revision.trim() === ''
  ) {
    throw new Error('UIUX_DESIGN_HUB_BASELINE_REVISION_REQUIRED');
  }

  const sourceBindingsByPath = new Map();
  for (const [key, sourceBinding] of Object.entries(designHubBinding?.sources ?? {})) {
    const path = sourceBinding?.path;
    if (typeof path !== 'string' || path.trim() === '') continue;
    if (sourceBindingsByPath.has(path)) {
      throw new Error(`UIUX_DESIGN_HUB_SOURCE_PATH_DUPLICATE:${path}`);
    }
    sourceBindingsByPath.set(path, { key, sourceBinding });
  }

  const requiredSourcePaths = collectRequiredBoundSourcePaths(entry, { entryPath });
  for (const requiredPath of requiredSourcePaths) {
    const matched = sourceBindingsByPath.get(requiredPath);
    if (!matched) {
      throw new Error(`UIUX_DESIGN_HUB_REQUIRED_SOURCE_MISSING:${requiredPath}`);
    }

    const { key, sourceBinding } = matched;
    if (typeof sourceBinding.blob_sha !== 'string' || sourceBinding.blob_sha.trim() === '') {
      throw new Error(`UIUX_DESIGN_HUB_SOURCE_BLOB_REQUIRED:${key}`);
    }
    if (currentSourceBlobs[requiredPath] !== sourceBinding.blob_sha) {
      throw new Error(`UIUX_DESIGN_HUB_SOURCE_BLOB_STALE:${key}`);
    }
  }

  return {
    status: 'VALID',
    coreRepository,
    currentCoreRevision,
    designHubBaselineRevision: designHubBinding.ai_core.revision,
    verifiedSourceCount: requiredSourcePaths.length
  };
}
