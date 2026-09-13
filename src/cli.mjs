import fs from 'node:fs';
import { orchestrate } from './core.mjs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node src/cli.mjs <task.json>');
  process.exit(2);
}
try {
  const input = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(JSON.stringify(orchestrate(input), null, 2));
} catch (error) {
  console.error(error?.stack ?? String(error));
  process.exit(1);
}
