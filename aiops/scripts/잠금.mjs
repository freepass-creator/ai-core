#!/usr/bin/env node
/**
 * ★잠금 — 지금 «누가 무엇을 쥐고 있나». 막혔을 때 여는 곳.
 *
 * 대표(2026-08-30): 「쓰기 이런 거 이제 다 권한 풀어」
 *   → 권한은 다 풀었다. 남은 건 «동시에 두 손이 들어가는 것» 을 막는 차례뿐이다.
 *     그런데 그 차례에 막혔을 때 «누구 때문인지» 볼 자리가 없었다. 그래서 만든다.
 *
 *   node scripts/잠금.mjs            누가 쥐고 있나
 *   node scripts/잠금.mjs --푼다      ★만료된 것만 걷어낸다 (살아 있는 것은 안 건드린다)
 *   node scripts/잠금.mjs --다푼다     ★★살아 있는 것까지 전부. 정말 막혔을 때만
 */
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { appendAudit, coordinationDir, listLeases } from '../lib/lease.mjs';

const 푼다 = process.argv.includes('--푼다');
const 다푼다 = process.argv.includes('--다푼다');

const 목 = await listLeases();

if (!목.length) {
  console.log('\n  잠긴 것이 없다. 그냥 쓰면 된다.\n');
  process.exit(0);
}

console.log(`\n★ 지금 잠긴 것 ${목.length}\n`);
for (const x of 목) {
  const 언제 = x.heartbeatAt || x.acquiredAt || '?';
  console.log(`  ${x.expired ? '★만료' : '  살아'} │ ${x.target}`);
  console.log(`         ${x.agent}/${x.taskId} — ${x.purpose}`);
  console.log(`         마지막 숨 ${String(언제).slice(0, 19).replace('T', ' ')}${x.expired ? '  ← 끝난 작업이다. 걷어내도 된다' : ''}`);
}

const 만료 = 목.filter((x) => x.expired);

if (!푼다 && !다푼다) {
  console.log('');
  if (만료.length) console.log(`  ★만료된 것 ${만료.length}개가 있다 — node scripts/잠금.mjs --푼다`);
  else console.log('  전부 살아 있다. 그쪽 작업이 끝나기를 기다리거나, 정 급하면 --다푼다');
  console.log('');
  process.exit(0);
}

/** lease 경로는 자원 이름의 sha256 이다 (lib/lease.mjs 와 같은 규칙) */
const 뿌리 = coordinationDir();
const 길 = (target) => join(뿌리, 'leases', createHash('sha256').update(target).digest('hex'));

const 걷을것 = 다푼다 ? 목 : 만료;
if (!걷을것.length) { console.log('\n  걷어낼 것이 없다.\n'); process.exit(0); }

let 센다 = 0;
for (const x of 걷을것) {
  try {
    await rm(길(x.target), { recursive: true, force: true });
    await appendAudit({ type: 다푼다 ? 'lease-forced-clear' : 'lease-expired-clear', target: x.target, was: { agent: x.agent, taskId: x.taskId } });
    console.log(`  걷어냄  ${x.target}  (${x.agent}/${x.taskId})`);
    센다 += 1;
  } catch (e) {
    console.error(`  ★못 걷어냄  ${x.target} — ${e.message}`);
  }
}
console.log(`\n  ${센다}개 걷어냈다. 이제 쓰면 된다.\n`);
