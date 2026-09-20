import { validateRepositoryContract } from './repository-contract.mjs';
const need=(condition,code)=>{if(!condition) throw new Error(code);};
const text=value=>typeof value==='string'&&value.trim()===value&&value.length>0;

export function validateEngineContract(engine){
  need(engine?.schema_version==='core-engine-contract/v1','ENGINE_SCHEMA_VERSION_INVALID');
  need(typeof engine.engine_id==='string'&&engine.engine_id.includes('.'),'ENGINE_ID_REQUIRED');
  need(typeof engine.version==='string'&&engine.version.length>0,'ENGINE_VERSION_REQUIRED');
  need(engine?.source?.locator&&engine?.source?.revision,'ENGINE_SOURCE_REVISION_REQUIRED');
  need(Array.isArray(engine.invariants)&&engine.invariants.length>0,'ENGINE_INVARIANTS_REQUIRED');
  need(Array.isArray(engine.verification_profile)&&engine.verification_profile.length>0,'ENGINE_VERIFICATION_REQUIRED');
  need(['PURE','PORT_MEDIATED'].includes(engine.effect_model),'ENGINE_EFFECT_MODEL_INVALID');
  if(engine.effect_model==='PORT_MEDIATED') need(Array.isArray(engine.required_ports)&&engine.required_ports.length>0,'ENGINE_PORT_REQUIRED');
  if(engine.effect_model==='PURE') need((engine.required_ports??[]).length===0,'PURE_ENGINE_MUST_NOT_REQUIRE_PORTS');
  const ids=(engine.required_ports??[]).map(x=>x.port_id);
  need(new Set(ids).size===ids.length,'ENGINE_PORT_DUPLICATE');
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
  if(adapter.connector_binding!=null){
    need(text(adapter.connector_binding.connector_id)&&adapter.connector_binding.connector_id.includes('.'),'ADAPTER_CONNECTOR_ID_REQUIRED');
    need(text(adapter.connector_binding.connector_version),'ADAPTER_CONNECTOR_VERSION_REQUIRED');
    need(Array.isArray(adapter.connector_binding.operation_ids)&&adapter.connector_binding.operation_ids.length>0,'ADAPTER_CONNECTOR_OPERATIONS_REQUIRED');
    need(new Set(adapter.connector_binding.operation_ids).size===adapter.connector_binding.operation_ids.length,'ADAPTER_CONNECTOR_OPERATION_DUPLICATE');
  }
  return {status:'VALID'};
}

export function validateBindingProfile(profile,{requireVerified=false}={}){
  need(profile?.schema_version==='core-binding-profile/v1','BINDING_PROFILE_SCHEMA_INVALID');
  need(text(profile.profile_id),'BINDING_PROFILE_ID_REQUIRED');
  need(text(profile.project_id),'BINDING_PROFILE_PROJECT_REQUIRED');
  need(text(profile.environment),'BINDING_PROFILE_ENVIRONMENT_REQUIRED');
  need(text(profile.subject_revision),'BINDING_PROFILE_REVISION_REQUIRED');
  need(Array.isArray(profile.engine_bindings),'BINDING_PROFILE_ENGINES_INVALID');
  const states=new Set(['NOT_RUN','PARTIAL','PASSED_WITHIN_SCOPE','FAILED','STALE']);
  need(states.has(profile.verification_state),'BINDING_PROFILE_VERIFICATION_INVALID');
  if(requireVerified) need(profile.verification_state==='PASSED_WITHIN_SCOPE',`BINDING_PROFILE_VERIFICATION_${profile.verification_state}`);
  const keys=new Set();
  for(const binding of profile.engine_bindings){
    need(text(binding?.engine_id)&&text(binding?.engine_version),'ENGINE_BINDING_IDENTITY_REQUIRED');
    const key=`${binding.engine_id}@${binding.engine_version}`;
    need(!keys.has(key),`ENGINE_BINDING_DUPLICATE:${key}`);
    keys.add(key);
    need(Array.isArray(binding.ports),'ENGINE_BINDING_PORTS_INVALID');
    const portIds=binding.ports.map(x=>x?.port_id);
    need(new Set(portIds).size===portIds.length,`ENGINE_BINDING_PORT_DUPLICATE:${key}`);
  }
  const serviceKeys=new Set();
  for(const binding of profile.service_bindings??[]){
    need(text(binding?.service_id)&&text(binding?.service_version),'SERVICE_BINDING_IDENTITY_REQUIRED');
    const key=`${binding.service_id}@${binding.service_version}`;
    need(!serviceKeys.has(key),`SERVICE_BINDING_DUPLICATE:${key}`);
    serviceKeys.add(key);
    need(Array.isArray(binding.ports),'SERVICE_BINDING_PORTS_INVALID');
    const portIds=binding.ports.map(x=>x?.port_id);
    need(new Set(portIds).size===portIds.length,`SERVICE_BINDING_PORT_DUPLICATE:${key}`);
    for(const port of binding.ports){
      const hasAdapter=text(port?.adapter_id);
      const hasRepository=text(port?.repository_id);
      need(hasAdapter!==hasRepository,`SERVICE_BINDING_TARGET_INVALID:${key}:${port?.port_id??'unknown'}`);
    }
  }
  return {status:'VALID'};
}

