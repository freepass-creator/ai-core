// Production wiring for the server's `readWorkProjection` socket.
//
// What this file is: the trusted application wiring that
// `createOrderWorkContextReader` deliberately refuses to construct for itself.
// It owns exactly one decision — WHERE the canonical sources live — and nothing
// about what they mean. Reading, atomicity and judgement stay where they already
// are (order-work-context-reader.mjs, order-work-adapter.mjs, run-control-tower.mjs).
//
// ★The rule that shapes this whole file: an ABSENT source is not an EMPTY source.
// The adapter answers `UNLINKED` when the mapping inventory it is handed contains
// no row for the order. If a missing mappings file were read as `[]`, every order
// would be reported `UNLINKED` — a confident, wrong answer produced by the absence
// of data rather than by the data. So each source is required, and a missing one
// yields HOLD naming that source. "모른다" is the honest answer, not "없다".
//
// Capability boundary: only `readFile` and `store.get` are used. No append, no
// outbox, no transport, no path from the request. Paths come from the connection
// policy file, which is operator-owned configuration.

import { readFile } from 'node:fs/promises';
import { resolve, isAbsolute, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOrderWorkContextReader } from './order-work-context-reader.mjs';
import { readOrderMappingInventory } from './order-mapping-inventory.mjs';
import { 방향적용 } from './direction.mjs';
import { createOrderWorkAdapter } from './order-work-adapter.mjs';
import { verifyLedgerText } from '../../scripts/work-ledger.mjs';
import { runControlTower } from '../../scripts/run-control-tower.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// Same three-file contract the control tower CLI already takes
// (scripts/run-control-tower.mjs:64), plus the mapping inventory, which has no
// CLI of its own yet. Names match that usage so operators configure one vocabulary.
export const SOURCE_KEYS = ['registry', 'snapshot', 'mappings', 'ledger'];

// Sources that have a settled home and therefore need no configured path. Both
// live with the order store because both are only meaningful about THIS
// deployment's orders — see order-mapping-inventory.mjs for the mapping case.
export const CONVENTION_KEYS = ['mappings', 'ledger'];

/** ★방향 파일도 규약으로 둔다 — registry 옆이다.
 *  방향은 «조직의 결정» 이라 registry(조직의 사실)와 같은 자리에 산다.
 *  ★없으면 방향이 하나도 없는 것과 같다 — 항목은 손대지 않고 타워가 예전처럼 센다. */
export const 방향파일 = 'registry/directions.json';

// ★Where the operating work ledger lives.
//
// It sits BESIDE the order store, not at a path chosen independently, because the
// two must describe the same deployment. An order record and a ledger event that
// came from different installations would compose into a projection that looks
// coherent and is about nothing. Tying the ledger to the DB's own directory makes
// that mismatch impossible to configure by accident.
//
// `.local/` is already gitignored, which is also correct: the ledger is
// append-only operating data. Committing it would put work history into git and
// make every parallel session conflict on the same lines.
export const WORK_LEDGER_FILENAME = 'work-ledger.jsonl';
export const defaultWorkLedgerPath = (ordersDbPath) => join(dirname(resolve(ordersDbPath)), WORK_LEDGER_FILENAME);

const hold = (reason) => ({
  status: 'HOLD', reason,
  execution_authorized: false, completion_authorized: false, sent: false,
});

/** Resolve configured source paths. Relative paths are repo-root relative so a
 *  policy file stays portable; absolute paths are taken as given. */
export function resolveWorkSourcePaths(workSources, { ordersDbPath = null } = {}) {
  if (!workSources || typeof workSources !== 'object' || Array.isArray(workSources)) return null;
  // The ledger is the one source with a settled convention, so it may be left out
  // of configuration. The others have no canonical home yet and must be named.
  const filled = { ...workSources };
  if (!filled.ledger && ordersDbPath) filled.ledger = defaultWorkLedgerPath(ordersDbPath);
  const paths = {};
  for (const key of SOURCE_KEYS) {
    // The mapping inventory is not a file at all; it is a table inside the order
    // database. An explicit path still wins, for an operator who keeps it apart.
    if (key === 'mappings' && !filled.mappings) {
      if (!ordersDbPath) return { missing: key };
      paths.mappings = null;
      continue;
    }
    const value = filled[key];
    if (typeof value !== 'string' || value.trim() !== value || !value) return { missing: key };
    paths[key] = isAbsolute(value) ? value : resolve(repoRoot, value);
  }
  return { paths };
}

/**
 * createWorkProjectionProvider({ store, workSources })
 *   -> async readWorkProjection(orderId)
 *
 * Returns null when nothing is configured, so the caller keeps the existing
 * "socket is empty" answer instead of this module inventing a different one.
 */
