#!/usr/bin/env node
// 둘이 자유롭게 주고받는 자리 — 저장소 안에 두어서 «어느 세션에서든» 쓸 수 있게 한다.
//
// ★대표 2026-09-27: 「클로드하고 코덱스하고 자유롭게 소통할 수 있어야 되고, 어느 세션이든 이용할 수 있어야 돼」
//
//   왜 저장소 안인가: Claude 세션은 상시 대기하지 않는다. 세션에 매인 통로를 만들면 그 세션이 닫히는 순간 끊긴다.
//   파일로 두면 사람이 어느 창을 열든, 예약 작업이 돌든, Codex 가 CLI 로 들어오든 «같은 자리»를 본다.
//
//   npm run duo -- inbox                       열려 있는 것만 본다 (세션 시작할 때 먼저)
//   npm run duo -- ask  --to codex  --about "제목" --body "물을 것" [--now]
//   npm run duo -- ask  --to claude --about "제목" --body "물을 것"
//   npm run duo -- answer <id> --body "답" [--state ANSWERED|BLOCKED|FAILED]
//   npm run duo -- log                         기록부(CROSS_AI_LOG.md)에 붙일 줄을 만든다
//
//   `--now` 는 상대를 «지금» 부른다: to=codex 면 codex exec, to=claude 면 claude:review 게이트를 거친다.
//   부르지 못하면 그 사실을 BLOCKED/FAILED 로 적는다 — 막힘을 통과로 세지 않는다(1순위 규칙).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const 우편함 = resolve(root, 'docs/coordination/duo');
const 기록부 = resolve(root, 'docs/coordination/CROSS_AI_LOG.md');

export const 상태 = { 열림: 'OPEN', 답함: 'ANSWERED', 막힘: 'BLOCKED', 실패: 'FAILED' };
const 상대 = new Set(['codex', 'claude']);

const 인자 = (이름, 기본 = null) => {
  const i = process.argv.indexOf(`--${이름}`);
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : 기본;
};
const 깃발 = (이름) => process.argv.includes(`--${이름}`);

export const 목록 = () => {
  if (!existsSync(우편함)) return [];
  return readdirSync(우편함)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ 파일: f, ...JSON.parse(readFileSync(join(우편함, f), 'utf8')) }))
    .sort((a, b) => String(a.asked_at).localeCompare(String(b.asked_at)));
};

const 저장 = (쪽지) => {
  mkdirSync(우편함, { recursive: true });
  writeFileSync(join(우편함, `${쪽지.id}.json`), JSON.stringify(쪽지, null, 2) + '\n');
  return 쪽지;
};

/** 상대를 지금 부른다. 못 부르면 왜 못 불렀는지를 돌려준다 — 조용히 넘어가지 않는다. */
export function 부른다(쪽지) {
  if (쪽지.to === 'codex') {
    /** ★Windows 에서 codex 는 셸 shim(.cmd) 이라 execFile 로는 ENOENT 가 난다 — 셸을 거친다.
     *  (2026-09-27 이 채널의 첫 호출이 바로 이것으로 FAILED 났고, 그 실패가 우편함에 남아서 알았다.) */
    const 물음 = `${쪽지.about}\n\n${쪽지.body}\n\n200자 이내 한국어로 답해라.`;
    const 임시 = join(우편함, `${쪽지.id}.prompt.txt`);
    try {
      mkdirSync(우편함, { recursive: true });
      writeFileSync(임시, 물음);
      const 답 = execSync(`codex exec -s read-only -C "${root}" --skip-git-repo-check "$(cat "${임시}")" < /dev/null`, {
        encoding: 'utf8', shell: 'bash', timeout: 300000, maxBuffer: 16 * 1024 * 1024
      });
      /** ★codex exec 는 진행 로그 뒤에 답을 낸다. 마지막 «한 줄»만 집으면 여러 줄 답이 잘린다
       *  (2026-09-27 실측: (1)(2) 두 줄 답에서 (1)이 사라졌다). `codex` 표시 뒤부터 `tokens used` 앞까지가 답이다. */
      const 전체 = 답.replace(/\r/g, '');
      const 시작 = 전체.lastIndexOf('\ncodex\n');
      const 몸통 = 시작 >= 0 ? 전체.slice(시작 + 7) : 전체;
      const 답본문 = 몸통.split(/\ntokens used\b/)[0].trim();
      return { state: 상태.답함, answer: 답본문 || 전체.trim().split('\n').filter(Boolean).slice(-1)[0] };
    } catch (오류) {
      return { state: 상태.실패, answer: `codex 호출 실패: ${String(오류.message).split('\n')[0]}` };
    }
  }
  /** Claude 쪽은 사용량 게이트를 먼저 본다. 막혀 있으면 그 사실과 풀리는 시각을 적는다. */
  try {
    const 게이트 = JSON.parse(execFileSync('node', ['scripts/claude-usage-gate.mjs', 'status'], { cwd: root, encoding: 'utf8' }));
    if (!게이트.available) {
      return { state: 상태.막힘, answer: `Claude 게이트 닫힘(${게이트.status}) · 풀림 ${게이트.blocked_until}` };
    }
    return { state: 상태.열림, answer: 'Claude 게이트 열림 — `npm run claude:review -- <인자>` 로 부르면 된다' };
  } catch (오류) {
    return { state: 상태.실패, answer: `게이트 확인 실패: ${String(오류.message).split('\n')[0]}` };
  }
}

