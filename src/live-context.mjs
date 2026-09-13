import { normalizeTask, capabilityPlan, orchestrate } from './core.mjs';
import { resolveSourceRequirements } from './source-resolver.mjs';
import { resolveCapabilities } from './capability-resolver.mjs';
import {
  DEFAULT_OWNER,
  DEFAULT_SOURCE_MAP,
  buildFetchManifest,
  projectRepository,
  toResolvedPointer
} from './github-source-map.mjs';

function safeErrorCode(error) {
  return typeof error?.code === 'string' ? error.code : 'FETCH_FAILED';
}

async function fetchManifestEntry(item, fetchFile) {
  const evidence = {
    system: item.system,
    kind: item.kind,
    required: item.required,
    repo: item.repo ?? null,
    attempts: []
  };

  if (item.status !== 'FETCH_REQUIRED') {
    evidence.outcome = item.status;
    return {
      pointer: toResolvedPointer(item, { reason: item.reason ?? item.status }),
      evidence,
      content: null
    };
  }

  const paths = item.path ? [item.path] : (item.candidates ?? []);
  for (const path of paths) {
    try {
      const fetched = await fetchFile({ repo: item.repo, path, ref: item.ref ?? 'main' });
      if (!fetched?.sha) {
        evidence.attempts.push({ path, outcome: 'REVISION_MISSING' });
        continue;
      }
      evidence.attempts.push({ path, outcome: 'FETCHED', sha: fetched.sha });
      evidence.outcome = 'FETCHED';
      evidence.path = path;
      evidence.sha = fetched.sha;
      return {
        pointer: toResolvedPointer({ ...item, path }, fetched),
        evidence,
        content: fetched.content
      };
    } catch (error) {
      const code = safeErrorCode(error);
      evidence.attempts.push({ path, outcome: code });
      if (code !== 'NOT_FOUND') {
        evidence.outcome = code;
        return {
          pointer: toResolvedPointer({ ...item, path }, { reason: code }),
          evidence,
          content: null
        };
      }
    }
  }

  evidence.outcome = 'NOT_FOUND';
  return {
    pointer: toResolvedPointer(item, { reason: 'NOT_FOUND' }),
    evidence,
    content: null
  };
}

export function parseCapabilityLocator(locator, owner = DEFAULT_OWNER) {
  const parts = String(locator ?? '').split('/').filter(Boolean);
  if (parts.length < 2) return null;

  if (parts[0] === owner && parts.length >= 3) {
    return { repo: `${parts[0]}/${parts[1]}`, path: parts.slice(2).join('/') };
  }
  return { repo: `${owner}/${parts[0]}`, path: parts.slice(1).join('/') };
}

function capabilityKey(asset) {
  return asset?.id ?? `${asset?.scope}:${asset?.source?.locator}`;
}

async function pinCapability(binding, fetchFile, owner) {
  const asset = binding.asset;
  const evidence = {
    scope: binding.scope,
    asset_id: asset?.id ?? null,
    locator: asset?.source?.locator ?? null
  };

  if (binding.status === 'RESOLVED') {
    evidence.outcome = 'ALREADY_PINNED';
    return { binding, evidence, asset };
  }
  if (binding.status !== 'SELECTED') {
    evidence.outcome = binding.status;
    return { binding, evidence, asset: null };
  }

  const target = parseCapabilityLocator(asset?.source?.locator, owner);
  if (!target) {
    evidence.outcome = 'INVALID_LOCATOR';
    return {
      binding: { ...binding, status: 'HOLD', reason: 'INVALID_CAPABILITY_LOCATOR' },
      evidence,
      asset: null
    };
  }

  evidence.repo = target.repo;
  evidence.path = target.path;
  try {
    const fetched = await fetchFile({ repo: target.repo, path: target.path, ref: 'main' });
    if (!fetched?.sha) throw Object.assign(new Error('revision missing'), { code: 'REVISION_MISSING' });

    const pinned = {
      ...asset,
      source: {
        ...asset.source,
        location: `${target.repo}:${target.path}`,
        revision_or_sha: fetched.sha,
        revision_kind: fetched.revision_kind ?? 'git_blob_sha'
      }
    };
    evidence.outcome = 'FETCHED';
    evidence.sha = fetched.sha;
    return {
      binding: { scope: binding.scope, status: 'RESOLVED', asset: pinned },
      evidence,
      asset: pinned
    };
  } catch (error) {
    const code = safeErrorCode(error);
    evidence.outcome = code;
    return {
      binding: { ...binding, status: 'HOLD', reason: `CAPABILITY_${code}` },
      evidence,
      asset: null
    };
  }
}

