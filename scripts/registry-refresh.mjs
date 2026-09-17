// registry/projects.json 의 «관측» 을 지금 체크아웃에서 다시 읽는다.
//
// ★2026-09-18: 다섯 프로젝트 head_revision 이 «전부» 낡아 있었다. 그래서 진짜 오더를
//   묶으려는 첫 시도가 SUBJECT_REVISION_STALE 로 막혔다. 손으로 고치면 또 낡는다.
//
// ★세지 않는다 — 읽는다. git 이 말하는 것만 적고, 아무것도 지어내지 않는다.
//   mission·벽·required_approvals 같은 «사람이 선언한 것» 은 손대지 않는다.
//
//   node scripts/registry-refresh.mjs            고치고 무엇이 바뀌었는지 찍는다
//   node scripts/registry-refresh.mjs --check    안 고치고 낡았는지만 본다 (낡았으면 exit 1)

import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const 뿌리 = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const 인 = process.argv.slice(2);
const 볼까만 = 인.includes('--check');
const 길 = 인.find((x) => !x.startsWith('--')) ?? join(뿌리, 'registry', 'projects.json');
/** 체크아웃이 어디 있나 — ai-core 옆에 형제로 둔다는 것이 이 장치의 규약이다. */
const 옆에 = (id) => resolve(뿌리, '..', id);

const 리비전 = (곳) => {
  try {
    return execFileSync('git', ['-C', 곳, 'rev-parse', 'HEAD'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
};

const 이제 = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const 등록부 = JSON.parse(await readFile(길, 'utf8'));
const 바뀜 = [];
const 못봄 = [];

for (const 프 of 등록부.projects ?? []) {
  const rev = 리비전(옆에(프.project_id));
  /** ★못 찾으면 «건드리지 않는다». 지우거나 null 로 덮으면 「없다」고 말하는 것이 되는데,
   *  실제로는 「이 장치에 체크아웃이 없다」일 뿐이다. 그 둘은 다르다. */
  if (!rev) { 못봄.push(프.project_id); continue; }
  if (프.head_revision !== rev) 바뀜.push(`${프.project_id}: ${String(프.head_revision).slice(0, 8)} → ${rev.slice(0, 8)}`);
  프.head_revision = rev;
  for (const 원천 of 프.authoritative_sources ?? []) {
    if (원천.kind === 'GIT') { 원천.revision = rev; 원천.observed_at = 이제; }
  }
}

if (바뀜.length) console.log(바뀜.join('\n')); else console.log('낡은 것 없음');
if (못봄.length) console.log(`★체크아웃을 못 찾아 «그대로 둔 것»: ${못봄.join(', ')}`);

if (볼까만) process.exit(바뀜.length ? 1 : 0);
등록부.observed_at = 이제;
await writeFile(길, `${JSON.stringify(등록부, null, 2)}\n`, 'utf8');
console.log(`적었다: ${길}`);
