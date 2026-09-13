export const DEFAULT_INSTITUTIONS = [
  { id:'core.ai', kind:'core', status:'candidate', repository:'freepass-creator/ai-core' },
  { id:'plane.control', kind:'plane', status:'logical', source:'freepass-creator/aiops:docs/CONTROL_PLANE.md' },
  { id:'plane.intelligence', kind:'plane', status:'logical' },
  { id:'plane.capability', kind:'plane', status:'logical', source:'freepass-creator/devcenter:registry.json' },
  { id:'plane.execution', kind:'plane', status:'logical' },
  { id:'plane.evidence', kind:'plane', status:'logical' },
  { id:'plane.evolution', kind:'plane', status:'logical' },
  { id:'center.work', kind:'center', status:'logical', aliases:['aiops'], repository:'freepass-creator/aiops' },
  { id:'center.dev', kind:'center', status:'logical', aliases:['devcenter'], repository:'freepass-creator/devcenter' },
  { id:'center.doc', kind:'center', status:'logical', aliases:['docshub'], repository:'freepass-creator/docshub' },
  { id:'center.data', kind:'center', status:'proposed' },
  { id:'center.research', kind:'center', status:'proposed' },
];

export function buildInstitutionIndex(items=DEFAULT_INSTITUTIONS){
  const byId=new Map();
  const aliases=new Map();
  for(const item of items){
    if(!item.id) throw new Error('institution id required');
    if(byId.has(item.id)) throw new Error(`duplicate institution id: ${item.id}`);
    byId.set(item.id,item);
    for(const alias of item.aliases??[]){
      if(aliases.has(alias)) throw new Error(`duplicate institution alias: ${alias}`);
      aliases.set(alias,item.id);
    }
  }
  return {byId,aliases};
}

export function resolveInstitution(ref, items=DEFAULT_INSTITUTIONS){
  const {byId,aliases}=buildInstitutionIndex(items);
  if(byId.has(ref)) return {status:'RESOLVED', institution:byId.get(ref), via:'id'};
  const id=aliases.get(ref);
  if(id) return {status:'RESOLVED', institution:byId.get(id), via:'alias'};
  return {status:'MISSING', ref};
}

export function centerCreationGate(candidate={}){
  const signals={
    independent_ssot:Boolean(candidate.independent_ssot),
    reusable_capabilities:Boolean(candidate.reusable_capabilities),
    distinct_verification:Boolean(candidate.distinct_verification),
    repeated_cross_project_use:Boolean(candidate.repeated_cross_project_use),
  };
  const score=Object.values(signals).filter(Boolean).length;
  return {
    score,
    signals,
    decision:score>=3?'CENTER_CANDIDATE':'KEEP_AS_CAPABILITY_FAMILY',
    authorization:'NOT_GRANTED'
  };
}

export function capabilityDescriptor(input={}){
  const required=['id','owner','source','inputs','outputs','verification'];
  const missing=required.filter(k=>input[k]==null);
  return {
    ...input,
    status:missing.length?'HOLD':'DESCRIBED',
    missing,
    authorization:'NOT_GRANTED'
  };
}
