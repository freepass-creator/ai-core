/** ★★AI 넷이 «여기서 같이» 일하는 자리 — 대표를 거치지 않는다.
 *
 *  대표(2026-09-02): 「모든 작업할 때 **4개 AI 가 알아서 협업**하도록」
 *                    「**여기서 같이 작업**하라고」
 *
 *  ── 왜 이게 있나
 *  자리는 있었는데 «내 차례가 무엇인지» 를 보는 곳이 없었다.
 *  작업보드(198건)·INBOX(2,800줄)·제안함이 따로 있어서, 결국 대표가 「코덱스한테 물어봐」 하고
 *  일일이 이어 줘야 했다. ★이어 주는 일을 사람이 하면 그건 협업이 아니라 «중계» 다.
 *  ★쪽지만 남기는 것도 여전히 중계다. 그래서 «이 폴더에서 그 자리에» CLI 를 부른다.
 *
 *  ── 넷이 무엇을 맡나
 *      Claude    만든다   판단·설계·계산·매뉴얼·도구            ★메인 (나)
 *      코덱스     돌린다   플랫폼 수정 · 데이터 «반복» 투입        codex exec    ★깔려 있다
 *      제미나이    읽는다   문서 판독 (고지서·계약서·통장 스캔)     gemini -p     ★깔려 있다
 *      커서       살핀다   독립 검토 — 실행자는 제 일을 제가 못 본다  cursor-agent  ★깔려 있다
 *
 *  ── 어떻게 쓰나
 *      node scripts/협업.mjs                                    ★지금 넷이 무엇을 쥐고 있나
 *      node scripts/협업.mjs --나=코덱스                         내 차례만
 *      node scripts/협업.mjs 시킨다 --받는이=코덱스 --무엇="…"     ★«여기서» 바로 돌린다
 *      node scripts/협업.mjs 물어본다 --무엇="…"                 ★코덱스·제미나이·커서 «셋 다» 에게 동시에
 *      node scripts/협업.mjs 넘긴다 --받는이=커서 --무엇="…"      못 돌리는 상대에게는 남겨만 둔다
 *      node scripts/협업.mjs 받았다|끝냈다|막혔다 --번호=H-…
 *
 *  ★★기본은 «읽기만» 이다 — codex 는 -s read-only · gemini 는 --approval-mode plan.
 *    남의 손이 내 폴더를 말없이 고치게 두지 않는다. 정말 고치게 하려면 --쓰기 를 준다.
 *  ★승인 절차가 아니다. 막히는 것은 ROLES.md 「행위 문턱」 뿐이다 —
 *    관청 실제 발송 · 정본 대량 삭제는 여기로도 못 연다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const 넷 = ['Claude', '코덱스', '제미나이', '커서'];
const 맡은일 = {
  Claude: '만든다 — 판단·설계·계산·매뉴얼·도구',
  코덱스: '돌린다 — 플랫폼 수정 · 데이터 반복 투입   (codex exec)',
  제미나이: '읽는다 — 문서 판독 (고지서·계약서·통장)   (gemini -p)',
  커서: '살핀다 — 독립 검토 (cursor-agent -p --mode ask)',
};
const 별명 = { claude: 'Claude', 클로드: 'Claude', codex: '코덱스', 코덱: '코덱스', gemini: '제미나이', 제미니: '제미나이', cursor: '커서' };

const argv = process.argv.slice(2);
const 짓 = argv.find((x) => !x.startsWith('--')) || '본다';
const arg = (k) => { const a = argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : ''; };
const 누구 = (v) => { const s = String(v ?? '').trim(); return 별명[s.toLowerCase()] || (넷.includes(s) ? s : ''); };

const 길 = '.coordination/주고받기.ndjson';
const 오늘 = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10);
const 이제 = () => new Date(Date.now() + 9 * 36e5).toISOString().replace('T', ' ').slice(0, 16);

const 읽는다 = () => {
  if (!fs.existsSync(길)) return [];
  const 표 = new Map();
  for (const 줄 of fs.readFileSync(길, 'utf8').split('\n')) {
    if (!줄.trim()) continue;
    let x; try { x = JSON.parse(줄); } catch { continue; }
    표.set(x.번호, { ...(표.get(x.번호) || {}), ...x });   // ★뒤에 적은 것이 이긴다
  }
  return [...표.values()];
};
const 적는다 = (x) => {
  fs.mkdirSync(path.dirname(길), { recursive: true });
  fs.appendFileSync(길, `${JSON.stringify(x)}\n`, 'utf8');
};
const 새번호 = () => {
  const 오늘것 = 읽는다().filter((x) => String(x.번호).startsWith(`H-${오늘.replace(/-/g, '')}`));
  return `H-${오늘.replace(/-/g, '')}-${String(오늘것.length + 1).padStart(3, '0')}`;
};

// ══════════ 넘긴다 · 받았다 · 끝냈다 · 막혔다 ══════════
if (짓 === '넘긴다') {
  const 받는이 = 누구(arg('받는이'));
  const 준이 = 누구(arg('나')) || 'Claude';
  const 무엇 = arg('무엇');
  if (!받는이 || !무엇) {
    console.log(`\n   ★이렇게 쓴다:\n   node scripts/협업.mjs 넘긴다 --받는이=커서 --무엇="…" --왜="…"\n   받는이: ${넷.join(' · ')}\n`);
    process.exit(1);
  }
  if (받는이 === 준이) { console.log('\n   ★제 자신에게는 못 넘긴다\n'); process.exit(1); }
  const 번호 = 새번호();
  적는다({ 번호, 언제: 이제(), 준이, 받는이, 무엇, 왜: arg('왜') || '', 관련: arg('관련') || '', 상태: '대기' });
  console.log(`\n   ★${번호} — ${준이} → ${받는이}\n   ${무엇}\n`);
  process.exit(0);
}

if (['받았다', '끝냈다', '막혔다'].includes(짓)) {
  const 번호 = arg('번호');
  const 옛 = 읽는다().find((x) => x.번호 === 번호);
  if (!옛) { console.log(`\n   ★${번호 || '(번호 없음)'} 를 못 찾았다\n`); process.exit(1); }
  const 상태 = { 받았다: '받음', 끝냈다: '끝남', 막혔다: '막힘' }[짓];
  적는다({ 번호, 상태, [`${상태}언제`]: 이제(), 결과: arg('결과') || arg('왜') || '' });
  console.log(`\n   ★${번호} → ${상태}\n`);
  process.exit(0);
}

// ══════════ ★시킨다 · 물어본다 — «여기서» 바로 돌린다 ══════════
/** 이 폴더에서 지켜야 할 것을 프롬프트 앞에 붙인다 — 누가 오든 규칙은 같다 */
const 앞말 = (무엇, 왜, 관련) => [
  '너는 지금 C:\\dev\\aiops 에서 다른 AI 와 «같이» 일하고 있다. 답은 한국어로 한다.',
  '★숫자는 새로 세지 마라 — lib/wonja/*.json 정본을 «읽는다». 세면 세션마다 답이 달라진다.',
  '★모르면 「없다」 가 아니라 「모른다」 고 답한다. 자료 구멍은 lib/wonja/자료구멍.json 에 있다.',
  '★짧게, 근거(파일·줄)를 대고 답한다. 긴 총평은 필요 없다.',
  '',
  `── 부탁: ${무엇}`,
  왜 ? `── 왜: ${왜}` : '',
  관련 ? `── 관련: ${관련}` : '',
].filter(Boolean).join('\n');

