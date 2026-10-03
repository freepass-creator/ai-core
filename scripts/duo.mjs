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
//   npm run duo -- stranded [--worktree <경로>]  GitHub 에 안 닿은 쪽지를 찾는다 — 있으면 exit 1 (worktree 지우기 전)
//
//   ★쪽지는 «이 worktree» 에 쓰지만 inbox·answer·log 는 «모든 worktree» 를 합쳐 본다(2026-10-03).
//   다른 worktree 에 갇힌 문답 29건이 main 에 못 올라간 채 백업 가지에만 남아 있었다.
//
//   `--now` 는 상대를 «지금» 부른다: to=codex 면 codex exec, to=claude 면 claude:review 게이트를 거친다.
//   부르지 못하면 그 사실을 BLOCKED/FAILED 로 적는다 — 막힘을 통과로 세지 않는다(1순위 규칙).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { 갇힌기록, 모든쪽지 } from '../src/collaboration/duo-reach.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const 우편함 = resolve(root, 'docs/coordination/duo');
const 기록부 = resolve(root, 'docs/coordination/CROSS_AI_LOG.md');

export const 상태 = { 열림: 'OPEN', 답함: 'ANSWERED', 막힘: 'BLOCKED', 실패: 'FAILED' };
const 상대 = new Set(['codex', 'claude']);

/** ★Codex 모델을 명시한다(2026-10-03): ~/.codex/config.toml 기본값(gpt-6.1-sol)이 ChatGPT 계정에서
 *  400 「not supported」로 거부돼 `--now` 상의가 전부 FAILED 였다. 사용자 설정은 건드리지 않고 호출에 적는다.
 *  바꾸려면 CODEX_MODEL. (ai-ops scripts/gpt-상의.mjs b830091 와 같은 방식) */
export const 코덱스모델 = process.env.CODEX_MODEL || 'gpt-5.5';
/** 모델 이름은 셸 명령에 들어간다 — 이름 꼴(영숫자·점·밑줄·하이픈)이 아니면 부르지 않는다(Codex 검토 #368: 셸 인젝션). */
export const 모델이름꼴 = /^[A-Za-z0-9._-]+$/;

const 인자 = (이름, 기본 = null) => {
  const i = process.argv.indexOf(`--${이름}`);
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : 기본;
};
const 깃발 = (이름) => process.argv.includes(`--${이름}`);

const 여기만 = () => {
  if (!existsSync(우편함)) return [];
  return readdirSync(우편함)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ 파일: f, ...JSON.parse(readFileSync(join(우편함, f), 'utf8')) }))
    .sort((a, b) => String(a.asked_at).localeCompare(String(b.asked_at)));
};

/** 모든 worktree 의 쪽지를 합친다. git 이 없거나 worktree 가 아니면 이 자리만 본다. */
export const 목록 = () => {
  try {
    return 모든쪽지(root).쪽지들;
  } catch {
    return 여기만();
  }
};

/** 갇힌 쪽지를 한 줄씩 말한다. 고아 worktree(폴더가 사라진 것)는 이미 잃었을 수 있다는 뜻이다. */
const 갇힘알림 = (판) => {
  for (const w of 판.자리) {
    const 이름 = `${w.경로} [${w.가지 ?? '?'}]${같은자리(w.경로) ? ' (여기)' : ''}`;
    if (w.고아) console.log(`  고아  ${이름} — 폴더가 없다. 거기 있던 쪽지는 확인할 수 없다 (git worktree prune 전 확인)`);
    else console.log(`  ${이름} — 커밋 안 됨 ${w.미커밋.length} · 푸시 안 됨 ${w.미푸시.length}`);
  }
};
const 같은자리 = (p) => resolve(p).toLowerCase() === root.toLowerCase();

/** ★쪽지를 «반드시» 남긴다 — 못 남기면 채널이 거짓말을 한다.
 *
 *  2026-09-28 실측: Codex 가 답을 줬는데 `writeFileSync` 가 `EPERM` 으로 죽었다(갓 만든 파일을
 *  윈도우 인덱서·백신이 순간 잡는다). 답은 화면에만 남고 우편함에는 «묻지도 않은 것»이 됐다.
 *  이 채널의 요점은 「막힘을 통과로 세지 않는다」인데, 기록이 유실되면 반대로 「물은 것을 안 물은 것」으로 센다.
 *  그래서 잠깐 기다렸다 몇 번 더 해 보고, 그래도 안 되면 «조용히 넘어가지 않고» 던진다. */
const 저장 = (쪽지) => {
  mkdirSync(우편함, { recursive: true });
  const 길 = join(우편함, `${쪽지.id}.json`);
  const 글 = JSON.stringify(쪽지, null, 2) + '\n';
  let 마지막;
  for (let 번 = 0; 번 < 5; 번 += 1) {
    try {
      writeFileSync(길, 글);
      return 쪽지;
    } catch (오류) {
      마지막 = 오류;
      if (오류.code !== 'EPERM' && 오류.code !== 'EBUSY') throw 오류;
      execSync(`sleep 0.${2 + 번}`, { stdio: 'ignore' });
    }
  }
  throw new Error(`쪽지를 우편함에 못 남겼다(${마지막?.code}) — 답이 있어도 기록이 없으면 안 물은 것이 된다: ${길}`);
};

