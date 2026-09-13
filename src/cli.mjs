import fs from 'node:fs';
import { orchestrate } from './core.mjs';
import {
  createGitHubContentsFetcher,
  createGitHubRevisionFetcher
} from './github-client.mjs';
import { orchestrateLive } from './live-context.mjs';

const args = process.argv.slice(2);
const live = args.includes('--live');
const file = args.find(argument => argument !== '--live');

if (!file) {
  console.error('usage: node src/cli.mjs [--live] <task.json>');
  process.exit(2);
}

try {
  const input = JSON.parse(fs.readFileSync(file, 'utf8'));
  let output;
  if (live) {
    const token = process.env.AI_CORE_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;
    if (!token) throw new Error('live mode requires AI_CORE_GITHUB_TOKEN or GITHUB_TOKEN');
    output = await orchestrateLive(input, {
      fetchFile: createGitHubContentsFetcher({ token }),
      fetchRevision: createGitHubRevisionFetcher({ token })
    });
  } else {
    output = orchestrate(input);
  }
  console.log(JSON.stringify(output, null, 2));
} catch (error) {
  console.error(error?.stack ?? String(error));
  process.exit(1);
}