/** ★★프롬프트는 «인자» 가 아니라 «stdin» 으로 준다 (2026-09-02 에 깨졌다)
 *
 *  윈도우에서 codex·gemini 는 npm 이 깐 `.cmd` 껍데기다. 그래서 `spawn(..., {shell:true})` 로 부르는데,
 *  shell:true 는 인자를 «따옴표 없이 이어 붙인다». 긴 한국어 프롬프트를 인자로 주면 띄어쓰기에서 갈려
 *      codex: error: unexpected argument '지금' found
 *  처럼 죽는다. shell:false 로 바꾸면 이번엔 `.cmd` 를 못 부른다(노드가 막는다).
 *
 *  ★그래서 인자에는 «띄어쓰기 없는 깃발» 만 두고, 말은 stdin 으로 흘려보낸다.
 *      codex exec … -      ← 「-」 면 stdin 에서 읽는다
 *      gemini … -p "…"     ← stdin 이 있으면 그 뒤에 -p 가 붙는다
 */
/** ★커서 CLI 는 «이미 깔려 있었다» — PATH 에만 안 잡혀 있었다 (2026-09-02)
 *  `cursor.exe` 는 편집기라 「커서는 CLI 가 없다」 고 적었는데 틀렸다.
 *  진짜 agent 는 `%LOCALAPPDATA%\cursor-agent\cursor-agent.cmd` 에 있다 (2026.08.25-3e8eec8).
 *  ★PATH 에 있으면 그걸 쓰고, 없으면 이 자리를 짚는다. */
