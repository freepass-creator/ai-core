/** 데이터센터 드라이브 잠그기 — 밖으로 나가는 길을 막고, 대표만 organizer 로 둔다.
 *
 *  대표(2026-08-22): 「외부 공유 차단하고 그렇게 해줘」 / 「안전하게 해줘」
 *
 *  ── 왜
 *  계약서·신분증이 이 드라이브에 있다. 워크내비(ERP) 문은 잠갔지만
 *  **드라이브가 열려 있으면 그쪽으로 그대로 나간다.** 게다가 그 경로는 우리 열람 기록에 안 남는다.
 *  2026-08-22 실측: `domainUsersOnly:false` · `driveMembersOnly:false` · 멤버 6명 전원 organizer.
 *
 *  ── 무엇을 바꾸나
 *   ① 밖으로 나가는 길 셋을 막는다
 *   ② 대표(pyh) 만 organizer, 나머지는 fileOrganizer(= 콘텐츠 관리자)
 *      fileOrganizer 도 올리고·옮기고·지우는 건 다 된다. 못 하게 되는 건
 *      **드라이브 설정 변경과 멤버 추가/제거**뿐이라 업무에는 지장이 없다.
 *
 *  ── 쓰는 법
 *    node drive/dc-lock.mjs            # 보기만 한다 (아무것도 안 바꾼다)
 *    node drive/dc-lock.mjs --apply    # 바꾼다 — codex lease 가 필요하다
 *
 *  되돌릴 값: `tmp/drive-before-2026-08-22.json` (2026-08-22 받아 둠)
 *  되돌리려면 그 파일의 restrictions·role 을 그대로 PATCH 하면 된다.
 */
import { token, makeCall } from '../lib/goog.mjs';
import { assertInheritedCodexLease } from '../lib/lease.mjs';
import { DRIVE } from '../lib/ids.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const 적용 = process.argv.includes('--apply');
const ID = DRIVE.데이터센터;
const 대표 = 'pyh@teamjpk.com';
const 대상 = new Set(['ksm@teamjpk.com', 'sym@teamjpk.com', 'pty@teamjpk.com', 'kjs@teamjpk.com', 'ydyang@teamjpk.com']);

/** 밖으로 나가는 길 — 셋 다 막는다 */
const 새제한 = {
  domainUsersOnly: true,                           // 회사 밖 사람과 공유 금지
  driveMembersOnly: true,                          // 멤버 아닌 사람은 개별 파일도 못 봄
  sharingFoldersRequiresOrganizerPermission: true, // 폴더 공유는 대표만
};

