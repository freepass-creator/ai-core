import crypto from 'node:crypto';

function sha256(value) {
  return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex');
}

function assertInput(input) {
  const roles = new Set(['SOURCE','CHECKER','FIXTURE','CONFIG','SCHEMA','DEPENDENCY','OTHER']);
  if (!input || !roles.has(input.role)) throw new Error('PROOF_INPUT_ROLE_INVALID');
  if (typeof input.ref !== 'string' || !input.ref.trim()) throw new Error('PROOF_INPUT_REF_INVALID');
  if (!/^sha256:[0-9a-f]{64}$/.test(input.digest ?? '')) throw new Error('PROOF_INPUT_DIGEST_INVALID');
  if (input.revision != null && (typeof input.revision !== 'string' || !input.revision)) throw new Error('PROOF_INPUT_REVISION_INVALID');
}

export function canonicalizeProofInputs(inputs) {
  if (!Array.isArray(inputs) || inputs.length === 0) throw new Error('PROOF_INPUTS_REQUIRED');
  const seen = new Set();
  const normalized = inputs.map((input) => {
    assertInput(input);
    const item = { role: input.role, ref: input.ref, digest: input.digest, revision: input.revision ?? null };
    const key = item.role + '::' + item.ref;
    if (seen.has(key)) throw new Error('PROOF_INPUT_DUPLICATE:' + key);
    seen.add(key);
    return item;
  });
  normalized.sort((a,b) => a.role.localeCompare(b.role) || a.ref.localeCompare(b.ref));
  return normalized;
}

export function proofInputSetDigest(inputs) {
  return sha256(JSON.stringify(canonicalizeProofInputs(inputs)));
}

export function buildProofInputBinding(inputs) {
  const normalized = canonicalizeProofInputs(inputs);
  return {
    schema_version:'core-proof-input-binding/v1',
    algorithm:'CANONICAL_SHA256_V1',
    inputs:normalized,
    input_set_digest:sha256(JSON.stringify(normalized))
  };
}

export function verifyProofInputBinding(binding, currentInputs) {
  if (binding?.schema_version !== 'core-proof-input-binding/v1' || binding?.algorithm !== 'CANONICAL_SHA256_V1') {
    throw new Error('PROOF_INPUT_BINDING_INVALID');
  }
  const boundInputs = canonicalizeProofInputs(binding.inputs);
  const expectedDigest = sha256(JSON.stringify(boundInputs));
  if (expectedDigest !== binding.input_set_digest) {
    return { status:'INVALID', reason:'BINDING_DIGEST_MISMATCH', expected_digest:expectedDigest, actual_digest:binding.input_set_digest, changes:[] };
  }
  const current = canonicalizeProofInputs(currentInputs);
  const currentDigest = sha256(JSON.stringify(current));
  const before = new Map(boundInputs.map(x=>[x.role+'::'+x.ref,x]));
  const after = new Map(current.map(x=>[x.role+'::'+x.ref,x]));
  const keys = [...new Set([...before.keys(),...after.keys()])].sort();
  const changes=[];
  for (const key of keys) {
    const a=before.get(key), b=after.get(key);
    if (!a) changes.push({key,kind:'ADDED',before:null,after:b});
    else if (!b) changes.push({key,kind:'REMOVED',before:a,after:null});
    else if (a.digest!==b.digest || a.revision!==b.revision) changes.push({key,kind:'CHANGED',before:a,after:b});
  }
  return {
    status: currentDigest === binding.input_set_digest ? 'CURRENT' : 'STALE',
    reason: currentDigest === binding.input_set_digest ? null : 'PROOF_INPUTS_CHANGED',
    expected_digest: binding.input_set_digest,
    actual_digest: currentDigest,
    changes
  };
}
