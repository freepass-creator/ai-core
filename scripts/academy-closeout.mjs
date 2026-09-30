import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildEpisodeFeedback } from '../src/academy/episode-feedback.mjs';

const REQUIRED_FIELDS = [
  '목적',
  '대상 revision',
  '변경',
  '검증',
  '남음',
  '사용자 수정',
  '재작업',
  'false completion',
  '학습환류',
  'next_start_here'
];

function parseCount(value, field, problems) {
  if (!/^\d+$/.test(value ?? '')) {
    problems.push(`WORK_RESULT_${field.replaceAll(' ', '_').toUpperCase()}_INVALID`);
    return null;
  }
  return Number(value);
}

export function parseWorkResult(markdown) {
  if (typeof markdown !== 'string' || !markdown.trim()) throw new TypeError('work result markdown required');
  const fields = {};
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^- ([^:]+):\s*(.*)$/);
    if (match) fields[match[1].trim()] = match[2].trim();
  }

  const problems = [];
  for (const key of REQUIRED_FIELDS) if (!(key in fields)) problems.push(`WORK_RESULT_${key.replaceAll(' ', '_').toUpperCase()}_MISSING`);
  for (const key of ['목적', '대상 revision', '변경', '검증', '남음', 'next_start_here']) {
    if (key in fields && !fields[key]) problems.push(`WORK_RESULT_${key.replaceAll(' ', '_').toUpperCase()}_EMPTY`);
  }

  const userCorrections = parseCount(fields['사용자 수정'], '사용자 수정', problems);
  const rework = parseCount(fields['재작업'], '재작업', problems);
  const falseCompletion = parseCount(fields['false completion'], 'false completion', problems);
  const learning = fields['학습환류'];
  if (learning !== 'NONE' && learning !== 'EPISODE') problems.push('WORK_RESULT_LEARNING_MODE_INVALID');

  return {
    fields,
    problems: [...new Set(problems)],
    counts: {
      user_correction_count: userCorrections,
      rework_loop_count: rework,
      false_completion_events: falseCompletion
    },
    learning
  };
}

export function academyCloseout({ workResultMarkdown, episode = null }) {
  const work = parseWorkResult(workResultMarkdown);
  const problems = [...work.problems];
  const observedLearningEvent = Object.values(work.counts).some(value => Number.isInteger(value) && value > 0);

  if (observedLearningEvent && work.learning !== 'EPISODE') problems.push('LEARNING_EPISODE_REQUIRED');
  if (work.learning === 'EPISODE' && !episode) problems.push('LEARNING_EPISODE_MISSING');

  let feedback = null;
  if (episode) {
    feedback = buildEpisodeFeedback(episode);
    if (work.fields['대상 revision'] && episode.execution?.subject_revision &&
        work.fields['대상 revision'] !== episode.execution.subject_revision) {
      problems.push('WORK_RESULT_EPISODE_REVISION_MISMATCH');
    }
    if (feedback.feedback_status !== 'READY') problems.push('EPISODE_FEEDBACK_HOLD');
  }

  return {
    schema: 'ai-core-academy-closeout/v1',
    status: problems.length ? 'HOLD' : 'READY',
    work_result: {
      purpose: work.fields['목적'] ?? null,
      subject_revision: work.fields['대상 revision'] ?? null,
      verification: work.fields['검증'] ?? null,
      remaining: work.fields['남음'] ?? null,
      next_start_here: work.fields['next_start_here'] ?? null,
      counts: work.counts,
      learning: work.learning ?? null
    },
    feedback,
    blockers: [...new Set(problems)],
    auto_adopted: false,
    execution_authorized: false
  };
}

async function readText(path) {
  return readFile(resolve(path), 'utf8');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let workResultPath = null;
  let episodePath = null;
  let invalid = false;
  for (let i = 0; i < args.length; i += 1) {
    const value = args[i + 1];
    if (args[i] === '--work-result' && value && !value.startsWith('--') && !workResultPath) {
      workResultPath = value; i += 1;
    } else if (args[i] === '--episode' && value && !value.startsWith('--') && !episodePath) {
      episodePath = value; i += 1;
    } else invalid = true;
  }

  if (invalid || !workResultPath) {
    console.error('Usage: node scripts/academy-closeout.mjs --work-result <WORK_RESULT.md> [--episode <episode.json>]');
    process.exitCode = 2;
  } else {
    try {
      const workResultMarkdown = await readText(workResultPath);
      const episode = episodePath ? JSON.parse(await readText(episodePath)) : null;
      const result = academyCloseout({ workResultMarkdown, episode });
      console.log(JSON.stringify(result, null, 2));
      if (result.status !== 'READY') process.exitCode = 2;
    } catch {
      console.error('Academy closeout could not be evaluated from the supplied files.');
      process.exitCode = 2;
    }
  }
}