const 명령 = process.argv[2];

if (명령 === 'inbox') {
  const 열린것 = 목록().filter((x) => x.state === 상태.열림);
  if (!열린것.length) {
    console.log('열린 것 없음.');
  } else {
    console.log(`열린 것 ${열린것.length}개:`);
    for (const x of 열린것) console.log(`  ${x.id}  ${x.from}→${x.to}  ${x.asked_at.slice(0, 16)}  ${x.about}`);
  }
  const 전체 = 목록();
  console.log(`\n전체 ${전체.length}개 (답함 ${전체.filter((x) => x.state === 상태.답함).length} · 막힘 ${전체.filter((x) => x.state === 상태.막힘).length} · 실패 ${전체.filter((x) => x.state === 상태.실패).length})`);
} else if (명령 === 'ask') {
  const to = (인자('to') ?? '').toLowerCase();
  if (!상대.has(to)) throw new Error('--to codex|claude 가 필요하다');
  const about = 인자('about');
  const body = 인자('body');
  if (!about || !body) throw new Error('--about "제목" --body "물을 것" 이 필요하다');

  const 쪽지 = 저장({
    id: randomUUID().slice(0, 8),
    from: to === 'codex' ? 'claude' : 'codex',
    to,
    about,
    body,
    asked_at: new Date().toISOString(),
    state: 상태.열림,
    answer: null,
    answered_at: null
  });
  console.log(`물었다: ${쪽지.id} → ${to} · ${about}`);

  if (깃발('now')) {
    const 결과 = 부른다(쪽지);
    쪽지.state = 결과.state;
    쪽지.answer = 결과.answer;
    쪽지.answered_at = new Date().toISOString();
    저장(쪽지);
    console.log(`${결과.state}: ${결과.answer}`);
  } else {
    console.log('(--now 를 붙이면 지금 부른다)');
  }
} else if (명령 === 'answer') {
  const id = process.argv[3];
  const 쪽지 = 목록().find((x) => x.id === id);
  if (!쪽지) throw new Error(`그런 쪽지가 없다: ${id}`);
  쪽지.answer = 인자('body') ?? 쪽지.answer;
  쪽지.state = 인자('state') ?? 상태.답함;
  쪽지.answered_at = new Date().toISOString();
  delete 쪽지.파일;
  저장(쪽지);
  console.log(`${쪽지.id} → ${쪽지.state}`);
} else if (명령 === 'log') {
  /** 기록부에 붙일 줄을 만든다. 손으로 옮겨 적지 않게 한다 — 기록이 없으면 «안 부른 것»이므로. */
  const 줄 = 목록()
    .filter((x) => x.state !== 상태.열림)
    .map((x) => `| ${x.asked_at.slice(5, 10)} | ${x.from} → ${x.to} | ${x.about} | \`${x.state}\` | ${String(x.answer ?? '').replace(/\|/g, '·').slice(0, 160)} |`);
  console.log(줄.join('\n') || '(적을 것 없음)');
  console.log(`\n→ ${기록부} 의 표에 붙인다.`);
} else {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 18).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(명령 ? 1 : 0);
}
