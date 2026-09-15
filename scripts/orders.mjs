import { readFileSync } from 'node:fs';
import { OrderStore, defaultDb, actors } from '../src/orders/store.mjs';

const args = process.argv.slice(2);
let dbPath = defaultDb;
if (args[0] === '--db') { args.shift(); dbPath = args.shift(); if (!dbPath) throw new Error('--db requires a path'); }
const [action, first, second] = args;
if (!action || action === 'help') {
  console.log(`AI Core 오더 CLI (Node 24 이상)\nnode scripts/orders.mjs [--db PATH] <command>\n  list                         전체 오더\n  show ORDER_ID                최신 오더와 이벤트\n  create INPUT.json            오더 접수 (requestId 포함)\n  act ORDER_ID COMMAND.json    배정·확보·인계 대기·결과·수정·완료\n  packet ORDER_ID TASK_ID       모든 AI가 읽는 공통 인계 JSON\n  actors                       AI별 강점과 연결 방식\n  name DISPLAY_NAME            표시 이름 변경\n  export                       전체 오더·이벤트 JSON 출력\n\n기본 원장: ${defaultDb}\n자동 외부 AI 호출·배포·발송은 수행하지 않습니다. docs/ORDER_GUIDE.md 참고.`);
} else {
  const store = new OrderStore(dbPath);
  try {
    let result;
    if (action === 'list') result = store.list();
    else if (action === 'show') result = { order: store.get(first), events: store.events(first) };
    else if (action === 'create') result = store.create(JSON.parse(readFileSync(first, 'utf8').replace(/^\uFEFF/, '')));
    else if (action === 'act') result = store.mutate(first, JSON.parse(readFileSync(second, 'utf8').replace(/^\uFEFF/, '')));
    else if (action === 'packet') result = store.packet(first, second);
    else if (action === 'actors') result = actors;
    else if (action === 'name') result = store.name(first);
    else if (action === 'export') result = { schema: 'ai-core-export/v1', exportedAt: store.stamp(), settings: store.settings(), orders: store.list().map(order => ({ order, events: store.events(order.id) })) };
    else throw new Error('Unknown command. Use help.');
    console.log(JSON.stringify(result, null, 2));
  } catch (e) { console.error(JSON.stringify({ error: e.code ?? 'ERROR', message: e.message })); process.exitCode = 1; }
  finally { store.close(); }
}