export function resolveBinding({engine,adapters=[],profile,requireVerified=false}){
  const errors=[];
  try{validateEngineContract(engine);}catch(error){errors.push(error.message);}
  try{validateBindingProfile(profile,{requireVerified});}catch(error){errors.push(error.message);}

  const adapterIds=new Set();
  for(const adapter of adapters){
    if(adapterIds.has(adapter.adapter_id)) errors.push(`ADAPTER_ID_DUPLICATE:${adapter.adapter_id}`);
    adapterIds.add(adapter.adapter_id);
  }

  const required=engine?.required_ports??[];
  const needsBinding=engine?.effect_model==='PORT_MEDIATED'||required.length>0;
  const binding=profile?.engine_bindings?.find(x=>x.engine_id===engine?.engine_id&&x.engine_version===engine?.version);
  if(needsBinding&&!binding) errors.push('ENGINE_BINDING_NOT_FOUND');

  if(binding){
    const requiredIds=new Set(required.map(x=>x.port_id));
    for(const p of binding.ports??[]){
      if(!requiredIds.has(p.port_id)) errors.push(`UNDECLARED_PORT_BINDING:${p.port_id}`);
    }
  }

  const selected=[];
  for(const port of required){
    const matches=binding?.ports?.filter(x=>x.port_id===port.port_id)??[];
    if(matches.length===0){errors.push(`PORT_UNRESOLVED:${port.port_id}`);continue;}
    if(matches.length>1){errors.push(`PORT_DUPLICATE_BINDING:${port.port_id}`);continue;}
    const adapter=adapters.find(x=>x.adapter_id===matches[0].adapter_id);
    if(!adapter){errors.push(`ADAPTER_NOT_FOUND:${matches[0].adapter_id}`);continue;}
    try{validateAdapterContract(adapter);}catch(error){errors.push(`${adapter.adapter_id}:${error.message}`);}
    if(adapter.port_id!==port.port_id) errors.push(`ADAPTER_PORT_MISMATCH:${adapter.adapter_id}`);
    if(adapter.project_scope!=null&&adapter.project_scope!==profile?.project_id) errors.push(`ADAPTER_PROJECT_SCOPE_MISMATCH:${adapter.adapter_id}`);
    if(!adapter.compatibility?.port_versions?.includes(port.port_version)) errors.push(`ADAPTER_PORT_VERSION_MISMATCH:${adapter.adapter_id}`);
    if((adapter.compatibility?.engine_versions?.length??0)>0&&!adapter.compatibility.engine_versions.includes(engine.version)) {
      errors.push(`ADAPTER_ENGINE_VERSION_MISMATCH:${adapter.adapter_id}`);
    }
    selected.push({
      port_id:port.port_id,
      port_version:port.port_version,
      adapter_id:adapter.adapter_id,
      adapter_version:adapter.adapter_version,
      side_effects:adapter.side_effects===true,
      idempotency:adapter.idempotency,
      timeout_ms:adapter.timeout_ms,
      source_revision:adapter.source?.revision??null,
    });
  }

  return {
    status:errors.length===0?'RESOLVED':'HOLD',
    authorization:'NOT_GRANTED',
    project_id:profile?.project_id??null,
    environment:profile?.environment??null,
    subject_revision:profile?.subject_revision??null,
    verification_state:profile?.verification_state??null,
    selected_adapters:selected,
    errors
  };
}

export function validateApplicationServiceContract(service){
  need(service?.schema_version==='core-application-service-contract/v1','SERVICE_SCHEMA_VERSION_INVALID');
  need(text(service.service_id)&&service.service_id.includes('.'),'SERVICE_ID_REQUIRED');
  need(text(service.version),'SERVICE_VERSION_REQUIRED');
  need(service?.source?.locator&&service?.source?.revision,'SERVICE_SOURCE_REVISION_REQUIRED');
  need(Array.isArray(service.use_cases)&&service.use_cases.length>0,'SERVICE_USE_CASES_REQUIRED');
  need(Array.isArray(service.required_ports),'SERVICE_PORTS_INVALID');
  need(Array.isArray(service.verification_profile)&&service.verification_profile.length>0,'SERVICE_VERIFICATION_REQUIRED');
  const useCases=new Set();
  for(const useCase of service.use_cases){
    need(text(useCase?.name),'SERVICE_USE_CASE_NAME_REQUIRED');
    need(!useCases.has(useCase.name),`SERVICE_USE_CASE_DUPLICATE:${useCase.name}`);
    useCases.add(useCase.name);
    need(['REQUIRED','SUPPORTED','NOT_APPLICABLE'].includes(useCase.idempotency),'SERVICE_IDEMPOTENCY_INVALID');
    need(['REQUIRED','OPTIONAL','NONE'].includes(useCase.actor_requirement),'SERVICE_ACTOR_REQUIREMENT_INVALID');
    need(['REPOSITORY_ATOMIC','ORCHESTRATED','READ_ONLY','NONE'].includes(useCase.transaction_boundary),'SERVICE_TRANSACTION_BOUNDARY_INVALID');
  }
  const portIds=service.required_ports.map(x=>x?.port_id);
  need(new Set(portIds).size===portIds.length,'SERVICE_PORT_DUPLICATE');
  return {status:'VALID'};
}

