import { createHash } from 'node:crypto';

const SHA_PATTERN = /^[0-9a-f]{40}$/;

export function releaseAttemptKey({ repository, environment, revision }) {
  return createHash('sha256')
    .update(`${repository}\n${environment}\n${revision}`)
    .digest('hex');
}

export function evaluateReleaseAutomation(manifest, context) {
  const failures = [];
  if (manifest?.schema_version !== 'release-automation-manifest/v1') failures.push('MANIFEST_VERSION_INVALID');
  if (context.repository !== manifest?.repository) failures.push('REPOSITORY_MISMATCH');
  if (!SHA_PATTERN.test(context.revision ?? '')) failures.push('REVISION_INVALID');

  const isPullRequest = context.event === 'pull_request';
  const isCanonicalPush = context.event === 'push'
    && context.ref === `refs/heads/${manifest?.canonical_branch}`;

  if (!isPullRequest && !isCanonicalPush) failures.push('EVENT_NOT_RELEASE_ELIGIBLE');
  const attempt = Number(context.attempt ?? 1);
  if (!Number.isInteger(attempt) || attempt < 1
    || attempt > (manifest?.retry_policy?.max_attempts_per_revision ?? 1)) {
    failures.push('RETRY_LIMIT_EXCEEDED');
  }

  const environment = isPullRequest ? manifest?.preview?.environment : manifest?.production?.environment;
  const target = isPullRequest ? manifest?.preview : manifest?.production;
  const attemptKey = SHA_PATTERN.test(context.revision ?? '') && environment
    ? releaseAttemptKey({ repository: context.repository, environment, revision: context.revision })
    : null;

  if (failures.length) {
    return { status: 'HOLD', phase: 'ADMISSION', environment: environment ?? null, attempt_key: attemptKey, failures };
  }
  if (isPullRequest) {
    return {
      status: 'READY_FOR_CI', phase: 'PREVIEW', environment, attempt_key: attemptKey,
      deploy_authorized: target.enabled === true,
      failures: target.enabled ? [] : ['PREVIEW_PROVIDER_UNCONFIGURED']
    };
  }
  if (target.enabled !== true || target.provider === 'UNCONFIGURED') {
    return {
      status: 'HOLD', phase: 'PRODUCTION', environment, attempt_key: attemptKey,
      deploy_authorized: false, failures: ['PRODUCTION_PROVIDER_UNCONFIGURED']
    };
  }
  const availableSecrets = new Set(context.available_secret_names ?? []);
  const missingSecrets = (target.required_secret_names ?? []).filter(name => !availableSecrets.has(name));
  if (missingSecrets.length) failures.push('REQUIRED_SECRETS_UNAVAILABLE');
  if (manifest.revision_readback?.mode === 'NONE') failures.push('REVISION_READBACK_UNCONFIGURED');
  if (manifest.live_verification?.mode === 'NONE') failures.push('LIVE_VERIFICATION_UNCONFIGURED');
  return {
    status: failures.length ? 'HOLD' : 'READY_FOR_DEPLOY',
    phase: 'PRODUCTION', environment, attempt_key: attemptKey,
    deploy_authorized: failures.length === 0, failures
  };
}