const call = makeCall(await token());
const 드라이브URL = `https://www.googleapis.com/drive/v3/drives/${ID}?fields=name,restrictions`;
const 권한URL = (pageToken = '') => `https://www.googleapis.com/drive/v3/files/${ID}/permissions?supportsAllDrives=true&fields=nextPageToken,permissions(id,type,role,emailAddress)&pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;

if (적용) await assertInheritedCodexLease(['drive']);

async function 모든권한() {
  const permissions = [];
  let pageToken = '';
  do {
    const page = await call(권한URL(pageToken));
    permissions.push(...(page.permissions ?? []));
    pageToken = page.nextPageToken ?? '';
  } while (pageToken);
  return permissions;
}

function 이메일(p) { return String(p.emailAddress ?? '').trim().toLowerCase(); }
function 같은역할인가(permissions) {
  const organizers = permissions.filter((p) => p.role === 'organizer').map(이메일).sort();
  return organizers.length === 1 && organizers[0] === 대표;
}

async function 실행주체확인() {
  const about = await call('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)');
  if (String(about.user?.emailAddress ?? '').toLowerCase() !== 대표) {
    throw new Error(`실행 주체가 대표 대행 계정이 아닙니다: ${about.user?.emailAddress ?? '알 수 없음'}`);
  }
}

const 전d = await call(드라이브URL);
const 전p = await 모든권한();

// 라이브 변경은 현재 오더가 지정한 여섯 사람뿐일 때만 허용한다.
const organizerEmails = 전p.filter((p) => p.role === 'organizer').map(이메일).sort();
const expectedOrganizers = [대표, ...대상].sort();
if (organizerEmails.join('|') !== expectedOrganizers.join('|')) {
  throw new Error(`organizer 대상이 오더와 다릅니다: ${organizerEmails.join(', ') || '없음'}`);
}
if (전p.some((p) => p.role === 'organizer' && p.type !== 'user')) {
  throw new Error('사용자 아닌 organizer 권한이 있어 오더 범위를 확정할 수 없습니다.');
}

// 라이브 실행마다 고유 백업을 남긴다. 보기만 하는 실행은 기존 백업을 덮지 않는다.
const stamp = new Date(Date.now() + 9 * 36e5).toISOString().replace(/[:.]/g, '-');
const backupDir = process.env.AIOPS_TMP_DIR || 'tmp';
const 백업 = join(backupDir, `drive-before-${stamp}.json`);
if (적용) {
  mkdirSync(backupDir, { recursive: true });
  writeFileSync(백업, JSON.stringify({ 드라이브: 전d, 권한: { permissions: 전p } }, null, 1), { encoding: 'utf8', flag: 'wx' });
}

console.log(`\n═══ ${전d.name} ${적용 ? '' : '(보기만 — 바꾸려면 --apply)'} ═══`);
console.log(`되돌릴 값: aiops/${백업}\n`);

// ── ① 밖으로 나가는 길 ──
console.log('── 밖으로 나가는 길 ──');
for (const [k, v] of Object.entries(새제한)) {
  const 지금 = 전d.restrictions?.[k];
  console.log(`  ${지금 === v ? '이미 막힘' : '막는다  '}  ${k}  (${지금} → ${v})`);
}
if (적용) {
  await 실행주체확인();
  const 후 = await call(드라이브URL, { method: 'PATCH', body: JSON.stringify({ restrictions: 새제한 }) });
  const 안된것 = Object.entries(새제한).filter(([k, v]) => 후.restrictions?.[k] !== v);
  if (안된것.length) throw new Error(`안 바뀐 것: ${안된것.map(([k]) => k).join(', ')}`);
  const 바뀌면안되는것 = Object.entries(전d.restrictions ?? {}).filter(([k]) => !(k in 새제한));
  const 손상 = 바뀌면안되는것.filter(([k, v]) => JSON.stringify(후.restrictions?.[k]) !== JSON.stringify(v));
  if (손상.length) throw new Error(`제한의 기존 값이 바뀌었습니다: ${손상.map(([k]) => k).join(', ')}`);
  console.log('  → 막혔다');
}

// ── ② 멤버 권한 ──
console.log('\n── 멤버 권한 ──');
for (const p of 전p) {
  const 누구 = p.emailAddress ?? p.type;
  if (이메일(p) === 대표) { console.log(`  그대로  organizer      ${누구}  (대표)`); continue; }
  if (p.role !== 'organizer') { console.log(`  그대로  ${String(p.role).padEnd(14)} ${누구}`); continue; }
  console.log(`  ${적용 ? '낮춘다' : '낮출 것'}  organizer → fileOrganizer   ${누구}`);
  if (적용) {
    await call(`https://www.googleapis.com/drive/v3/files/${ID}/permissions/${p.id}?supportsAllDrives=true`,
      { method: 'PATCH', body: JSON.stringify({ role: 'fileOrganizer' }) });
  }
}

if (적용) {
  const 후p = await 모든권한();
  if (!같은역할인가(후p)) throw new Error(`최종 organizer 검증 실패: ${후p.filter((p) => p.role === 'organizer').map((p) => p.emailAddress ?? p.type).join(', ') || '없음'}`);
  const 역할오류 = 후p.filter((p) => 대상.has(이메일(p)) && p.role !== 'fileOrganizer');
  if (역할오류.length) throw new Error(`대상 멤버 역할 검증 실패: ${역할오류.map((p) => p.emailAddress).join(', ')}`);
  console.log('\n확인: organizer 대표 하나뿐 · 대상 다섯 명 fileOrganizer');
} else {
  console.log('\n아무것도 안 바꿨다. 바꾸려면 --apply (codex lease 필요)');
}
