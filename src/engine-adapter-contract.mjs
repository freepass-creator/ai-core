export function validateEngineContract(engine) {
  const errors = [];
  if (!engine?.engine_id) errors.push('ENGINE_ID_REQUIRED');
  if (!engine?.version) errors.push('ENGINE_VERSION_REQUIRED');
  if (!engine?.source?.locator || !engine?.source?.revision) errors.push('ENGINE_SOURCE_REVISION_REQUIRED');
  if (!Array.isArray(engine?.invariants) || engine.invariants.length === 0) errors.push('ENGINE_INVARIANTS_REQUIRED');
  if (!Array.isArray(engine?.verification_profile) || engine.verification_profile.length === 0) errors.push('ENGINE_VERIFICATION_REQUIRED');
  if (engine?.side_effects === true && (!Array.isArray(engine?.required_ports) || engine.required_ports.length === 0)) {
    errors.push('ENGINE_SIDE_EFFECT_REQUIRES_PORT');
  }
  return { ok: errors.length === 0, errors };
}

export function validateAdapterContract(adapter) {
  const errors = [];
  if (!adapter?.adapter_id) errors.push('ADAPTER_ID_REQUIRED');
  if (!adapter?.port_id) errors.push('ADAPTER_PORT_REQUIRED');
  if (!adapter?.source?.locator || !adapter?.source?.revision) errors.push('ADAPTER_SOURCE_REVISION_REQUIRED');
  if (!Array.isArray(adapter?.mapping) || adapter.mapping.length === 0) errors.push('ADAPTER_MAPPING_REQUIRED');
  if (!adapter?.auth_boundary) errors.push('ADAPTER_AUTH_BOUNDARY_REQUIRED');
  if (!Array.isArray(adapter?.data_classification) || adapter.data_classification.length === 0) errors.push('ADAPTER_DATA_CLASSIFICATION_REQUIRED');
  if (!Array.isArray(adapter?.failure_mapping) || adapter.failure_mapping.length === 0) errors.push('ADAPTER_FAILURE_MAPPING_REQUIRED');
  if (!adapter?.health_check) errors.push('ADAPTER_HEALTH_CHECK_REQUIRED');
  if (adapter?.side_effects === true && adapter?.idempotency === 'UNSUPPORTED') errors.push('SIDE_EFFECT_ADAPTER_IDEMPOTENCY_UNSUPPORTED');
  return { ok: errors.length === 0, errors };
}

export function resolveBinding({ engine, adapters, profile }) {
  const errors = [];
  const engineCheck = validateEngineContract(engine);
  if (!engineCheck.ok) errors.push(...engineCheck.errors);

  const binding = profile?.engine_bindings?.find(
    (b) => b.engine_id === engine?.engine_id && b.engine_version === engine?.version
  );
  if (!binding) errors.push('ENGINE_BINDING_NOT_FOUND');

  const selected = [];
  for (const port of engine?.required_ports ?? []) {
    const matches = binding?.ports?.filter((p) => p.port_id === port) ?? [];
    if (matches.length === 0) {
      errors.push(`PORT_UNRESOLVED:${port}`);
      continue;
    }
    if (matches.length > 1) {
      errors.push(`PORT_DUPLICATE_BINDING:${port}`);
      continue;
    }
    const adapter = adapters.find((a) => a.adapter_id === matches[0].adapter_id);
    if (!adapter) {
      errors.push(`ADAPTER_NOT_FOUND:${matches[0].adapter_id}`);
      continue;
    }
    const adapterCheck = validateAdapterContract(adapter);
    if (!adapterCheck.ok) errors.push(...adapterCheck.errors.map((e) => `${adapter.adapter_id}:${e}`));
    if (adapter.port_id !== port) errors.push(`ADAPTER_PORT_MISMATCH:${adapter.adapter_id}`);
    selected.push(adapter);
  }

  return {
    status: errors.length === 0 ? 'RESOLVED' : 'HOLD',
    authorization: 'NOT_GRANTED',
    selected_adapters: selected.map((a) => a.adapter_id),
    errors,
  };
}
