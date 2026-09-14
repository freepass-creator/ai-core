import { readFile } from 'node:fs/promises';
import { accessSync, constants } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function includesAll(text, values) {
  return values.every(value => text.includes(value));
}

function requirementSetDigest(requirements = []) {
  const normalized = requirements.map(({ id, text, provenance, status }) => ({ id, text, provenance, status }));
  return `sha256:${createHash('sha256').update(JSON.stringify(normalized)).digest('hex')}`;
}

export function combineChangedFiles(tracked = [], untracked = []) {
  return [...new Set([...tracked, ...untracked].filter(Boolean))];
}

export function validateMainState({ readme, current, researchIndex, selfEvolution, episode, fileExists, revisionExists, changedFiles }) {
  const errors = [];
  const runtimeExists = fileExists('src/cli.mjs') || fileExists('src/core.mjs');

  if (runtimeExists && readme.includes('`main`에는 실행 가능한 오케스트레이터가 없다')) {
    errors.push('README denies an executable orchestrator that exists in the tree');
  }
  if (!runtimeExists && !readme.includes('`main`에는 실행 가능한 오케스트레이터가 없다')) {
    errors.push('README must state that main has no executable orchestrator');
  }
  if (/## 빠른 실행/.test(readme)) {
    errors.push('README must not advertise a quickstart unavailable on main');
  }
  for (const path of ['WORK_READ_FIRST.md', 'MEMORY.md', 'memory/CURRENT.md', 'memory/RESEARCH_INDEX.md']) {
    if (!readme.includes(path) || !fileExists(path)) errors.push(`README entrypoint is missing or unresolved: ${path}`);
  }

  if (!current.includes('PR #1 is the only current implementation line to evaluate')) {
    errors.push('CURRENT must keep PR #1 as the sole implementation evaluation line');
  }
  if (!includesAll(current, ['PR #17', 'PR #18', 'must not be advanced'])) {
    errors.push('CURRENT must defer PR #17 and PR #18');
  }
  if (!current.includes('does not observe these facts itself')) {
    errors.push('CURRENT must not describe PR #19 as an automatic observer');
  }
  if (!current.includes(`Status: \`${episode.status}\``)) {
    errors.push('CURRENT episode status does not match the episode record');
  }
  if (!selfEvolution.includes(`unverified_criteria_count: ${episode.metrics?.unverified_criteria_count}`)) {
    errors.push('self-evolution current decision does not match episode evidence');
  }

  for (const marker of ['#1', '#17', '#18', '#19', 'DEFERRED_CANDIDATE']) {
    if (!researchIndex.includes(marker)) errors.push(`research index is missing ${marker}`);
  }

  if (episode.episode_id !== 'DEV-EPISODE-001') errors.push('episode id must be DEV-EPISODE-001');
  if (episode.status === 'CLOSED' && !revisionExists(episode.execution?.subject_revision)) {
    errors.push('closed episode subject revision does not exist');
  }
  if (episode.status !== 'CLOSED' && episode.execution?.subject_revision !== null) {
    errors.push('open episode must not freeze an incomplete subject revision');
  }
  if (episode.status !== 'CLOSED' && episode.evidence_state?.proof_revision_matches_subject === true) {
    errors.push('open episode must not claim final proof revision alignment');
  }
  const checkCommands = (episode.evidence_state?.commands_run ?? []).filter(command =>
    command === 'git diff --check' || command.startsWith('node --test') ||
    command === 'node scripts/verify-main-state.mjs'
  );
  if (episode.evidence_state?.passes > checkCommands.length) {
    errors.push('pass count includes commands that are not verification checks');
  }
  if (episode.status !== 'CLOSED' && episode.outcome?.post_completion_defects != null) {
    errors.push('open episode must not claim a post-completion defect count');
  }
  if (episode.metrics?.false_completion_events !== episode.evidence_state?.false_completion_events) {
    errors.push('false completion counts disagree');
  }
  if (episode.metrics?.criteria_with_current_evidence > episode.metrics?.acceptance_criteria_total) {
    errors.push('evidenced criteria exceed total criteria');
  }
  if (episode.metrics?.unverified_criteria_count !==
      episode.metrics?.acceptance_criteria_total - episode.metrics?.criteria_with_current_evidence) {
    errors.push('unverified criteria count disagrees with evidence coverage');
  }
  for (const requirement of episode.intent?.requirements ?? []) {
    if (requirement.provenance === 'USER_CONFIRMED' && requirement.id === 'REQ-006') {
      errors.push('implementation mechanism cannot be recorded as user-confirmed intent');
    }
  }
  if (episode.intent?.requirement_set_digest !== requirementSetDigest(episode.intent?.requirements)) {
    errors.push('requirement set digest does not match current requirements');
  }
  const recordedFiles = [...(episode.execution?.changed_files ?? [])].sort();
  const actualFiles = [...changedFiles].sort();
  if (JSON.stringify(recordedFiles) !== JSON.stringify(actualFiles)) {
    errors.push('episode changed files do not match the repository diff');
  }
  if (episode.metrics?.files_touched_count !== recordedFiles.length) {
    errors.push('files touched count does not match changed files');
  }
  if (episode.execution?.rework_loops !== episode.metrics?.rework_loop_count) {
    errors.push('execution and metric rework counts disagree');
  }
  for (const path of episode.execution?.changed_files ?? []) {
    if (!fileExists(path)) errors.push(`episode changed file is missing: ${path}`);
  }

  return errors;
}

export async function verifyRepository(root) {
  const read = path => readFile(resolve(root, path), 'utf8');
  const [readme, current, researchIndex, selfEvolution, episodeText] = await Promise.all([
    read('README.md'), read('memory/CURRENT.md'), read('memory/RESEARCH_INDEX.md'),
    read('docs/SELF_EVOLUTION.md'),
    read('docs/episodes/DEV-EPISODE-001.json')
  ]);
  const fileExists = path => {
    try { accessSync(resolve(root, path), constants.F_OK); return true; } catch { return false; }
  };
  const revisionExists = revision => {
    if (!revision) return false;
    try {
      execFileSync('git', ['cat-file', '-e', `${revision}^{commit}`], { cwd: root, stdio: 'ignore' });
      return true;
    } catch { return false; }
  };
  const episode = JSON.parse(episodeText);
  const diffTarget = episode.execution?.subject_revision || 'HEAD';
  const trackedFiles = execFileSync(
    'git', ['diff', '--name-only', `${episode.project.base_revision}...${diffTarget}`],
    { cwd: root, encoding: 'utf8' }
  ).trim().split(/\r?\n/).filter(Boolean);
  const untrackedFiles = episode.execution?.subject_revision
    ? []
    : execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
      .trim().split(/\r?\n/).filter(Boolean);
  const changedFiles = combineChangedFiles(trackedFiles, untrackedFiles);
  return validateMainState({
    readme, current, researchIndex, selfEvolution, episode, fileExists, revisionExists, changedFiles
  });
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const errors = await verifyRepository(root);
  if (errors.length) {
    for (const error of errors) console.error(`FAIL: ${error}`);
    process.exitCode = 1;
  } else {
    console.log('PASS: main documentation, episode evidence and implementation lineage agree');
  }
}
