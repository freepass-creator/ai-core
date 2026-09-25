const need=(condition,code)=>{if(!condition) throw new Error(code);};

export function validateEngineContract(engine){
  need(engine?.schema_version==='core-engine-contract/v1','ENGINE_SCHEMA_VERSION_INVALID');
  need(typeof engine.engine_id==='string'&&engine.engine_id.includes('.'),'ENGINE_ID_REQUIRED');
  need(typeof engine.version==='string'&&engine.version.length>0,'ENGINE_VERSION_REQUIRED');
  need(engine?.source?.locator&&engine?.source?.revision,'ENGINE_SOURCE_REVISION_REQUIRED');
  need(Array.isArray(engine.invariants)&&engine.invariants.length>0,'ENGINE_INVARIANTS_REQUIRED');
  need(Array.isArray(engine.verification_profile)&&engine.verification_profile.length>0,'ENGINE_VERIFICATION_REQUIRED');
  need(['PURE','PORT_MEDIATED'].includes(engine.effect_model),'ENGINE_EFFECT_MODEL_INVALID');
  if(engine.effect_model==='PORT_MEDIATED') need(Array.isArray(engine.required_ports)&&engine.required_ports.length>0,'ENGINE_PORT_REQUIRED');
  return {status:'VALID'};
}

export function validateAdapterContract(adapter){
  need(adapter?.schema_version==='core-adapter-contract/v1','ADAPTER_SCHEMA_VERSION_INVALID');
  need(typeof adapter.adapter_id==='string'&&adapter.adapter_id.includes('.'),'ADAPTER_ID_REQUIRED');
  need(typeof adapter.adapter_version==='string'&&adapter.adapter_version.length>0,'ADAPTER_VERSION_REQUIRED');
  need(typeof adapter.port_id==='string'&&adapter.port_id.includes('.'),'ADAPTER_PORT_REQUIRED');
  need(adapter?.source?.locator&&adapter?.source?.revision,'ADAPTER_SOURCE_REVISION_REQUIRED');
  need(Array.isArray(adapter.mapping)&&adapter.mapping.length>0,'ADAPTER_MAPPING_REQUIRED');
  need(typeof adapter.auth_boundary==='string'&&adapter.auth_boundary.length>0,'ADAPTER_AUTH_BOUNDARY_REQUIRED');
  need(Array.isArray(adapter.data_classification)&&adapter.data_classification.length>0,'ADAPTER_DATA_CLASSIFICATION_REQUIRED');
  need(Array.isArray(adapter.failure_mapping)&&adapter.failure_mapping.length>0,'ADAPTER_FAILURE_MAPPING_REQUIRED');
  need(typeof adapter.health_check==='string'&&adapter.health_check.length>0,'ADAPTER_HEALTH_CHECK_REQUIRED');
  if(adapter.side_effects===true) need(adapter.idempotency!=='UNSUPPORTED','SIDE_EFFECT_ADAPTER_IDEMPOTENCY_UNSUPPORTED');
  need(Number.isInteger(adapter.timeout_ms)&&adapter.timeout_ms>0,'ADAPTER_TIMEOUT_INVALID');
  return {status:'VALID'};
}

export function resolveBinding({engine,adapters,profile}){
  const errors=[];
  try{validateEngineContract(engine);}catch(error){errors.push(error.message);}
  const binding=profile?.engine_bindings?.find(x=>x.engine_id===engine?.engine_id&&x.engine_version===engine?.version);
  if(!binding) errors.push('ENGINE_BINDING_NOT_FOUND');

  const selected=[];
  const required=engine?.required_ports??[];
  for(const port of required){
    const matches=binding?.ports?.filter(x=>x.port_id===port.port_id)??[];
    if(matches.length===0){errors.push(`PORT_UNRESOLVED:${port.port_id}`);continue;}
    if(matches.length>1){errors.push(`PORT_DUPLICATE_BINDING:${port.port_id}`);continue;}
    const adapterMatches=adapters.filter(x=>x.adapter_id===matches[0].adapter_id);
    if(adapterMatches.length===0){errors.push(`ADAPTER_NOT_FOUND:${matches[0].adapter_id}`);continue;}
    if(adapterMatches.length>1){errors.push(`ADAPTER_DUPLICATE_ID:${matches[0].adapter_id}`);continue;}
    const [adapter]=adapterMatches;
    try{validateAdapterContract(adapter);}catch(error){errors.push(`${adapter.adapter_id}:${error.message}`);}
    if(adapter.port_id!==port.port_id) errors.push(`ADAPTER_PORT_MISMATCH:${adapter.adapter_id}`);
    if(!adapter.compatibility?.port_versions?.includes(port.port_version)) errors.push(`ADAPTER_PORT_VERSION_MISMATCH:${adapter.adapter_id}`);
    if((adapter.compatibility?.engine_versions?.length??0)>0&&!adapter.compatibility.engine_versions.includes(engine.version)) {
      errors.push(`ADAPTER_ENGINE_VERSION_MISMATCH:${adapter.adapter_id}`);
    }
    selected.push({port_id:port.port_id,adapter_id:adapter.adapter_id,adapter_version:adapter.adapter_version});
  }

  return {
    status:errors.length===0?'RESOLVED':'HOLD',
    authorization:'NOT_GRANTED',
    subject_revision:profile?.subject_revision??null,
    selected_adapters:selected,
    errors
  };
}