/** 상대를 지금 부른다. 못 부르면 왜 못 불렀는지를 돌려준다 — 조용히 넘어가지 않는다. */
export function 부른다(쪽지) {
  if (쪽지.to === 'codex') {
    /** ★Windows 에서 codex 는 셸 shim(.cmd) 이라 execFile 로는 ENOENT 가 난다 — 셸을 거친다.
     *  (2026-09-27 이 채널의 첫 호출이 바로 이것으로 FAILED 났고, 그 실패가 우편함에 남아서 알았다.) */
    const 물음 = `${쪽지.about}\n\n${쪽지.body}\n\n200자 이내 한국어로 답해라.`;
    const 임시 = join(우편함, `${쪽지.id}.prompt.txt`);
    if (!모델이름꼴.test(코덱스모델)) {
      return { state: 상태.실패, answer: `codex 호출 안 함: CODEX_MODEL 이 모델 이름 꼴이 아니다(${JSON.stringify(코덱스모델)})` };
    }
    try {
      mkdirSync(우편함, { recursive: true });
      writeFileSync(임시, 물음);
      const 답 = execSync(`codex exec -s read-only -m ${코덱스모델} -C "${root}" --skip-git-repo-check "$(cat "${임시}")" < /dev/null`, {
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
    const 물음 = `${쪽지.about}\n\n${쪽지.body}\n\n읽기 전용으로 검토하고 500자 이내 한국어로 답해라.`;
    const 답 = execFileSync(process.execPath, [
      'scripts/claude-usage-gate.mjs', 'run', '--', 물음,
    ], {
      cwd: root,
      encoding: 'utf8',
      timeout: 300000,
      maxBuffer: 16 * 1024 * 1024,
    }).trim();
    if (!답) return { state: 상태.실패, answer: 'Claude 호출 실패: 빈 응답' };
    return { state: 상태.답함, answer: 답 };
  } catch (오류) {
    const 출력 = [오류.stdout, 오류.stderr, 오류.message]
      .map((값) => String(값 ?? '').trim())
      .find(Boolean) ?? '원인 미상';
    if (/UNAVAILABLE_(?:UNTIL_RESET|RESET_UNKNOWN)/.test(출력)) {
      return { state: 상태.막힘, answer: `Claude 게이트 닫힘: ${출력.split('\n').find((줄) => 줄.includes('UNAVAILABLE_')) ?? 출력}` };
    }
    return { state: 상태.실패, answer: `Claude 호출 실패: ${출력.split('\n')[0]}` };
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
  try {
    const { 충돌 } = 모든쪽지(root);
    for (const c of 충돌) console.log(`★같은 id 가 worktree 마다 다르다: ${c.id} — ${c.자리.join(' · ')}`);
    /** 지금 이 worktree 의 미커밋은 «하는 중»이라 정상이다. 다른 자리에 남은 것만 경고한다. */
    const 판 = 갇힌기록(root);
    const 남 = { ...판, 자리: 판.자리.filter((w) => !같은자리(w.경로)) };
    if (남.자리.length) {
      console.log(`\n★다른 worktree 에 GitHub 에 안 닿은 쪽지가 있다 — 그 자리에서 커밋·푸시하거나 이 가지로 옮긴다:`);
      갇힘알림(남);
    }
  } catch {
    /* git 이 없는 곳에서는 이 자리만 본다 */
  }
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
  delete 쪽지.자리;
  저장(쪽지);
  console.log(`${쪽지.id} → ${쪽지.state}`);
} else if (명령 === 'log') {
  /** 기록부에 붙일 줄을 만든다. 손으로 옮겨 적지 않게 한다 — 기록이 없으면 «안 부른 것»이므로. */
  const 줄 = 목록()
    .filter((x) => x.state !== 상태.열림)
    .map((x) => `| ${x.asked_at.slice(5, 10)} | ${x.from} → ${x.to} | ${x.about} | \`${x.state}\` | ${String(x.answer ?? '').replace(/\|/g, '·').slice(0, 160)} |`);
  console.log(줄.join('\n') || '(적을 것 없음)');
  console.log(`\n→ ${기록부} 의 표에 붙인다.`);
} else if (명령 === 'stranded') {
  /** worktree 를 지우기 «전»에 부른다(손발=AI Ops 가 정리할 때의 관문). 고아는 잃었을 수 있으니 실패로 센다. */
  const 대상 = 인자('worktree');
  const 판 = 갇힌기록(root, { 대상 });
  if (판.대상없음) {
    console.log(`FAIL: TARGET_NOT_FOUND — ${대상} 는 등록된 worktree 가 아니다(git worktree list 로 확인)`);
    process.exit(1);
  }
  if (!판.자리.length) {
    console.log(`PASS: GitHub 에 안 닿은 쪽지 없음${대상 ? ` (${대상})` : ' (모든 worktree)'}`);
  } else {
    console.log(`FAIL: 커밋 안 됨 ${판.미커밋} · 푸시 안 됨 ${판.미푸시} · 고아 worktree ${판.고아}`);
    갇힘알림(판);
    process.exit(1);
  }
} else {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 18).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(명령 ? 1 : 0);
}
