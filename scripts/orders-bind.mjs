// 오더를 업무에 묶는 «부르는 길».
//
// ★2026-09-17: order-work-binder.mjs 를 만들어 놓고 부르는 곳이 «0개» 였다.
//   묶으려면 손으로 스크립트를 써야 했다 — 그건 아무도 안 쓴다는 뜻이다.
//
// 쓰는 법
//   node scripts/orders-bind.mjs                                  무엇이 묶여 있나
//   node scripts/orders-bind.mjs --order ORD-… --work DEV-001 \
//        --project ai-core --revision <40자 sha>                  묶는다
//
// ★판정하지 않는다. adapter.linkOrder 가 registry·원장·컨트롤타워에 대고 검증하고,
//   거절하면 그 거절을 «그대로» 보여준다. 이 도구는 그 답을 옮길 뿐이다.
// ★묶어도 아무 권한이 생기지 않는다 — 「이 오더가 그 업무에 관한 것이다」일 뿐이다.

import { readFile } from 'node:fs/promises';
import { OrderStore, defaultDb } from '../src/orders/store.mjs';
import { createOrderWorkAdapter } from '../src/integration/order-work-adapter.mjs';
import { createOrderWorkContextReader } from '../src/integration/order-work-context-reader.mjs';
import { createOrderWorkBinder } from '../src/integration/order-work-binder.mjs';
import { readOrderMappingInventory, hasBindingTable } from '../src/integration/order-mapping-inventory.mjs';
import { defaultWorkLedgerPath } from '../src/integration/order-work-sources.mjs';
import { verifyLedgerText } from './work-ledger.mjs';
import { runControlTower } from './run-control-tower.mjs';

const 인 = process.argv.slice(2);
const 값 = (이름) => { const i = 인.indexOf(이름); return i < 0 ? null : 인[i + 1] ?? null; };

const dbPath = 값('--db') ?? process.env.AI_CORE_ORDERS_DB ?? defaultDb;
const store = new OrderStore(dbPath);
const 끝내기 = (코드) => { store.close(); process.exit(코드); };

// ── 아무 인자도 없으면 «지금 무엇이 묶여 있나» 를 보여준다
if (!인.length || 인.includes('--help')) {
  console.log(`오더 DB: ${dbPath}\n`);
  const 오더 = store.list();
  console.log(`오더 ${오더.length}건`);
  for (const o of 오더.slice(0, 10)) console.log(`   ${o.id}  rev ${o.revision}/ver ${o.version}  ${String(o.title).slice(0, 34)}`);
  const 묶임 = hasBindingTable(store.db) ? readOrderMappingInventory(store.db) : null;
  console.log(`\n묶임 ${묶임 === null ? '— 표가 아직 없다(아무것도 묶인 적 없다)' : `${묶임.length}건`}`);
  for (const m of 묶임 ?? []) console.log(`   ${m.order_id}  ↔  ${m.work_id}  (${m.project_id})`);
  console.log('\n묶으려면:  --order <ORD-…> --work <WORK-001> --project <아이디> --revision <40자 sha>');
  끝내기(0);
}

const orderId = 값('--order');
const workId = 값('--work');
const projectId = 값('--project');
const revision = 값('--revision');
if (!orderId || !workId || !projectId || !revision) {
  console.error('★--order · --work · --project · --revision 이 모두 필요하다');
  console.error('  ★revision 은 그 업무가 «관측된» subject revision 이다. 지어내지 마라 —');
  console.error('    registry 의 head_revision 이나 원장 사건에서 가져온다.');
  끝내기(2);
}

// ── 원천은 규약 자리에서 읽는다. 없으면 «없다» 고 말하고 선다.
const registryPath = 값('--registry') ?? 'registry/projects.json';
const snapshotPath = 값('--snapshot');
const ledgerPath = 값('--ledger') ?? defaultWorkLedgerPath(dbPath);
if (!snapshotPath) {
  console.error('★--snapshot 이 필요하다 — 업무 현황 스냅샷 없이는 무엇을 묶는지 판단할 수 없다.');
  console.error('  만드는 법:  node scripts/derive-control-snapshot.mjs <ledger> <registry> <as-of>');
  끝내기(2);
}

const 읽기 = async (길, 무엇) => {
  try { return JSON.parse(await readFile(길, 'utf8')); }
  catch (e) { console.error(`★${무엇}을 못 읽었다 (${e.code ?? e.message}): ${길}`); 끝내기(2); return null; }
};

const registry = await 읽기(registryPath, 'registry');
const snapshot = await 읽기(snapshotPath, 'snapshot');
const readLedgerText = () => readFile(ledgerPath, 'utf8');
try { await readLedgerText(); }
catch (e) { console.error(`★원장을 못 읽었다 (${e.code ?? e.message}): ${ledgerPath}`); 끝내기(2); }

const mappings = () => (hasBindingTable(store.db) ? readOrderMappingInventory(store.db) : []);
const adapter = createOrderWorkAdapter({
  readContext: createOrderWorkContextReader({ store, registry, snapshot, mappings, readLedgerText }),
  verifyLedgerText,
  runControlTower,
});

const r = await createOrderWorkBinder({ store, adapter })({
  order_id: orderId, work_id: workId, project_id: projectId, subject_revision: revision,
});

if (r?.status === 'LINKED') {
  console.log(`✔ ${r.persisted ? '묶었다' : '이미 묶여 있다 (아무것도 안 바꿨다)'}`);
  console.log(`   ${orderId}  ↔  ${workId}  (${projectId})`);
  console.log('   ★묶었다고 권한이 생기지는 않는다 — 실행·종료는 컨트롤타워가 따로 본다.');
  끝내기(0);
}
// ★거절은 adapter 가 말한 그대로 옮긴다. 부드럽게 바꾸지 않는다.
console.error(`★안 묶었다 — ${r?.status ?? '?'} / ${r?.reason ?? '까닭 없음'}`);
끝내기(1);
