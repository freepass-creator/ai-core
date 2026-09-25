/** 중앙 작업대장 CLI — 원문·개인정보는 title/note/command에 넣지 않는다. */
import { addReview, amendTask, createTask, getTask, listTasks, transitionTask } from '../lib/task-board.mjs';

const argv = process.argv.slice(2);
const [command, ...rest] = argv;
const divider = rest.indexOf('--');
const raw = divider < 0 ? rest : rest.slice(0, divider);
const commandArgs = divider < 0 ? [] : rest.slice(divider + 1);
const flags = new Map();
for (let i = 0; i < raw.length; i += 1) {
  if (!raw[i].startsWith('--')) continue;
  flags.set(raw[i].slice(2), raw[i + 1] && !raw[i + 1].startsWith('--') ? raw[++i] : 'true');
}
const flag = (name, fallback = undefined) => flags.get(name) ?? fallback;
const csv = (name) => String(flag(name, '')).split(',').map((value) => value.trim()).filter(Boolean);
const print = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);

if (command === 'create') {
  print(await createTask({
    id: flag('id'), title: flag('title'), owner: flag('owner', 'codex'), reviewer: flag('reviewer', 'claude'),
    contributors: csv('contributors'), dataClass: flag('class', 'employee-operational'), riskTier: flag('tier', 'D'),
    paths: csv('paths'), resources: csv('resources'), command: commandArgs.length ? commandArgs : null, commandLabel: flag('command-label'),
  }));
} else if (command === 'amend') {
  const patch = {};
  if (flags.has('title')) patch.title = flag('title');
  if (flags.has('tier')) patch.riskTier = flag('tier');
  if (flags.has('class')) patch.dataClass = flag('class');
  if (flags.has('paths')) patch.paths = csv('paths');
  if (flags.has('resources')) patch.resources = csv('resources');
  if (flags.has('command-label')) patch.commandLabel = flag('command-label');
  if (divider >= 0) patch.command = commandArgs;
  print(await amendTask(flag('id'), patch));
} else if (command === 'review') {
  print(await addReview(flag('id'), { reviewer: flag('reviewer', 'claude'), phase: flag('phase'), decision: flag('decision'), summary: flag('summary') }));
} else if (command === 'transition') {
  print(await transitionTask(flag('id'), flag('to'), { actor: flag('actor', 'codex'), note: flag('note') }));
} else if (command === 'show') {
  print(await getTask(flag('id')));
} else if (command === 'list') {
  const tasks = await listTasks();
  print(tasks.map((task) => ({ id: task.id, status: task.status, riskTier: task.riskTier, revision: task.revision, owner: task.owner, title: task.title, updatedAt: task.updatedAt })));
} else {
  process.stderr.write(`사용법:\n  node scripts/task-board.mjs create --id OPS-YYYYMMDD-001 --tier D --title "비식별 작업 요약" --paths sheets/job.mjs --resources sheet:<id> -- node sheets/job.mjs\n  node scripts/task-board.mjs review --id OPS-... --phase DESIGN --decision APPROVE --summary "범위 승인"\n  node scripts/task-board.mjs transition --id OPS-... --to RESERVED --note "실행 배정"\n  node scripts/task-board.mjs amend --id OPS-... --paths sheets/job.mjs --resources sheet:<id> -- node sheets/job.mjs\n  node scripts/task-board.mjs show --id OPS-... | list\n`);
  process.exitCode = 1;
}