const 커서길 = (() => {
  const 집 = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
  const 짚 = path.join(집, 'cursor-agent', 'cursor-agent.cmd');
  return fs.existsSync(짚) ? 짚 : 'cursor-agent';
})();

const 부른다 = (이름, 프롬, 쓰기, 분) => new Promise((맺) => {
  const 짬 = {
    코덱스: ['codex', ['exec', '--skip-git-repo-check', '-s', 쓰기 ? 'workspace-write' : 'read-only', '-']],
    제미나이: ['gemini', ['--skip-trust', '--approval-mode', 쓰기 ? 'auto_edit' : 'plan', '-p', '"위 부탁에 답해라"']],
    /** ★-p 는 «쓰기·셸까지 다 되는» 모드다. 그래서 읽기만 할 때는 --mode ask 를 꼭 같이 준다
     *
     *  ★★2026-09-08 — 깃발 둘이 «문서에만» 있고 여기 없었다. 커서 자신이 짚어 줬다:
     *    「`협업.mjs` 가 커서에 --trust/--model 안 줌 → ★문서와 코드 불일치
     *      (scripts/협업.mjs 137행 vs AI-CLI연동.md 102행)」
     *
     *  ★오늘 하루에 같은 무늬를 세 번 봤다 — 규칙을 «적어 두고 도구가 안 읽는 것».
     *    (규칙-돈의성격 원자를 빼 놓고 입금붙임이 자기 정규식을 쓰던 것과 같다)
     *
     *      --trust                  없으면 Workspace Trust Required 로 그냥 안 돈다
     *      --model composer-2.5     프리미엄 모델은 사용 한도가 차 있다. 이 모델은 한도 밖이고,
     *                               ★코덱스 계열을 고르면 codex 와 «같은 눈» 이 되어 대조가 무의미해진다
     */
    커서: [`"${커서길}"`, 쓰기
      ? ['--trust', '-p', '-f', '--model', 'composer-2.5']
      : ['--trust', '-p', '--mode', 'ask', '--model', 'composer-2.5']],
  }[이름];
  if (!짬) { 맺({ 이름, 됨: false, 글: '★이 AI 는 CLI 가 없어 여기서 못 돌린다 — 넘겨만 둔다' }); return; }
  const [명, 팔] = 짬;
  const t0 = Date.now();
  /** ★★AI 를 «어느 폴더에서» 부르나 — 2026-09-05 에 이것 때문에 답이 안 왔다.
   *  제미나이에게 팀JPK워크 화면을 검토하라 했더니 「C:devaiops 에 그 파일이 없습니다」 라고 답했다.
   *  ★파일 «경로» 만 주고 「어느 폴더에서 돌아라」 를 안 줬다. 제미나이는 제 작업 폴더 밖을 못 본다.
   *  ★AI 가 못 답한 게 아니라 «내가 볼 수 없는 자리에 던진» 것이다.
   *      node scripts/협업.mjs 물어본다 --어디=C:/dev/teamjpkwork --무엇='...'
   */
  const 어디 = (process.argv.find((a) => a.startsWith('--어디=')) ?? '').split('=').slice(1).join('=') || process.cwd();
  const p = spawn(명, 팔, { shell: true, cwd: 어디 });
  p.stdin.on('error', () => {});
  p.stdin.end(`${프롬}\n`, 'utf8');
  let 나옴 = ''; let 샘 = '';
  p.stdout.on('data', (d) => { 나옴 += d; });
  p.stderr.on('data', (d) => { 샘 += d; });
  const 시계 = setTimeout(() => p.kill(), (Number(분) || 12) * 60000);
  p.on('error', (e) => { clearTimeout(시계); 맺({ 이름, 됨: false, 글: `★못 불렀다 — ${e.message}` }); });
  p.on('close', (코드) => {
    clearTimeout(시계);
    /** ★★답이 왔으면 «된 것» 이다 — 나가는 코드로만 가르지 않는다 (2026-09-03)
     *  gemini 는 답을 다 내고도 경고(true color·ripgrep) 때문에 0 이 아닌 코드로 끝나는 일이 있다.
     *  그래서 답이 멀쩡히 왔는데 「막힘」 으로 찍혀 판이 빨갛게 보였다.
     *  ★stdout 에 글이 있으면 됨으로 본다. 코드는 따로 적어 둔다. */
    const 글 = 나옴.trim() || 샘.trim();
    맺({ 이름, 됨: 나옴.trim().length > 0, 글, 코드, 초: Math.round((Date.now() - t0) / 1000) });
  });
});

