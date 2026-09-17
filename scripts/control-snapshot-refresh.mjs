// 운영 스냅샷을 규약 자리에 다시 «뽑아» 둔다.
//
// ★derive-control-snapshot.mjs 는 stdout 으로 뱉는다. 그래서 쓰려면 매번 원장 자리·
//   as-of 를 손으로 적어 리다이렉트해야 했고, 그건 «아무도 안 쓴다» 는 뜻이다.
//   여기서 그 세 가지를 규약으로 못 박아 한 줄로 만든다.
//
//   npm run control:snapshot
//
// ★스냅샷은 아무 권한도 주지 않는다. 원장이 아는 것(어떤 업무가 있나·어느 리비전에서
//   관측됐나)만 채우고 나머지는 「아무도 선언 안 함」으로 남긴다. 그 빈칸을 채우는 것은
//   registry/directions.json 의 «서명된 방향» 이고, 그것도 원장에 승인 사건이 있어야 한다.

import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultWorkLedgerPath } from '../src/integration/order-work-sources.mjs';
import { defaultDb } from '../src/orders/store.mjs';

const 뿌리 = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const 인 = process.argv.slice(2);
const 값 = (이름) => { const i = 인.indexOf(이름); return i < 0 ? null : 인[i + 1] ?? null; };

const 원장 = 값('--ledger') ?? defaultWorkLedgerPath(process.env.AI_CORE_ORDERS_DB || defaultDb);
const 등록부 = 값('--registry') ?? join(뿌리, 'registry', 'projects.json');
const 나갈곳 = 값('--out') ?? join(dirname(원장), 'control-snapshot.json');
const asOf = 값('--as-of') ?? new Date().toISOString().replace(/\.\d+Z$/, 'Z');

const 파일 = createWriteStream(나갈곳);
const 아이 = spawn(process.execPath, [join(뿌리, 'scripts', 'derive-control-snapshot.mjs'), 원장, 등록부, asOf],
  { stdio: ['ignore', 'pipe', 'inherit'] });
아이.stdout.pipe(파일);
아이.on('exit', (코드) => {
  if (코드 === 0) console.log(`적었다: ${나갈곳}  (as_of ${asOf})`);
  process.exit(코드 ?? 1);
});
