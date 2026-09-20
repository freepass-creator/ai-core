#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { deployDecisionFromObservation, githubDeploymentContext, governanceProof, initialDecision, observe, projectFor, runCommand, statusRecord } from '../src/release/release-control.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, '$1')), '..');
const action = process.argv[2] || 'validate';
const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const manifestPath = path.resolve(root, arg('manifest', 'registry/releases.json'));
const statusDir = path.resolve(root, arg('status-dir', '.local/release-status'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const schema = JSON.parse(fs.readFileSync(path.join(root, 'contracts/release-manifest-registry.schema.json'), 'utf8'));
const proofSchema = JSON.parse(fs.readFileSync(path.join(root, 'contracts/governance-release-proof.schema.json'), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const validateProof = ajv.compile(proofSchema);
if (!validate(manifest)) {
  console.error(JSON.stringify(validate.errors, null, 2));
  process.exit(1);
}
const ids = manifest.projects.map((project) => project.project_id);
if (new Set(ids).size !== ids.length) throw new Error('RELEASE_PROJECT_IDS_NOT_UNIQUE');
for (const project of manifest.projects) {
  const p = project.production;
  if (p.enabled && (!p.deploy_command || !p.revision_probe || p.smoke_urls.length === 0)) throw new Error(`RELEASE_ENABLED_PROJECT_INCOMPLETE:${project.project_id}`);
  if (!p.enabled && (!p.reason || p.deploy_command || p.revision_probe)) throw new Error(`RELEASE_DISABLED_PROJECT_INVALID:${project.project_id}`);
  if (project.platform === 'NONE' && p.enabled) throw new Error(`RELEASE_PLATFORM_NONE_ENABLED:${project.project_id}`);
}
if (action === 'validate') {
  console.log(`release manifest valid: ${manifest.projects.length} project(s)`);
  process.exit(0);
}

const project = projectFor(manifest, arg('project', process.env.RELEASE_PROJECT_ID || 'ai-core'));
const expectedRevision = arg('sha', process.env.GITHUB_SHA || '');
if (action === 'deploy') {
  const context = githubDeploymentContext(process.env, expectedRevision);
  if (!context.ok) {
    console.error(`${context.code}${context.missing.length ? `:${context.missing.join(',')}` : ''}`);
    process.exit(1);
  }
}
const phase = action === 'deploy' ? 'PRODUCTION' : 'PLAN';
const run = {
  id: process.env.GITHUB_RUN_ID || null,
  attempt: Number(process.env.GITHUB_RUN_ATTEMPT || 1),
  url: process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null
};
let decision = initialDecision(project, {
  expectedRevision,
  repository: action === 'deploy' ? process.env.GITHUB_REPOSITORY : (process.env.GITHUB_REPOSITORY || project.repository),
  ref: action === 'deploy' ? process.env.GITHUB_REF : (process.env.GITHUB_REF || `refs/heads/${project.default_branch}`),
  runAttempt: run.attempt,
  env: process.env
});
let observation = null;

if (decision.result === 'READY') {
  observation = await observe(project, expectedRevision);
  const observedDecision = deployDecisionFromObservation(observation);
  decision = { result: observedDecision.result, code: observedDecision.code };
  if (observedDecision.deploy && action === 'deploy') {
    const deployed = runCommand(project.production.deploy_command, { cwd: root });
    if (!deployed.ok) decision = { result: 'FAILED', code: 'FAILED_DEPLOY_COMMAND' };
    else {
      observation = await observe(project, expectedRevision);
      decision = observation.result === 'VERIFIED'
        ? { result: 'VERIFIED', code: 'DEPLOYED_AND_VERIFIED' }
        : { result: 'HOLD', code: observation.code };
    }
  }
}

const record = statusRecord({ project, expectedRevision, decision, observation, phase, run });
const proof = governanceProof({ project, expectedRevision, decision, observation, run });
if (!validateProof(proof)) {
  console.error(JSON.stringify(validateProof.errors, null, 2));
  process.exit(1);
}
fs.mkdirSync(statusDir, { recursive: true });
const file = path.join(statusDir, `${project.project_id}-${expectedRevision || 'unknown'}.json`);
const proofFile = path.join(statusDir, `${project.project_id}-${expectedRevision || 'unknown'}.proof.json`);
fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
fs.writeFileSync(proofFile, `${JSON.stringify(proof, null, 2)}\n`);
console.log(JSON.stringify(record, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Release ${record.result}\n\n- Code: \`${record.code}\`\n- Expected: \`${record.expected_revision}\`\n- Observed: \`${record.observed_revision || 'UNKNOWN'}\`\n- Status artifact: \`${path.relative(root, file)}\`\n`);
if (decision.result === 'FAILED' || (action === 'deploy' && decision.result === 'HOLD')) process.exit(1);