export function resolveServiceBinding({service,adapters=[],repositories=[],profile,requireVerified=false}){
  const errors=[];
  try{validateApplicationServiceContract(service);}catch(error){errors.push(error.message);}
  try{validateBindingProfile(profile,{requireVerified});}catch(error){errors.push(error.message);}

  const adapterIds=new Set();
  for(const adapter of adapters){
    if(adapterIds.has(adapter.adapter_id)) errors.push(`ADAPTER_ID_DUPLICATE:${adapter.adapter_id}`);
    adapterIds.add(adapter.adapter_id);
  }

  const binding=profile?.service_bindings?.find(x=>x.service_id===service?.service_id&&x.service_version===service?.version);
  if(!binding) errors.push('SERVICE_BINDING_NOT_FOUND');

  const required=service?.required_ports??[];
  if(binding){
    const requiredIds=new Set(required.map(x=>x.port_id));
    for(const p of binding.ports??[]){
      if(!requiredIds.has(p.port_id)) errors.push(`UNDECLARED_PORT_BINDING:${p.port_id}`);
    }
  }

  const repositoryIds=new Set();
  for(const repository of repositories){
    if(repositoryIds.has(repository.repository_id)) errors.push(`REPOSITORY_ID_DUPLICATE:${repository.repository_id}`);
    repositoryIds.add(repository.repository_id);
  }

  const selectedAdapters=[];
  const selectedRepositories=[];
  for(const port of required){
    const matches=binding?.ports?.filter(x=>x.port_id===port.port_id)??[];
    if(matches.length===0){errors.push(`PORT_UNRESOLVED:${port.port_id}`);continue;}
    if(matches.length>1){errors.push(`PORT_DUPLICATE_BINDING:${port.port_id}`);continue;}
    const target=matches[0];

    if(target.adapter_id){
      const adapter=adapters.find(x=>x.adapter_id===target.adapter_id);
      if(!adapter){errors.push(`ADAPTER_NOT_FOUND:${target.adapter_id}`);continue;}
      try{validateAdapterContract(adapter);}catch(error){errors.push(`${adapter.adapter_id}:${error.message}`);}
      if(adapter.port_id!==port.port_id) errors.push(`ADAPTER_PORT_MISMATCH:${adapter.adapter_id}`);
      if(adapter.project_scope!=null&&adapter.project_scope!==profile?.project_id) errors.push(`ADAPTER_PROJECT_SCOPE_MISMATCH:${adapter.adapter_id}`);
      if(!adapter.compatibility?.port_versions?.includes(port.port_version)) errors.push(`ADAPTER_PORT_VERSION_MISMATCH:${adapter.adapter_id}`);
      selectedAdapters.push({
        binding_kind:'ADAPTER',
        port_id:port.port_id,
        port_version:port.port_version,
        adapter_id:adapter.adapter_id,
        adapter_version:adapter.adapter_version,
        side_effects:adapter.side_effects===true,
        idempotency:adapter.idempotency,
        timeout_ms:adapter.timeout_ms,
        source_revision:adapter.source?.revision??null,
      });
      continue;
    }

    if(target.repository_id){
      const repository=repositories.find(x=>x.repository_id===target.repository_id);
      if(!repository){errors.push(`REPOSITORY_NOT_FOUND:${target.repository_id}`);continue;}
      try{validateRepositoryContract(repository);}catch(error){errors.push(`${repository.repository_id}:${error.message}`);}
      if(repository.port_id!==port.port_id) errors.push(`REPOSITORY_PORT_MISMATCH:${repository.repository_id}`);
      if(repository.port_version!==port.port_version) errors.push(`REPOSITORY_PORT_VERSION_MISMATCH:${repository.repository_id}`);
      if(repository.project_scope!=null&&repository.project_scope!==profile?.project_id) errors.push(`REPOSITORY_PROJECT_SCOPE_MISMATCH:${repository.repository_id}`);
      selectedRepositories.push({
        binding_kind:'REPOSITORY',
        port_id:port.port_id,
        port_version:port.port_version,
        repository_id:repository.repository_id,
        repository_version:repository.repository_version,
        source_revision:repository.source?.revision??null,
      });
      continue;
    }

    errors.push(`SERVICE_BINDING_TARGET_INVALID:${port.port_id}`);
  }

  return {
    status:errors.length===0?'RESOLVED':'HOLD',
    authorization:'NOT_GRANTED',
    owner_kind:'APPLICATION_SERVICE',
    owner_id:service?.service_id??null,
    owner_version:service?.version??null,
    project_id:profile?.project_id??null,
    environment:profile?.environment??null,
    subject_revision:profile?.subject_revision??null,
    verification_state:profile?.verification_state??null,
    selected_adapters:selectedAdapters,
    selected_repositories:selectedRepositories,
    errors
  };
}

