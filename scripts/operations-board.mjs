import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildOperationsBoard, buildSessionHandoff, validateDependencyCatalog } from '../src/operations/operations-board.mjs';

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), 'utf8'));
}

const mode = process.argv[2] ?? 'board';
const input = arg('--input');
if (!input) throw new Error('--input is required');
const output = arg('--output');
const snapshot = await readJson(input);
const catalog = await readJson(arg('--catalog') ?? 'registry/operations-dependencies.json');
validateDependencyCatalog(snapshot, catalog);
const board = buildOperationsBoard(snapshot);
let result = board;
if (mode === 'handoff') {
  const closeoutPath = arg('--closeout');
  if (!closeoutPath) throw new Error('--closeout is required for handoff');
  result = buildSessionHandoff(board, await readJson(closeoutPath));
}
const rendered = `${JSON.stringify(result, null, 2)}\n`;
if (output) await writeFile(resolve(output), rendered, 'utf8');
else process.stdout.write(rendered);
