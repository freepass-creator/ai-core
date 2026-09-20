import { spawnSync } from 'node:child_process';

export function projectFor(manifest, projectId) {
  const matches = manifest.projects.filter((project) => project.project_id === projectId);
  if (matches.length !== 1) throw new Error(`RELEASE_PROJECT_${matches.length === 0 ? 'NOT_FOUND' : 'DUPLICATE'}:${projectId}`);
  return matches[0];
}

export function missingEnvironment(project, env = process.env) {
  return project.production.required_env.filter((name) => !env[name]);
}

export function initialDecision(project, { expectedRevision, repository, ref, runAttempt = 1, env = process.env }) {
  if (!/^[0-9a-f]{40}$/i.test(expectedRevision || '')) return { result: 'HOLD', code: 'HOLD_EXPECTED_REVISION_INVALID' };
  if (repository !== project.repository) return { result: 'HOLD', code: 'HOLD_REPOSITORY_MISMATCH' };
  if (ref !== `refs/heads/${project.default_branch}`) return { result: 'HOLD', code: 'HOLD_DEFAULT_BRANCH_REQUIRED' };
  if (!project.production.enabled) return { result: 'HOLD', code: 'HOLD_DEPLOY_TARGET_UNCONFIGURED' };
  if (!project.rollback.available || !project.rollback.plan_ref) return { result: 'HOLD', code: 'HOLD_ROLLBACK_UNCONFIGURED' };
  const missing = missingEnvironment(project, env);
  if (missing.length) return { result: 'HOLD', code: 'HOLD_REQUIRED_ENV_MISSING', missing_env: missing };
  if (Number(runAttempt) > project.production.max_run_attempt) return { result: 'HOLD', code: 'HOLD_RETRY_LIMIT' };
  return { result: 'READY', code: 'READY_FOR_DEPLOY' };
}

export function deployDecisionFromObservation(observation) {
  if (observation.result === 'VERIFIED') return { result: 'VERIFIED', code: 'SKIP_ALREADY_DEPLOYED', deploy: false };
  if (observation.code === 'HOLD_PRODUCTION_REVISION_MISMATCH' && observation.observed_revision) {
    return { result: 'READY', code: 'READY_REVISION_DRIFT_CONFIRMED', deploy: true };
  }
  return { result: 'HOLD', code: observation.code, deploy: false };
}

export function githubDeploymentContext(env, expectedRevision) {
  const required = ['GITHUB_ACTIONS', 'GITHUB_EVENT_NAME', 'GITHUB_REPOSITORY', 'GITHUB_REF', 'GITHUB_SHA', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT'];
  const missing = required.filter((name) => !env[name]);
  if (missing.length) return { ok: false, code: 'HOLD_GITHUB_CONTEXT_MISSING', missing };
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_EVENT_NAME !== 'push') return { ok: false, code: 'HOLD_GITHUB_PUSH_CONTEXT_REQUIRED', missing: [] };
  if (env.GITHUB_SHA !== expectedRevision) return { ok: false, code: 'HOLD_GITHUB_SHA_MISMATCH', missing: [] };
  return { ok: true, code: 'GITHUB_CONTEXT_VERIFIED', missing: [] };
}

function fieldValue(value, field) {
  if (!field) return value;
  return field.split('.').reduce((current, key) => current?.[key], value);
}

export async function observe(project, expectedRevision, fetchImpl = fetch) {
  const probe = project.production.revision_probe;
  if (!probe) return { result: 'HOLD', code: 'HOLD_REVISION_PROBE_UNCONFIGURED', observed_revision: null, smoke: [] };
  try {
    const response = await fetchImpl(probe.url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    if (!response.ok) return { result: 'HOLD', code: `HOLD_REVISION_HTTP_${response.status}`, observed_revision: null, smoke: [] };
    const body = probe.format === 'JSON' ? await response.json() : (await response.text()).trim();
    const observed = String(fieldValue(body, probe.field) ?? '').trim();
    if (observed !== expectedRevision) return { result: 'HOLD', code: 'HOLD_PRODUCTION_REVISION_MISMATCH', observed_revision: observed || null, smoke: [] };
    const smoke = [];
    for (const url of project.production.smoke_urls) {
      const check = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
      smoke.push({ url, status: check.status, ok: check.ok });
      if (!check.ok) return { result: 'HOLD', code: 'HOLD_RUNTIME_SMOKE_FAILED', observed_revision: observed, smoke };
    }
    return { result: 'VERIFIED', code: 'PRODUCTION_REVISION_VERIFIED', observed_revision: observed, smoke };
  } catch (error) {
    return { result: 'HOLD', code: 'HOLD_PRODUCTION_OBSERVATION_FAILED', observed_revision: null, smoke: [], error: error.message };
  }
}

export function runCommand(command, options = {}) {
  const [file, ...args] = command;
  const result = spawnSync(file, args, { cwd: options.cwd, env: options.env || process.env, encoding: 'utf8', shell: false, stdio: 'inherit' });
  if (result.error) return { ok: false, error: result.error.message, status: null };
  return { ok: result.status === 0, status: result.status };
}

export function statusRecord({ project, expectedRevision, decision, observation = null, phase, run }) {
  return {
    schema_version: 'release-status/v1',
    project_id: project.project_id,
    repository: project.repository,
    platform: project.platform,
    phase,
    expected_revision: expectedRevision,
    result: decision.result,
    code: decision.code,
    observed_revision: observation?.observed_revision ?? null,
    smoke: observation?.smoke ?? [],
    rollback_plan_ref: project.rollback.plan_ref,
    run,
    observed_at: new Date().toISOString(),
    limitations: decision.missing_env ? [`Missing environment names: ${decision.missing_env.join(', ')}`] : []
  };
}

export function governanceProof({ project, expectedRevision, decision, observation = null, run }) {
  const verified = decision.result === 'VERIFIED';
  const deployFailed = decision.code === 'FAILED_DEPLOY_COMMAND';
  return {
    schema_version: 'governance-release-proof/v1',
    project_id: project.project_id,
    environment: 'PRODUCTION',
    expected_revision: expectedRevision,
    build_status: 'PASS',
    deployment: {
      status: verified ? 'READY' : deployFailed ? 'FAILED' : 'UNKNOWN',
      deployment_id: run.id,
      deployment_url: run.url
    },
    production_observation: {
      reachable: Boolean(observation?.observed_revision),
      target_urls: project.production.revision_probe ? [project.production.revision_probe.url, ...project.production.smoke_urls] : ['UNCONFIGURED'],
      observed_revision: observation?.observed_revision ?? null
    },
    runtime_smoke: {
      status: verified ? 'PASS' : observation?.code === 'HOLD_RUNTIME_SMOKE_FAILED' ? 'FAIL' : 'UNKNOWN',
      evidence_refs: observation?.smoke?.map((item) => `${item.url} status=${item.status}`) ?? []
    },
    rollback: {
      available: project.rollback.available,
      plan_ref: project.rollback.plan_ref,
      previous_revision: null
    },
    result: verified ? 'VERIFIED' : deployFailed ? 'FAILED' : 'HOLD',
    observed_at: new Date().toISOString(),
    limitations: [decision.code]
  };
}