const 답길 = (번호) => `.coordination/답/${번호}.md`;
const 답적는다 = (번호, 이름, 무엇, 글) => {
  fs.mkdirSync('.coordination/답', { recursive: true });
  fs.writeFileSync(답길(번호), `# ${번호} — ${이름}\n\n> ${무엇}\n\n_${이제()}_\n\n---\n\n${글}\n`, 'utf8');
};

// ══════════ ★검수한다 — 개인정보만 지우고 파일을 맞대게 한다 ══════════
/** 대표(2026-09-01): 「어차피 **법인자료니까 개인정보 빼고는 전혀 상관없어**」
 *  ★그래서 차량번호·법인명·금액·VIN 은 «지우지 않는다» — 지우면 검수가 안 된다.
 *    지우는 것은 주민번호·전화·계좌·이메일과 «우리가 아는 고객 이름» 뿐이다.
 *  ★무엇을 몇 건 지웠는지 «먼저 보여준다». 못 지운 것이 있으면 사람이 멈출 수 있게.
 */
const 지울무늬 = [
  ['주민등록번호', /\d{6}\s*-\s*[1-8]\d{6}/g, '[주민번호]'],
  ['전화번호', /01[0-9][-\s.]?\d{3,4}[-\s.]?\d{4}/g, '[전화]'],
  ['이메일', /[\w.+-]+@[\w-]+\.[\w.]+/g, '[메일]'],
  ['계좌번호', /\b\d{2,6}-\d{2,6}-\d{2,8}\b/g, '[계좌]'],
];
function 아는이름() {
  const 이름 = new Set();
  for (const q of ['lib/wonja/계약.json', 'lib/wonja/미수.json', 'lib/wonja/수납.json']) {
    if (!fs.existsSync(q)) continue;
    try {
      const 훑 = (o) => {
        if (!o || typeof o !== 'object') return;
        for (const [k, v] of Object.entries(o)) {
          if (/^(고객|이름|계약자|성명|받는이|보낸사람|담당자)$/.test(k) && typeof v === 'string') {
            const t = v.replace(/\d+/g, '').trim();
            if (t.length >= 2 && t.length <= 4 && /^[가-힣]+$/.test(t)) 이름.add(t);
          } else 훑(v);
        }
      };
      훑(JSON.parse(fs.readFileSync(q, 'utf8')));
    } catch { /* 원자가 없거나 깨졌으면 무늬만으로 간다 */ }
  }
  return [...이름].sort((a, b) => b.length - a.length);
}
function 개인정보지운다(글) {
  const 셈 = {}; let 남 = 글;
  for (const [이름, 무늬, 대신] of 지울무늬) {
    const n = (남.match(무늬) || []).length;
    if (n) { 셈[이름] = (셈[이름] || 0) + n; 남 = 남.replace(무늬, 대신); }
  }
  for (const 이름 of 아는이름()) {           // 한글 2~4자뿐이라 무늬 이스케이프가 필요 없다
    const 무늬 = new RegExp(이름, 'g');
    const n = (남.match(무늬) || []).length;
    if (n) { 셈.사람이름 = (셈.사람이름 || 0) + n; 남 = 남.replace(무늬, '[고객명]'); }
  }
  return { 글: 남, 셈 };
}

