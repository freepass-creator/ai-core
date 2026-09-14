import { readFile } from 'node:fs/promises';
import { accessSync, constants } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function includesAll(text, values) {
  return values.every(value => text.includes(value));
}

export function validateMainState({ readme, current, researchIndex, episode, fileExists, revisionExists }) {
  const errors = [];

  if (!readme.includes('`main`에는 실행 가능한 오케스트레이터가 없다')) {
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

  for (const marker of ['#1', '#17', '#18', '#19', 'DEFERRED_CANDIDATE']) {
    if (!researchIndex.includes(marker)) errors.push(`research index is missing ${marker}`);
  }

  if (episode.episode_id !== 'DEV-EPISODE-001') errors.push('episode id must be DEV-EPISODE-001');
  if (!revisionExists(episode.execution?.subject_revision)) errors.push('episode subject revision does not exist');
  if (episode.metrics?.false_completion_events !== episode.evidence_state?.false_completion_events) {
    errors.push('false completion counts disagree');
  }
  if (episode.metrics?.criteria_with_current_evidence > episode.metrics?.acceptance_criteria_total) {
    errors.push('evidenced criteria exceed total criteria');
  }
  for (const path of episode.execution?.changed_files ?? []) {
    if (!fileExists(path)) errors.push(`episode changed file is missing: ${path}`);
  }

  return errors;
}

export async function verifyRepository(root) {
  const read = path => readFile(resolve(root, path), 'utf8');
  const [readme, current, researchIndex, episodeText] = await Promise.all([
    read('README.md'), read('memory/CURRENT.md'), read('memory/RESEARCH_INDEX.md'),
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
  return validateMainState({
    readme, current, researchIndex, episode: JSON.parse(episodeText), fileExists, revisionExists
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
