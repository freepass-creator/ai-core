const LANE_IDS = ['A', 'B', 'C', 'D'];
const LANE_STATUS = new Set(['PASS', 'REVIEW', 'HOLD']);
const CLOSEOUT_STATUS = new Set(['HOLD', 'READY_FOR_BASELINE_LOCK', 'BASELINE_LOCKED']);
const SHA40 = /^[0-9a-f]{40}$/;

export function evaluatePhase1Closeout(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { valid: false, lockable: false, errors: ['manifest must be an object'] };
  }
  if (manifest.schema_version !== '1.0') errors.push('schema_version must be 1.0');
  if (manifest.phase !== 'PHASE_1') errors.push('phase must be PHASE_1');
  if (!CLOSEOUT_STATUS.has(manifest.status)) errors.push('invalid closeout status');
  if (!SHA40.test(manifest.observed_revision ?? '')) errors.push('observed_revision must be a 40-char lowercase git SHA');

  const ci = manifest.ci ?? {};
  if (!SHA40.test(ci.head_sha ?? '')) errors.push('ci.head_sha must be a 40-char lowercase git SHA');
  if (!['success', 'failure', 'unknown'].includes(ci.conclusion)) errors.push('invalid ci conclusion');

  const lanes = Array.isArray(manifest.lanes) ? manifest.lanes : [];
  const ids = lanes.map(lane => lane?.id);
  if (lanes.length !== 4 || new Set(ids).size !== 4 || !LANE_IDS.every(id => ids.includes(id))) {
    errors.push('lanes must contain A, B, C and D exactly once');
  }
  for (const lane of lanes) {
    if (!LANE_STATUS.has(lane?.status)) errors.push(`invalid lane status: ${lane?.id ?? 'UNKNOWN'}`);
    if (lane?.status === 'PASS' && (lane.blockers?.length ?? 0) > 0) errors.push(`PASS lane has blockers: ${lane.id}`);
    if (lane?.status === 'PASS' && (lane.evidence?.length ?? 0) === 0) errors.push(`PASS lane has no evidence: ${lane.id}`);
  }

  const gates = manifest.gates ?? {};
  const gateNames = [
    'ownership_linked',
    'executable_baseline',
    'registry_linkage',
    'revision_evidence',
    'validation_green',
    'no_false_completion'
  ];
  for (const name of gateNames) if (typeof gates[name] !== 'boolean') errors.push(`gate must be boolean: ${name}`);

  const allLanesPass = lanes.length === 4 && lanes.every(lane => lane.status === 'PASS');
  const allGatesPass = gateNames.every(name => gates[name] === true);
  const ciGreen = ci.conclusion === 'success' && ci.head_sha === manifest.observed_revision;
  const lockable = errors.length === 0 && allLanesPass && allGatesPass && ciGreen;

  if (manifest.status === 'BASELINE_LOCKED' && !lockable) {
    errors.push('BASELINE_LOCKED requires all lanes PASS, all gates true, and green CI at observed_revision');
  }
  if (manifest.status === 'READY_FOR_BASELINE_LOCK' && !(allLanesPass && allGatesPass)) {
    errors.push('READY_FOR_BASELINE_LOCK requires all lanes PASS and all gates true');
  }

  return { valid: errors.length === 0, lockable, errors };
}