const 관점말 = {
  로직: 'A. 판정 순서가 뒤바뀌어 값이 조용히 뭉개지는 곳  B. 빈 값·null·형식 불일치를 잘못 다루는 곳  C. 같은 것을 두 번 세는 곳',
  자료: 'A. 「없다」와 「모른다」를 뒤섞은 곳  B. 근거 없이 단정하는 곳  C. 원천을 덮어써 되돌릴 수 없게 만드는 곳',
  보안: 'A. 개인정보가 파일·로그로 새는 곳  B. 되돌릴 수 없는 쓰기를 막는 장치가 없는 곳  C. 남의 자료를 우리 것으로 세는 곳',
};

if (짓 === '검수한다') {
  const 볼것 = argv.filter((x) => !x.startsWith('--') && x !== '검수한다' && fs.existsSync(x) && fs.statSync(x).isFile());
  const 관점 = arg('관점') || '로직';
  if (!볼것.length) {
    console.log('\n   ★이렇게 쓴다:\n   node scripts/협업.mjs 검수한다 <파일…> --왜="무엇을 보나" --관점=로직|자료|보안\n');
    process.exit(1);
  }
  let 본문 = ''; const 지운셈 = {};
  for (const f of 볼것) {
    const { 글, 셈 } = 개인정보지운다(fs.readFileSync(f, 'utf8'));
    for (const [k, v] of Object.entries(셈)) 지운셈[k] = (지운셈[k] || 0) + v;
    본문 += `\n--- 파일: ${f} ---\n${글}\n`;
  }
  console.log(`\n════ ★검수 — ${볼것.length}개 파일 · 관점 「${관점}」 (${이제()}) ════\n`);
  console.log(`   ★지운 개인정보: ${Object.keys(지운셈).length ? JSON.stringify(지운셈) : '없음'}`);
  const 씻은 = 본문.replace(/\[주민번호\]|\[전화\]|\[메일\]|\[계좌\]|\[고객명\]/g, '');
  const 남은 = 지울무늬.filter(([, 무늬]) => { 무늬.lastIndex = 0; return 무늬.test(씻은); });
  if (남은.length) console.log(`   ★못 지운 것이 있을 수 있다 — 보내기 전에 봐라: ${남은.map((x) => x[0]).join(', ')}`);

  const 프롬 = [
    앞말(arg('왜') || '아래 파일에서 틀린 곳을 찾아라', '', arg('관련')),
    '',
    '★다음만 지적해라. 칭찬·요약·재작성은 하지 마라.',
    관점말[관점] || 관점말.로직,
    '· 번호를 매겨 각 3줄 이내로. ★«어느 줄의 무엇이» 틀렸는지 짚어라.',
    '· 확신이 없으면 「추측:」을 앞에 붙여라. 틀린 곳이 없으면 「없음」이라고만 써라.',
    '· ★파일을 고치지 마라. 읽고 지적만 해라.',
    본문,
  ].join('\n');

  const 답들 = await Promise.all(['코덱스', '제미나이', '커서'].map((이름) => 부른다(이름, 프롬, false, arg('분'))));
  for (const 답 of 답들) {
    const 번호 = 새번호();
    적는다({
      번호, 언제: 이제(), 준이: 누구(arg('나')) || 'Claude', 받는이: 답.이름,
      무엇: `검수 — ${볼것.join(' · ')}`, 왜: arg('왜') || '', 관점, 갈래: '검수',
      상태: 답.됨 ? '끝남' : '막힘',
      결과: 답.됨 ? `→ ${답길(번호)} (${답.초}초)` : String(답.글 || '').slice(0, 120),
    });
    if (답.됨) 답적는다(번호, 답.이름, `검수(${관점}) — ${볼것.join(' · ')}`, 답.글);
    console.log(`\n   ── ${답.이름}  ${답.됨 ? `★${답.초}초 · ${답길(번호)}` : '★못 돌았다'}`);
    console.log(String(답.글 || '').split('\n').slice(-40).map((x) => `      ${x}`).join('\n'));
  }
  console.log('\n   ★★이 지적들은 «아직 참이 아니다». 실측으로 하나씩 검증해라.');
  console.log('     검증하고 나면 «반드시» 적는다 — 그래야 성적이 쌓이고 누구에게 무엇을 물을지가 정해진다:');
  console.log('     node scripts/협업.mjs 판정한다 --번호=H-… --참=3 --거짓=2 --무엇="…"\n');
  process.exit(0);
}

