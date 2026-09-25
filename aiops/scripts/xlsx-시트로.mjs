/** ★xlsx 를 «구글 시트로» 바꿔 복사한다 — 원본은 건드리지 않는다.
 *
 *  ── 왜 있나
 *  대표가 올린 사업현황이 xlsx 이면 Sheets API 가 못 읽는다("must not be an Office file").
 *  ★2026-09-02: 그래서 손오공 «최신» 사업현황을 못 읽고 «폐기 구버전» 을 읽고 있었다.
 *
 *  ★원본 xlsx 는 그대로 둔다. 변환본을 «따로» 만든다 — 원본이 정본이고 이것은 읽기 창구다.
 *
 *    node scripts/xlsx-시트로.mjs <파일id> [--이름="…"]        계획만
 *    node scripts/with-lease.mjs --resource drive -- node scripts/xlsx-시트로.mjs <파일id> --만든다
 */
import { drive } from '../lib/drive.mjs';

const 인자 = process.argv.slice(2);
const 파일id = 인자.find((x) => !x.startsWith('--'));
const 값 = (k) => { const a = 인자.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : ''; };
if (!파일id) { console.log('  node scripts/xlsx-시트로.mjs <파일id> [--이름="…"] [--만든다]'); process.exit(1); }

const d = await drive();
const 원본 = await d.call(`https://www.googleapis.com/drive/v3/files/${파일id}?fields=name,mimeType,size,parents,driveId&supportsAllDrives=true`);
if (!/spreadsheetml|ms-excel/.test(원본.mimeType)) {
  console.log(`★엑셀 파일이 아니다: ${원본.name} (${원본.mimeType})`);
  process.exit(1);
}
const 새이름 = 값('이름') || `${String(원본.name).replace(/\.(xlsx|xls)$/i, '')} [시트변환]`;
console.log(`원본 : ${원본.name}  ${(Number(원본.size) / 1e6).toFixed(1)}MB`);
console.log(`새것 : ${새이름}  (구글 시트)`);
console.log(`자리 : 같은 폴더 ${원본.parents?.[0] ?? '(모름)'}`);
console.log('★원본은 그대로 둔다. 새 파일을 하나 만든다.');
if (!인자.includes('--만든다')) { console.log('\n실제로 만들려면 --만든다 (lease 안에서)'); process.exit(0); }

const 만든것 = await d.call(`https://www.googleapis.com/drive/v3/files/${파일id}/copy?supportsAllDrives=true&fields=id,name,mimeType`, {
  method: 'POST',
  body: JSON.stringify({ name: 새이름, mimeType: 'application/vnd.google-apps.spreadsheet', parents: 원본.parents }),
});
console.log(`\n★만들었다: ${만든것.id}\n   ${만든것.name}\n   https://docs.google.com/spreadsheets/d/${만든것.id}/edit`);
