/** 데이터센터 파일 이름 바꾸기 + 제자리 폴더로 이동. 계획 파일(JSON 배열 [{id, newName, toFolder}])을 받아 실행.
 *  사용: node dc-apply.mjs tmp/dc/plan.json        (미리보기 · 대상 폴더 목록·이름 충돌 검사)
 *        node dc-apply.mjs tmp/dc/plan.json --go   (실행)
 *  이동은 addParents/removeParents 한 번(복사 아님, 파일 id 유지). 원본은 「여기에 업로드」가 아니라 데이터센터 안의 이동이라 규칙 위반 아님.
 */
import { token, makeCall } from './lib-goog.mjs';
import { readFileSync, appendFileSync } from 'node:fs';
const call = makeCall(await token());
const [planPath, flag] = process.argv.slice(2); const GO = flag === '--go';
const plan = JSON.parse(readFileSync(planPath, 'utf8'));
const folderName = async (id) => (await call(`https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true&fields=name,parents`)).name;
const listFolder = async (id) => (await call(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${id}' in parents and trashed = false`)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name)&pageSize=200`)).files || [];
const log = [];
for (const p of plan) {
  const cur = await call(`https://www.googleapis.com/drive/v3/files/${p.id}?supportsAllDrives=true&fields=id,name,parents`);
  const from = cur.parents?.[0]; const fromName = await folderName(from); const toName = await folderName(p.toFolder);
  const siblings = await listFolder(p.toFolder); const clash = siblings.find((s) => s.name === p.newName && s.id !== p.id);
  console.log(`\n${cur.name}\n  → ${p.newName}\n  ${fromName} → ${toName}  (현재 ${siblings.length}개${clash ? ' ⚠ 같은 이름 있음 ' + clash.id : ''})`);
  if (!GO) continue;
  if (clash) { console.log('  건너뜀(충돌)'); continue; }
  const body = { name: p.newName };
  const qs = from !== p.toFolder ? `&addParents=${p.toFolder}&removeParents=${from}` : '';
  const r = await call(`https://www.googleapis.com/drive/v3/files/${p.id}?supportsAllDrives=true${qs}&fields=id,name,parents`, { method: 'PATCH', body: JSON.stringify(body) });
  console.log(`  ✓ ${r.name} @ ${r.parents?.[0]}`);
  log.push(`${new Date().toISOString().slice(0, 16)}\t${p.id}\t${cur.name}\t→\t${p.newName}\t${fromName}→${toName}`);
}
if (GO && log.length) appendFileSync('dc-moves.log', log.join('\n') + '\n');
console.log(GO ? `\n적용 ${log.length}건 · 기록 dc-moves.log` : '\n(미리보기 — 실행은 --go)');
