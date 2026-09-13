import fs from 'node:fs';
import { orchestrate } from './core.mjs';
import {
  createGitHubContentsFetcher,
  createGitHubRevisionFetcher
} from './github-client.mjs';
import { orchestrateLive } from './live-context.mjs';
import { normalizeHumanContextEnvironment } from './human-orchestrator.mjs';

const args = process.argv.slice(2);
const live = args.includes('--live');
const file = args.find(argument => argument !== '--live');

if (!file) {
  console.error('usage: node src/cli.mjs [--live] <task.json>');
  process.exit(2);
}

try {
  const document = JSON.parse(fs.readFileSync(file, 'utf8'));
  const envelopeMode = document?.task != null;
  const input = envelopeMode ? document.task : document;
  const humanContext = normalizeHumanContextEnvironment(
    envelopeMode ? (document.human_context ?? {}) : {}
  );
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('task input must be an object');
  }
  let output;
  if (live) {
    const token = process.env.AI_CORE_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;
    if (!token) throw new Error('live mode requires AI_CORE_GITHUB_TOKEN or GITHUB_TOKEN');
    output = await orchestrateLive(input, {
      fetchFile: createGitHubContentsFetcher({ token }),
      fetchRevision: createGitHubRevisionFetcher({ token }),
      humanContext
    });
  } else {
    output = orchestrate(input, humanContext);
  }
  console.log(JSON.stringify(output, null, 2));
} catch (error) {
  console.error(error?.stack ?? String(error));
  process.exit(1);
}
