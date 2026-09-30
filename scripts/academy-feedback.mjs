import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildEpisodeFeedback } from '../src/academy/episode-feedback.mjs';

export async function readEpisodeFeedback(path) {
  const raw = await readFile(resolve(path), 'utf8');
  return buildEpisodeFeedback(JSON.parse(raw));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !args[0].trim() || args[0].startsWith('--')) {
    console.error('Usage: node scripts/academy-feedback.mjs <episode.json>');
    process.exitCode = 2;
  } else {
    try {
      const result = await readEpisodeFeedback(args[0]);
      console.log(JSON.stringify(result, null, 2));
    } catch {
      console.error('Academy feedback could not be generated from the supplied episode.');
      process.exitCode = 2;
    }
  }
}
