export function validateUiUxRegistrySemantics(registry) {
  if (!registry || registry.contract !== 'ai-core-ui-ux-feature-registry/v1') {
    throw new Error('UIUX_CONTRACT_INVALID');
  }

  const profileNames = new Set(Object.keys(registry.profiles ?? {}));
  const ids = new Set();
  const families = new Set();

  for (const feature of registry.features ?? []) {
    if (ids.has(feature.id)) throw new Error('UIUX_DUPLICATE_FEATURE_ID:' + feature.id);
    ids.add(feature.id);
    families.add(feature.family);

    if (feature.adoption !== 'REQUIRED') {
      throw new Error('UIUX_FEATURE_NOT_REQUIRED:' + feature.id);
    }

    for (const profile of feature.profiles ?? []) {
      if (!profileNames.has(profile)) {
        throw new Error('UIUX_UNKNOWN_PROFILE:' + feature.id + ':' + profile);
      }
    }

    if (!feature.required_states?.length) throw new Error('UIUX_STATES_REQUIRED:' + feature.id);
    if (!feature.rules?.length) throw new Error('UIUX_RULES_REQUIRED:' + feature.id);
    if (!feature.verification?.length) throw new Error('UIUX_VERIFICATION_REQUIRED:' + feature.id);

    if (feature.kind === 'engine' && !feature.engine_binding) {
      throw new Error('UIUX_ENGINE_BINDING_REQUIRED:' + feature.id);
    }
    if (feature.kind === 'adapter' && !feature.adapter_binding) {
      throw new Error('UIUX_ADAPTER_BINDING_REQUIRED:' + feature.id);
    }
  }

  const requiredFamilies = ['action','form','navigation','data','feedback','overlay','workflow','integration','system'];
  for (const family of requiredFamilies) {
    if (!families.has(family)) throw new Error('UIUX_FAMILY_MISSING:' + family);
  }

  const requiredFeatureIds = [
    'form.file-upload',
    'form.image-upload',
    'data.table',
    'workflow.explicit-save',
    'workflow.permission',
    'integration.engine-job',
    'integration.adapter-connection',
    'integration.sync',
    'integration.import',
    'integration.export',
    'system.localization',
    'system.locale-formatting',
    'system.bidi',
    'system.text-expansion',
    'system.motion-preference',
    'system.contrast-preference',
    'system.reflow-orientation',
    'system.input-method'
  ];
  for (const id of requiredFeatureIds) {
    if (!ids.has(id)) throw new Error('UIUX_BASELINE_FEATURE_MISSING:' + id);
  }

  const i18nVerification = new Set(registry.profiles?.I18N?.verification ?? []);
  for (const check of ['rtl-sample','mixed-bidi','locale-number-date-currency-unit','long-labels']) {
    if (!i18nVerification.has(check)) throw new Error('UIUX_I18N_VERIFICATION_MISSING:' + check);
  }

  const responsiveVerification = new Set(registry.profiles?.RESPONSIVE?.verification ?? []);
  for (const check of ['200%-zoom','400%-reflow','virtual-keyboard','portrait-landscape']) {
    if (!responsiveVerification.has(check)) throw new Error('UIUX_RESPONSIVE_VERIFICATION_MISSING:' + check);
  }

  return {
    status: 'VALID',
    count: ids.size,
    families: families.size,
    profiles: profileNames.size
  };
}