export function createWorkProjectionProvider({ store, workSources, ordersDbPath = null }) {
  const resolved = resolveWorkSourcePaths(workSources, { ordersDbPath });
  if (!resolved) return null;
  if (resolved.missing) {
    const reason = `WORK_SOURCE_UNCONFIGURED_${resolved.missing.toUpperCase()}`;
    return async () => hold(reason);
  }
  const { paths } = resolved;

  // Each read is attempted per request: an operator may place a source while the
  // server runs, and a source that disappears must stop producing answers.
  const readJson = async (key) => JSON.parse(await readFile(
    key === 'directions' ? resolve(repoRoot, 방향파일) : paths[key], 'utf8'));

  return async function readWorkProjection(orderId) {
    let registry, snapshot, mappings;
    if (paths.mappings === null) {
      // Read from the order store's own database. MAPPING_INVENTORY_ABSENT means
      // nothing has ever produced a binding — which is "I do not know", not "this
      // order has none". Reporting it as an empty list would make the adapter
      // answer UNLINKED with total confidence and no evidence.
      try { mappings = readOrderMappingInventory(store.db); }
      catch (error) {
        return hold(error?.message === 'MAPPING_INVENTORY_ABSENT'
          ? 'WORK_SOURCE_MISSING_MAPPINGS' : 'WORK_SOURCE_UNREADABLE_MAPPINGS');
      }
    }
    for (const key of paths.mappings === null ? ['registry', 'snapshot'] : ['registry', 'snapshot', 'mappings']) {
      try {
        const value = await readJson(key);
        if (key === 'registry') registry = value;
        else if (key === 'snapshot') snapshot = value;
        else mappings = value;
      } catch (error) {
        // ENOENT and a malformed file are different facts; keep them distinct.
        return hold(error?.code === 'ENOENT'
          ? `WORK_SOURCE_MISSING_${key.toUpperCase()}`
          : `WORK_SOURCE_UNREADABLE_${key.toUpperCase()}`);
      }
    }
    // ★The adapter reports UNLINKED from an inventory with no matching row. A
    // non-array here would otherwise be coerced into that same silence.
    if (!Array.isArray(mappings)) return hold('WORK_SOURCE_UNREADABLE_MAPPINGS');

    const readLedgerText = () => readFile(paths.ledger, 'utf8');
    let 원장글 = '';
    try { 원장글 = await readLedgerText(); }
    catch (error) {
      return hold(error?.code === 'ENOENT' ? 'WORK_SOURCE_MISSING_LEDGER' : 'WORK_SOURCE_UNREADABLE_LEDGER');
    }

    /** ★★방향을 «여기서» 입힌다 — 2026-09-17
     *
     *  대표: 「선언하기 전에는 멈춘다가 아니고 네가 자동으로 흘러가야지.
     *        그 흘러가는 방향을 내가 설정하는 거고」
     *
     *  컨트롤타워는 intent·약정·허가가 채워져야 일을 보낸다. 그걸 «항목마다 사람이»
     *  선언하면 관문 모델이 되고, 실제로 모든 항목이 영원히 HOLD 였다.
     *  방향은 그 값을 «갈래마다 한 번» 세운 대표의 결정에서 공급한다.
     *
     *  ★관문은 그대로다. 여기서 하는 일은 «입력을 채우는 것» 뿐이고, 판정은 아래
     *    runControlTower 가 예전과 똑같이 한다.
     *  ★방향이 없거나(파일 없음) 안 맞으면 항목은 «손대지 않는다» — 그러면 타워가
     *    예전처럼 세운다. 즉 이 줄을 넣어도 «방향이 서기 전까지는 아무것도 안 바뀐다».
     *  ★어느 방향이 채웠는지를 쓰지 않고 버린다 — 그건 항목에 남는 authorized_by 가
     *    이미 들고 있다(direction.mjs 가 `<방향id>/<세운이>` 로 박는다). */
    const 방향들 = await readJson('directions').then((d) => d?.방향 ?? []).catch(() => []);
    const 입힌스냅샷 = 방향들.length
      ? { ...snapshot, items: (snapshot?.items ?? []).map((항목) => 방향적용({ 항목, 방향들, asOf: snapshot?.as_of, 승인확인: 원장승인확인(원장글) }).항목) }
      : snapshot;

    const adapter = createOrderWorkAdapter({
      readContext: createOrderWorkContextReader({ store, registry, snapshot: 입힌스냅샷, mappings, readLedgerText }),
      verifyLedgerText,
      runControlTower,
    });
    return adapter.readWorkProjection(orderId);
  };
}

/** ★방향의 «승인근거» 가 정말 원장에 있는지 본다 — direction.mjs 는 이것을 «요구» 만 한다.
 *
 *  GPT 검토(2026-09-17): 「세운이:'대표' 는 결국 문자열이고 작성자 진위를 검증할 수 없다.
 *  direction 파일의 «내용만으로» 사람 승인으로 승격하면 안 된다」 — 맞는 지적이다.
 *  그 말대로면 파일을 고칠 수 있는 자는 누구나 자기에게 권한을 써 줄 수 있다.
 *
 *  그래서 새 인증체계를 만들지 않고 «이미 있는 증명» 을 재사용한다:
 *    1) 원장이 해시체인 검증을 통과해야 한다 — 지나간 줄을 몰래 못 바꾼다
 *    2) 방향이 가리킨 event_id 가 그 원장에 «실제로» 있어야 한다
 *    3) 그 사건에 RECEIVED 증거가 있어야 한다 — 「사람이 말해 준 것」이 승인의 꼴이다
 *  하나라도 없으면 방향은 «정책 후보» 로만 남고 항목은 손대지 않는다 → HOLD 그대로다.
 *
 *  ★여기서만 원장을 읽는다. direction.mjs 는 파일도 원장도 모른다 — 확인의 책임은 배선에 있다.
 *  ★이것으로 위조가 «불가능» 해지지는 않는다. 원장에 적으려면 work-recorder 를 통과해야
 *    하고 체인이 이어져야 한다는 것뿐이다. 파일 한 줄보다 비싸게 만든 것이 전부다. */
export function 원장승인확인(원장글) {
  if (verifyLedgerText(원장글 ?? '').status !== 'VALID') return () => false;
  const 사건 = new Map();
  for (const 줄 of String(원장글 ?? '').split('\n')) {
    if (!줄.trim()) continue;
    try { const e = JSON.parse(줄); if (e?.event_id) 사건.set(e.event_id, e); } catch { /* 검증이 이미 봤다 */ }
  }
  return ({ 원장사건 }) => {
    const e = 사건.get(원장사건);
    return !!e && (e.evidence_refs ?? []).some((r) => String(r).startsWith('RECEIVED:'));
  };
}
