/** 작업지킴이 — 한 회차가 «끝난 뒤» 래퍼(.cmd)가 부르는 알림
 *
 *  ★이것은 본체가 «아니다». 본체(node)가 죽은 «뒤에» .cmd 가 부르는 별개의 프로세스다.
 *   본체가 강제종료(0xC000013A)돼도 .cmd 는 다음 줄을 계속 돌기 때문에 이게 뜬다.
 *   본체 안에서 마지막에 메일을 부르는 구조였다면 본체와 «같이 죽는다» — 그게
 *   freepasserp4 에서 사흘을 아무도 모르게 만든 구조다.
 *
 *  ★파일 이름이 ASCII 인 까닭: .cmd 는 콘솔 코드페이지로 읽혀서 한글 경로가 깨진다.
 *   (기존 daily.cmd 주석이 그 이유를 적어 뒀다.) 안쪽 글은 한글이어도 node 가 UTF-8 로 읽는다.
 *
 *    node scripts/jikimi-allim.mjs --jageop=aiops-daily --code=4          보낼 글만 (DRY)
 *    node scripts/jikimi-allim.mjs --jageop=aiops-daily --code=4 --bonaenda
 *    node scripts/jikimi-allim.mjs ... --batneuni=pyh@teamjpk.com
 *
 *  ★기본은 «안 보낸다». --bonaenda 를 붙여야 보낸다.
 *  ★메일 보내는 «방법»은 scripts/메일보고.mjs 와 docs/aiknowhow/메일보내기.md 를 따랐다
 *   (python C:/dev/mailtool/send_mail.py, 본문을 tmp/…txt 로 써서 --body-file 로 넘김).
 *   그 파일을 고쳐 쓰지 않았다 — 그건 「정합성·루틴 보고서」고 이건 「작업이 죽었다」 알림이다.
 *   한 파일에 두 용도를 섞으면 둘 다 망가진다.
 *
 *  ★이 스크립트는 «무슨 일이 있어도 0 으로 끝난다». 지킴이가 작업의 종료코드를
 *   덮어써서 스케줄러 기록을 흐리면 안 된다. 종료코드는 래퍼가 exit /b %RC% 로 넘긴다.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { 맥박읽기, 맥박쓰기, 맥박갱신, 알릴까, 알림글, 상태보기, 한국날짜, 작업표, 맥박길 } from '../lib/jikimi.mjs';

const 인 = process.argv.slice(2);
const 값 = (이름) => (인.find((x) => x.startsWith(`--${이름}=`)) ?? '').split('=').slice(1).join('=');
const 보낸다 = 인.includes('--bonaenda');
const 작업 = 값('jageop') || '(이름없음)';
const 코드생 = 값('code');
const 받는이 = 값('batneuni') || 'pyh@teamjpk.com';
const 덧 = 값('deot');
const 길 = 값('maekbak') || 맥박길;   // 시험용으로만 옮긴다

try {
  const 때 = new Date(Date.now() + 9 * 36e5).toISOString().replace('T', ' ').slice(0, 19) + ' (KST)';
  const 오늘 = 한국날짜();
  const 상태 = 상태보기(코드생);

  const 맥박 = 맥박읽기(길);
  const 지난 = 맥박?.작업?.[작업] ?? null;
  const { 알린다, 까닭 } = 알릴까({ 지난, 상태, 오늘 });

  if (!작업표[작업]) console.log(`   ※ ${작업} 은 lib/jikimi.mjs 작업표에 없다 — 알림은 하되 「묵었나」 검사는 못 한다`);
  console.log(`[지킴이] ${작업} · 상태 ${상태} · 종료코드 ${코드생 || '모름'} · 알린다=${알린다} (${까닭})`);

  let 보냈나 = false;
  if (알린다) {
    const { 제목, 본문 } = 알림글({ 작업, 상태, 코드: 코드생 === '' ? null : 코드생, 때, 까닭, 덧붙임: 덧 ? [덧] : [] });
    console.log(`\n──── ${제목}\n${본문}\n────`);
    if (보낸다) {
      fs.mkdirSync('tmp', { recursive: true });
      const 본문길 = `tmp/jikimi-${작업}-${오늘}.txt`;
      fs.writeFileSync(본문길, 본문, 'utf8');
      try {
        execFileSync('python', ['C:/dev/mailtool/send_mail.py',
          '--to', 받는이, '--subject', 제목, '--body-file', 본문길, '--from-name', 'aiops'],
          { encoding: 'utf8', timeout: 120000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
        보냈나 = true;
        console.log(`   보냈다 — ${받는이}`);
      } catch (e) {
        // ★못 보내도 맥박은 남긴다. 다만 「알렸다」로는 «찍지 않는다» — 안 갔으니까.
        console.log(`   ★못 보냈다 — ${String(e.stdout || e.message).slice(0, 200)}`);
        console.log(`   본문은 ${본문길} 에 있다`);
      }
    } else {
      console.log(`   ※ 실제로 보내려면 --bonaenda (지금은 안 보냈다)`);
    }
  }

  맥박쓰기(맥박갱신(맥박, { 작업, 상태, 코드: 코드생 || null, 때, 때ISO: new Date().toISOString(), 알렸나: 보냈나, 오늘 }), 길);
} catch (e) {
  console.log(`[지킴이] ★지킴이 자신이 넘어졌다 — ${String(e && e.message).slice(0, 300)}`);
}
process.exit(0);