export async function bootstrapLiveContext(input, {
  fetchFile,
  fetchRevision,
  sourceMap = DEFAULT_SOURCE_MAP,
  owner = DEFAULT_OWNER
} = {}) {
  if (typeof fetchFile !== 'function') throw new Error('fetchFile is required');

  const task = normalizeTask(input);
  const requirements = resolveSourceRequirements(task);
  let subjectRevision = null;
  const subjectRevisionEvidence = {
    repo: task.project ? projectRepository(task.project, owner) : null,
    ref: task.project_ref,
    outcome: task.project ? 'REVISION_FETCHER_MISSING' : 'NOT_APPLICABLE'
  };
  if (task.project && typeof fetchRevision === 'function') {
    try {
      const fetchedRevision = await fetchRevision({
        repo: subjectRevisionEvidence.repo,
        ref: task.project_ref
      });
      subjectRevision = fetchedRevision?.sha ?? null;
      subjectRevisionEvidence.outcome = subjectRevision ? 'FETCHED' : 'REVISION_MISSING';
      subjectRevisionEvidence.sha = subjectRevision;
    } catch (error) {
      subjectRevisionEvidence.outcome = safeErrorCode(error);
    }
  }
  const manifest = buildFetchManifest(task, requirements, sourceMap).map(item => (
    item.system === 'project' && subjectRevision ? { ...item, ref: subjectRevision } : item
  ));
  const sourceResults = await Promise.all(
    manifest.map(item => fetchManifestEntry(item, fetchFile))
  );

  const registryResult = sourceResults.find(result => (
    result.pointer.system === 'devcenter' && result.pointer.kind === 'registry'
  ));
  let registry = null;
  if (registryResult?.pointer.status === 'authoritative') {
    try {
      registry = JSON.parse(registryResult.content);
      if (!Array.isArray(registry?.datasets)) throw new Error('datasets missing');
    } catch {
      registryResult.pointer = {
        ...registryResult.pointer,
        status: 'unresolved',
        reason: 'INVALID_REGISTRY_JSON'
      };
      registryResult.evidence.outcome = 'INVALID_REGISTRY_JSON';
      registry = null;
    }
  }

  const requestedScopes = capabilityPlan(task);
  const initialCapabilityBindings = registry
    ? resolveCapabilities(requestedScopes, registry)
    : requestedScopes.map(scope => ({ scope, status: 'RESOLVE_REQUIRED' }));
  const capabilityResults = await Promise.all(
    initialCapabilityBindings.map(binding => pinCapability(binding, fetchFile, owner))
  );
  const pinnedAssets = new Map(
    capabilityResults
      .filter(result => result.asset)
      .map(result => [capabilityKey(result.asset), result.asset])
  );
  const enrichedRegistry = registry
    ? {
        ...registry,
        datasets: registry.datasets.map(asset => pinnedAssets.get(capabilityKey(asset)) ?? asset)
      }
    : null;
  const resolvedSources = sourceResults
    .map(result => result.pointer)
    .filter(pointer => pointer.status === 'authoritative');
  const capabilityRefs = capabilityResults
    .filter(result => result.binding.status === 'RESOLVED')
    .map(result => ({
      scope: result.binding.scope,
      asset_id: result.binding.asset.id,
      status: result.binding.asset.role,
      location: result.binding.asset.source.location,
      revision_or_sha: result.binding.asset.source.revision_or_sha,
      revision_kind: result.binding.asset.source.revision_kind
    }));
  const requiredSourceHold = sourceResults.some(result => (
    result.pointer.required && result.pointer.status !== 'authoritative'
  ));
  const capabilityHold = capabilityResults.some(result => result.binding.status !== 'RESOLVED');
  const subjectRevisionHold = Boolean(task.project && !subjectRevision);

  return {
    task,
    status: requiredSourceHold || capabilityHold || subjectRevisionHold ? 'HOLD' : 'RESOLVED',
    environment: {
      subject_revision: subjectRevision,
      resolved_sources: resolvedSources,
      devcenter_registry: enrichedRegistry,
      capability_refs: capabilityRefs
    },
    source_fetch_evidence: sourceResults.map(result => result.evidence),
    capability_fetch_evidence: capabilityResults.map(result => result.evidence),
    subject_revision_evidence: subjectRevisionEvidence
  };
}

export async function orchestrateLive(input, options) {
  const bootstrap = await bootstrapLiveContext(input, options);
  const result = orchestrate(bootstrap.task, bootstrap.environment);
  return {
    ...result,
    live_context: {
      status: bootstrap.status,
      subject_revision_evidence: bootstrap.subject_revision_evidence,
      source_fetch_evidence: bootstrap.source_fetch_evidence,
      capability_fetch_evidence: bootstrap.capability_fetch_evidence
    }
  };
}