// ══════════ ★판정한다 · 성적 — 답을 «검증한 결과» 를 쌓는다 ══════════
/** ★왜 있나 — 2026-09-01 실측: 코덱스 지적 5건 중 3건 · 제미나이 3건 중 1건만 «진짜» 였다.
 *  ★답을 그대로 믿으면 안 되는데, 검증한 결과를 «남기지 않으면» 다음 세션이 또 처음부터 잰다.
 *    성적이 쌓이면 「이런 것은 코덱스에게, 저런 것은 제미나이에게」 가 «근거로» 정해진다.
 *  ★성적이 낮다고 빼지는 않는다 — 만든 사람이 검증하면 놓친다. 둘째 눈은 성적과 무관하게 필요하다.
 */
if (짓 === '판정한다') {
  const 번호 = arg('번호');
  const 옛 = 읽는다().find((x) => x.번호 === 번호);
  if (!옛) { console.log(`\n   ★${번호 || '(번호 없음)'} 를 못 찾았다\n`); process.exit(1); }
  const 참 = Number(arg('참') || 0); const 거짓 = Number(arg('거짓') || 0);
  if (!참 && !거짓) { console.log('\n   ★--참=N --거짓=N 이 있어야 한다\n'); process.exit(1); }
  적는다({ 번호, 판정: { 참, 거짓, 무엇: arg('무엇') || '', 언제: 이제(), 판정한이: 누구(arg('나')) || 'Claude' } });
  console.log(`\n   ★${번호} (${옛.받는이}) — 참 ${참} · 거짓 ${거짓}${arg('무엇') ? `\n   ${arg('무엇')}` : ''}\n`);
  process.exit(0);
}

if (짓 === '성적') {
  const 목록 = 읽는다().filter((x) => x.판정);
  if (!목록.length) {
    console.log('\n   아직 판정한 것이 없다.\n   node scripts/협업.mjs 판정한다 --번호=H-… --참=3 --거짓=2 --무엇="…"\n');
    process.exit(0);
  }
  const 표 = {};
  for (const x of 목록) {
    const 칸 = (표[x.받는이] ??= { 참: 0, 거짓: 0, 판: 0, 갈래: {} });
    칸.참 += Number(x.판정.참 || 0); 칸.거짓 += Number(x.판정.거짓 || 0); 칸.판 += 1;
    const g = x.관점 || x.갈래 || '그밖';
    const 나눔 = (칸.갈래[g] ??= { 참: 0, 거짓: 0 });
    나눔.참 += Number(x.판정.참 || 0); 나눔.거짓 += Number(x.판정.거짓 || 0);
  }
  const 율 = (v) => (v.참 + v.거짓 ? Math.round((v.참 / (v.참 + v.거짓)) * 100) : 0);
  console.log(`\n════ ★누가 무엇을 잘 맞히나 — 판정 ${목록.length}건 (${오늘}) ════\n`);
  for (const [이름, v] of Object.entries(표).sort((a, b) => 율(b[1]) - 율(a[1]))) {
    console.log(`   ${이름.padEnd(6)} 지적 ${String(v.참 + v.거짓).padStart(3)}건 중 ★참 ${String(v.참).padStart(3)}  (${율(v)}%)   판정 ${v.판}회`);
    for (const [g, n] of Object.entries(v.갈래)) {
      console.log(`          └ ${g.padEnd(6)} ${String(n.참).padStart(3)}/${String(n.참 + n.거짓).padStart(3)}  (${율(n)}%)`);
    }
  }
  console.log('\n   ★맞힌 비율이 높은 쪽에 그 갈래를 «먼저» 맡긴다. 낮다고 빼지는 않는다 —');
  console.log('     ★만든 사람이 검증하면 놓친다. 둘째 눈은 성적과 상관없이 필요하다.\n');
  process.exit(0);
}

