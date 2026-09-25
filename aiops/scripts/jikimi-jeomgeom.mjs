/** 작업지킴이 — 「안 돌았다」를 잡는 점검
 *
 *  ★종료코드로는 «안 뜬 작업»을 못 잡는다. 실패는 코드가 남지만, 작업이 아예 안 뜨면
 *   (꺼져 있거나 PC 가 꺼져 있었거나 스케줄러가 건너뛰었거나) 남는 게 «아무것도 없다».
 *   그래서 마지막 성공 시각을 logs/jikimi-maekbak.json 한 곳에 남기고, 이 점검이
 *   그걸 «작업과 다른 프로세스로» 읽는다. 작업이 한 번도 안 떴어도 이건 뜬다.
 *
 *  ── 어디에 남기나 · 누가 보나 (정한 근거)
 *  · 맥박 파일은 logs/ 에 둔다. 이미 같은 성격의 표식(logs/gwataeryo-achim-doetda.txt)이
 *    거기 있고, 이 값은 «그 PC 의 실행 사실»이지 저장소의 정본이 아니다. 그래서 커밋하지
 *    않는다(.gitignore 에 이름을 박았다). 시트·Firestore 에 두지 않은 까닭은 뚜렷하다 —
 *    네트워크가 막히거나 할당량이 마르면 «바로 그때» 못 쓰는 저장소이기 때문이다.
 *    지킴이는 본체가 죽는 상황에서 살아 있어야 한다.
 *  · 보는 사람은 메일 받는 이 한 명이고, 보는 «프로그램»은 이 스크립트다.
 *    켤 때는 scripts/jikimi.cmd 를 따로 예약 작업으로 걸어 하루 한 번 돌린다.
 *    ★그 등록은 이 세션에서 하지 않았다(작업을 켜거나 시각을 바꾸지 말라는 지시).
 *
 *    node scripts/jikimi-jeomgeom.mjs                 무엇이 묵었는지만 (DRY)
 *    node scripts/jikimi-jeomgeom.mjs --bonaenda
 *    node scripts/jikimi-jeomgeom.mjs --jigeum=2026-09-20T00:00:00Z    (시험용, 지금을 옮긴다)
 *    node scripts/jikimi-jeomgeom.mjs --maekbak=tmp/시험맥박.json      (시험용)
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { 맥박읽기, 맥박쓰기, 맥박갱신, 알릴까, 알림글, 묵었나, 한국날짜, 작업표, 맥박길 } from '../lib/jikimi.mjs';

const 인 = process.argv.slice(2);
const 값 = (이름) => (인.find((x) => x.startsWith(`--${이름}=`)) ?? '').split('=').slice(1).join('=');
const 보낸다 = 인.includes('--bonaenda');
const 받는이 = 값('batneuni') || 'pyh@teamjpk.com';
const 길 = 값('maekbak') || 맥박길;
const 지금 = 값('jigeum') ? Date.parse(값('jigeum')) : Date.now();

const 오늘 = 한국날짜(지금);
let 맥박 = 맥박읽기(길);
/** ★--gangje=작업명 — 표의 지켜본다 와 무관하게 그 작업만 본다. «시험용»이다.
 *  (작업이 전부 꺼져 있는 지금, 「묵었다」가 실제로 잡히는지 확인하려면 이게 있어야 한다.
 *   예약에는 절대 이 플래그를 붙이지 않는다 — 켜는 것은 작업표의 지켜본다 로 한다.) */
const 강제 = 값('gangje');
const 볼것 = Object.entries(작업표).filter(([이름, v]) => (강제 ? 이름 === 강제 : v.지켜본다));

console.log(`[지킴이 점검] ${new Date(지금 + 9 * 36e5).toISOString().slice(0, 19)} (KST) · 맥박 ${길}`);
if (!볼것.length) {
  console.log('   지켜보는 작업이 없다 — lib/jikimi.mjs 작업표의 지켜본다 가 전부 false 다.');
  console.log('   ★작업을 실제로 켤 때 그 줄을 true 로 바꾼다. (켜지도 않은 작업을 매일 「묵었다」고 알리면 사람이 알림을 끈다)');
}

for (const [작업, 규격] of 볼것) {
  const 칸 = 맥박?.작업?.[작업] ?? null;
  const 잼 = 묵었나({ 마지막성공: 칸?.마지막성공, 한계시간: 규격.한계시간, 지금 });
  if (잼.모른다) { console.log(`   ${작업} — 모른다: ${잼.까닭}`); continue; }
  if (!잼.묵었다) { console.log(`   ${작업} — 괜찮다 (${잼.까닭})`); continue; }

  const { 알린다, 까닭 } = 알릴까({ 지난: { ...칸, 상태: 칸?.상태 === '묵음' ? '묵음' : (칸?.상태 ?? null) }, 상태: '묵음', 오늘 });
  console.log(`   ${작업} — ★묵었다 (${잼.까닭}) · 알린다=${알린다} (${까닭})`);
  if (!알린다) continue;

  const { 제목, 본문 } = 알림글({
    작업, 상태: '묵음', 코드: null,
    때: new Date(지금 + 9 * 36e5).toISOString().replace('T', ' ').slice(0, 19) + ' (KST)',
    까닭,
    덧붙임: [
      `마지막 성공  ${칸?.마지막성공 ?? '모름'}`,
      `기대 주기    ${규격.주기시간}시간 (한계 ${규격.한계시간}시간)`,
      '',
      '★맥박이 묵었다 — 이 검사는 «마지막 성공»만 본다. 그러니 「안 떴다」와 「떴다가 실패했다」를',
      '  구별하지 못한다. 둘 다 성공 기록을 안 남기기 때문이다. 어느 쪽인지는 아래 로그로 가른다.',
      '  (실제로 2026-09-17 aiops-light 는 «떠서 429 로 자빠진» 경우였는데, 예전 문구는 이것을',
      '   「아예 뜨지 않았다」고 단정해 엉뚱한 곳을 보게 만들었다.)',
      '  스케줄러에서 작업이 꺼져 있는지,',
      '  PC 가 꺼져 있었는지, 조건(전원·네트워크)에 걸려 건너뛰었는지를 본다.',
    ],
  });
  console.log(`\n──── ${제목}\n${본문}\n────`);

  let 보냈나 = false;
  if (보낸다) {
    fs.mkdirSync('tmp', { recursive: true });
    const 본문길 = `tmp/jikimi-mugeum-${작업}-${오늘}.txt`;
    fs.writeFileSync(본문길, 본문, 'utf8');
    try {
      execFileSync('python', ['C:/dev/mailtool/send_mail.py',
        '--to', 받는이, '--subject', 제목, '--body-file', 본문길, '--from-name', 'aiops'],
        { encoding: 'utf8', timeout: 120000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
      보냈나 = true;
      console.log(`   보냈다 — ${받는이}`);
    } catch (e) {
      console.log(`   ★못 보냈다 — ${String(e.stdout || e.message).slice(0, 200)} · 본문은 ${본문길}`);
    }
  } else {
    console.log('   ※ 실제로 보내려면 --bonaenda (지금은 안 보냈다)');
  }

  // 상태만 「묵음」으로 옮긴다. ★마지막성공은 건드리지 않는다(갱신 함수가 그대로 물려준다)
  맥박 = 맥박갱신(맥박, { 작업, 상태: '묵음', 코드: null, 때: new Date(지금 + 9 * 36e5).toISOString().replace('T', ' ').slice(0, 19) + ' (KST)', 때ISO: new Date(지금).toISOString(), 알렸나: 보냈나, 오늘 });
}

맥박쓰기(맥박, 길);
