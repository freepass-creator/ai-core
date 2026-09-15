import { readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { OrderStore, actors } from '../src/orders/store.mjs';
import { RemoteOrderClient, connectionOptions, localConnectionPath } from '../src/orders/client.mjs';

const readJson = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
let store;
try {
  const args = process.argv.slice(2), options = {};
  while (args[0]?.startsWith('--')) {
    const flag = args.shift();
    if (flag === '--local') options.local = true;
    else if (['--db', '--endpoint', '--ledger'].includes(flag)) {
      if (!args[0] || args[0].startsWith('--')) throw new Error(`${flag} requires a value`);
      options[flag.slice(2)] = args.shift();
    } else throw new Error(`Unknown option: ${flag}`);
  }
  const [action, first, second] = args;
  if (!action || action === 'help') {
    console.log(`AI Core 공통 오더 CLI (Node 24.19 이상)\nnode scripts/orders.mjs [--endpoint URL] <command>\n  connect URL                  이 장치의 중앙 원장 연결 저장\n  meta                         원장 ID와 연결 방식 확인\n  list                         전체 오더\n  show ORDER_ID                최신 오더와 이벤트\n  create INPUT.json            오더 접수 (requestId 포함)\n  act ORDER_ID COMMAND.json    담당·확보·대기·결과·수정·완료\n  packet ORDER_ID TASK_ID       AI 공통 인계 JSON\n  actors                       AI별 강점\n  name DISPLAY_NAME            표시 이름 변경\n  export                       열람용 오더·이벤트 JSON\n\n로컬·서버 모두 같은 명령과 중앙 원장을 사용합니다.\n연결 설정이 없거나 서버가 응답하지 않으면 중단하며 로컬 DB를 만들지 않습니다.\n독립 실험만 --local --db PATH로 실행합니다.\n원격 서버는 SSH 터널로 접속합니다. docs/SHARED_ORDER_EXECUTION.md 참고.`);
  } else if (action === 'actors') console.log(JSON.stringify(actors, null, 2));
  else {
    if ((options.local && (options.endpoint || action === 'connect')) || (options.db && !options.local)) throw new Error('독립 로컬 DB와 공유 연결 옵션은 함께 사용할 수 없습니다.');
    if (options.local && !options.db) throw new Error('독립 실험은 --local --db PATH로 원장 파일을 명시하세요.');
    let client;
    if (options.local) { store = new OrderStore(options.db); client = store; }
    else client = new RemoteOrderClient(connectionOptions({ endpoint: action === 'connect' ? first : options.endpoint, ledgerId: options.ledger }));
    let result;
    if (action === 'connect') {
      const meta = await client.meta();
      if (meta.mode !== 'SHARED_PRIVATE_SERVICE') throw new Error('공유 서버가 아닌 독립 실험 원장에는 기본 연결을 저장할 수 없습니다.');
      mkdirSync(dirname(localConnectionPath), { recursive: true });
      const temp = `${localConnectionPath}.${randomUUID()}.tmp`;
      writeFileSync(temp, JSON.stringify({ endpoint: client.endpoint, ledgerId: client.ledgerId }, null, 2));
      renameSync(temp, localConnectionPath);
      result = { connected: true, endpoint: client.endpoint, ledgerId: client.ledgerId, mode: meta.mode };
    } else if (action === 'meta') result = store ? { ...store.settings(), ledgerId: store.ledgerId(), mode: 'STANDALONE_EXPERIMENT' } : await client.meta();
    else if (action === 'list') result = await client.list();
    else if (action === 'show') result = store ? { order: store.get(first), events: store.events(first) } : await client.show(first);
    else if (action === 'create') result = await client.create(readJson(first));
    else if (action === 'act') result = await client.mutate(first, readJson(second));
    else if (action === 'packet') result = await client.packet(first, second);
    else if (action === 'name') result = await client.name(first);
    else if (action === 'export') {
      const orders = await client.list();
      const entries = [];
      for (const order of orders) entries.push(store ? { order, events: store.events(order.id) } : await client.show(order.id));
      result = { schema: 'ai-core-export/v1', exportedAt: new Date().toISOString(), ledgerId: store ? store.ledgerId() : client.ledgerId, orders: entries };
    } else throw new Error('Unknown command. Use help.');
    console.log(JSON.stringify(result, null, 2));
  }
} catch (e) { console.error(JSON.stringify({ error: e.code ?? 'ERROR', message: e.message })); process.exitCode = 1; }
finally { store?.close(); }