if (짓 === '시킨다' || 짓 === '물어본다') {
  const 무엇 = arg('무엇');
  if (!무엇) { console.log('\n   ★--무엇="…" 이 있어야 한다\n'); process.exit(1); }
  const 왜 = arg('왜'); const 관련 = arg('관련');
  const 쓰기 = argv.includes('--쓰기'); const 분 = arg('분');
  const 받을이 = 짓 === '물어본다' ? ['코덱스', '제미나이', '커서'] : [누구(arg('받는이'))].filter(Boolean);
  if (!받을이.length) { console.log(`\n   ★--받는이= 가 있어야 한다: ${넷.join(' · ')}\n`); process.exit(1); }

  const 프롬 = 앞말(무엇, 왜, 관련);
  console.log(`\n════ ★${받을이.join(' · ')} 에게 «여기서» 시킨다 (${이제()}) ════\n`);
  console.log(`   ${무엇}`);
  console.log(`   ★${쓰기 ? '쓰기 허용 (workspace-write)' : '읽기만 — 내 폴더를 고치지 못한다'}\n`);

  const 답들 = await Promise.all(받을이.map((이름) => 부른다(이름, 프롬, 쓰기, 분)));
  for (const 답 of 답들) {
    const 번호 = 새번호();
    적는다({
      번호, 언제: 이제(), 준이: 누구(arg('나')) || 'Claude', 받는이: 답.이름, 무엇, 왜, 관련,
      상태: 답.됨 ? '끝남' : '막힘',
      결과: 답.됨 ? `→ ${답길(번호)} (${답.초}초)` : String(답.글 || '').slice(0, 120),
    });
    if (답.됨) 답적는다(번호, 답.이름, 무엇, 답.글);
    console.log(`   ── ${답.이름}  ${답.됨 ? `★${답.초}초 · ${답길(번호)}` : '★못 돌았다'}`);
    console.log(String(답.글 || '').split('\n').slice(-40).map((x) => `      ${x}`).join('\n'));
    console.log('');
  }
  process.exit(0);
}

// ══════════ 본다 ══════════
const 목 = 읽는다();
const 나 = 누구(arg('나'));
const 원 = (s, n) => String(s ?? '').padEnd(n).slice(0, n);
const 며칠 = (t) => (t ? Math.round((Date.now() - new Date(`${t}+09:00`)) / 864e5) : 0);

console.log(`\n════ ★AI 넷이 «여기서 같이» 일하는 자리 (${오늘}) ════\n`);
if (!목.length) console.log('   아직 오간 것이 없다.\n');

for (const 이름 of 넷) {
  if (나 && 이름 !== 나) continue;
  const 받을것 = 목.filter((x) => x.받는이 === 이름 && ['대기', '받음'].includes(x.상태));
  const 넘긴것 = 목.filter((x) => x.준이 === 이름 && ['대기', '받음'].includes(x.상태));
  const 막힌것 = 목.filter((x) => (x.받는이 === 이름 || x.준이 === 이름) && x.상태 === '막힘');
  console.log(`   ── ${이름}  ${맡은일[이름]}`);
  if (!받을것.length && !넘긴것.length && !막힌것.length) { console.log('      비어 있다\n'); continue; }
  for (const x of 받을것) {
    const ㄴ = 며칠(x.언제);
    console.log(`      ★내 차례  ${x.번호}  ${원(x.무엇, 58)}  ← ${x.준이}${ㄴ >= 2 ? `  ★${ㄴ}일째` : ''}`);
    if (x.왜) console.log(`                 왜: ${x.왜}`);
  }
  for (const x of 넘긴것) console.log(`      기다림    ${x.번호}  ${원(x.무엇, 58)}  → ${x.받는이} (${x.상태})`);
  for (const x of 막힌것) console.log(`      ★막힘    ${x.번호}  ${원(x.무엇, 58)}  ${x.결과 || ''}`);
  console.log('');
}

const 끝난것 = 목.filter((x) => x.상태 === '끝남');
if (!나 && 끝난것.length) {
  console.log(`   ── 끝난 것 ${끝난것.length}건 (마지막 5)`);
  for (const x of 끝난것.slice(-5)) console.log(`      ${x.번호}  ${x.준이} → ${x.받는이}  ${원(x.무엇, 44)}  ${x.결과 || ''}`);
  console.log('');
}

console.log('   ★★시킨다  node scripts/협업.mjs 시킨다 --받는이=코덱스 --무엇="…"   ← «여기서» 바로 돌린다');
console.log('   ★★셋다    node scripts/협업.mjs 물어본다 --무엇="…"                  ← 코덱스·제미나이·커서 동시에');
console.log('   넘긴다    node scripts/협업.mjs 넘긴다 --받는이=… --무엇="…"        ← 지금 안 돌리고 남겨만 둘 때');
console.log('   끝냈다    node scripts/협업.mjs 끝냈다 --번호=H-… --결과="…"\n');
