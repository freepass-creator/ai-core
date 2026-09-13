export function resolveSourceRequirements(task) {
  const req = [];
  if (task.project) req.push({ system:'project', kind:'instructions', required:true, reason:'current project rules and revision' });
  req.push({ system:'aiops', kind:'control', required:true, reason:'authority, risk and operational boundary' });
  req.push({ system:'aiops', kind:'knowledge', required:task.domain !== 'development', reason:'business meaning, decisions and relevant failures' });
  if (['development','document'].includes(task.domain)) req.push({ system:'devcenter', kind:'registry', required:true, reason:'standards and reusable capabilities' });
  if (task.domain === 'development') req.push({ system:'devcenter', kind:'inspection', required:true, reason:'verification and corrective-action policy' });
  return req;
}

export function bindResolvedSources(requirements, resolved = []) {
  return requirements.map(req => {
    const hits = resolved.filter(x => x.system === req.system && x.kind === req.kind);
    if (hits.length === 0) return { ...req, status:req.required ? 'HOLD' : 'OPTIONAL_MISSING' };
    const valid = hits.filter(x => x.location && x.revision_or_sha && x.status === 'authoritative');
    if (valid.length === 1) return { ...req, status:'BOUND', pointer:valid[0] };
    if (valid.length > 1) return { ...req, status:'HOLD', reason:'AMBIGUOUS_AUTHORITATIVE_SOURCE', candidates:valid };
    return { ...req, status:req.required ? 'HOLD' : 'REFERENCE_ONLY', candidates:hits };
  });
}
