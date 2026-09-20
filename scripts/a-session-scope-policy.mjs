const SIMPLE = new Set(['repo-rescan']);
const PREFIXED = new Set(['runtime-evidence','migration-gap','routing','coordination']);
const ID = /^[a-z0-9][a-z0-9._-]*$/;

export function parseASessionScope(scope) {
  if (SIMPLE.has(scope)) return { valid:true, family:scope, id:null, canonical:scope };
  if (typeof scope !== 'string') return { valid:false, family:null, id:null, canonical:null };
  const i=scope.indexOf(':');
  if (i <= 0) return { valid:false, family:null, id:null, canonical:null };
  const family=scope.slice(0,i);
  const id=scope.slice(i+1);
  if (!PREFIXED.has(family) || !ID.test(id)) return { valid:false, family:null, id:null, canonical:null };
  return { valid:true, family, id, canonical:`${family}:${id}` };
}

export function aSessionScopesConflict(a, b) {
  const pa=parseASessionScope(a);
  const pb=parseASessionScope(b);
  if (!pa.valid || !pb.valid) return a === b;
  if (pa.canonical === pb.canonical) return true;
  const inspectFamilies=new Set(['repo-rescan','runtime-evidence','migration-gap']);
  if (pa.family === 'repo-rescan' && inspectFamilies.has(pb.family)) return true;
  if (pb.family === 'repo-rescan' && inspectFamilies.has(pa.family)) return true;
  return false;
}

export function isCanonicalASessionScope(scope) {
  return parseASessionScope(scope).valid;
}

export const A_SESSION_SCOPE_POLICY = Object.freeze({
  canonical:[
    'repo-rescan',
    'runtime-evidence:<surface>',
    'migration-gap:<finding-id>',
    'routing:<finding-id>',
    'coordination:<topic>'
  ],
  live_conflict:[
    'same canonical scope always conflicts on the same repository revision',
    'repo-rescan conflicts with runtime-evidence:* and migration-gap:* on the same repository revision',
    'routing:* and coordination:* only conflict with the same exact scope'
  ],
  terminal_coverage:'Completed work suppresses only the same exact canonical scope. Runtime/deployment evidence may legitimately change without a repository revision change.'
});
