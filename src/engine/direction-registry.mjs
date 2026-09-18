const need = (condition, code) => { if (!condition) throw new Error(code); };
const nonempty = value => typeof value === 'string' && value.trim() === value && value.length > 0;

export function validateDirectionRegistrySemantics(registry) {
  need(registry?.schema_version === '1.0' && Array.isArray(registry.방향), 'DIRECTION_REGISTRY_INVALID');
  const ids = registry.방향.map(item => item?.id);
  need(ids.every(nonempty) && new Set(ids).size === ids.length, 'DIRECTION_ID_DUPLICATE_OR_INVALID');

  for (const direction of registry.방향) {
    const author = nonempty(direction.세운이);
    const started = nonempty(direction.세운때);
    const expires = nonempty(direction.만료);
    const activationFields = [author, started, expires];
    const active = activationFields.every(Boolean);
    const draft = activationFields.every(value => !value);
    need(active || draft, 'DIRECTION_ACTIVATION_PARTIAL');
    need(direction.적용 && typeof direction.적용 === 'object' && Object.keys(direction.적용).length > 0, 'DIRECTION_MATCH_EMPTY');
    need(Array.isArray(direction.허가?.scope) && direction.허가.scope.length > 0, 'DIRECTION_SCOPE_EMPTY');
    need(new Set(direction.허가.scope).size === direction.허가.scope.length, 'DIRECTION_SCOPE_DUPLICATE');
    need(Array.isArray(direction.벽) && new Set(direction.벽).size === direction.벽.length, 'DIRECTION_WALL_DUPLICATE');
    for (const wall of direction.벽) need(!direction.허가.scope.includes(wall), 'DIRECTION_SCOPE_CROSSES_WALL');
    if (active) {
      need(direction.승인근거 && nonempty(direction.승인근거.원장사건), 'DIRECTION_APPROVAL_EVIDENCE_REQUIRED');
      need(Date.parse(direction.세운때) < Date.parse(direction.만료), 'DIRECTION_WINDOW_INVALID');
    }
  }
  return {
    status: 'VALID',
    count: registry.방향.length,
    active: registry.방향.filter(item => nonempty(item.세운이)).length,
    draft: registry.방향.filter(item => !nonempty(item.세운이)).length,
  };
}
