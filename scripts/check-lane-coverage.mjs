#!/usr/bin/env node
// lane 지도에 «공백»이 없는지 본다. 있으면 FAIL 한다.
//
// ★대표 2026-09-28: 「어떤 구분값을 다 이렇게 공백이 없게끔 처리할 수 있는 방법으로 가야 될 것 같아」
//
//   지도를 «잘 그리는» 것으로는 안 된다. 초안을 재 보니 추적 파일 1,182개 중 931개(78.8%)가
//   어느 lane 에도 안 걸렸다. 새 폴더가 생길 때마다 다시 벌어지고, 공백은 눈에 안 보이니 아무도 안 고친다.
//   그래서 «공백을 금지»하는 대신 «공백이면 빨개지게» 만든다. 이 파일이 그 자리다.
//
//   node scripts/check-lane-coverage.mjs                    본다
//   node scripts/check-lane-coverage.mjs --write-codeowners  .github/CODEOWNERS 를 지도에서 다시 만든다
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { laneOf, 덮임검사, 사문검사, codeowners, 문서표, 문서에끼우다 } from '../src/governance/lane-map.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const 지도읽기 = () => JSON.parse(readFileSync(resolve(root, 'registry/lanes.json'), 'utf8'));
export const 추적파일 = () =>
  execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
    .trim().split('\n').filter(Boolean);

/** 소유자는 지금 둘뿐이다. lane 에 «작업별 단일 책임자»를 두라는 Codex 답을 따르되,
 *  CODEOWNERS 는 리뷰가 비지 않게 하는 것이 목적이므로 계정 하나로 채운다. */
const 소유자 = { I: '@freepass-creator', E: '@freepass-creator', F: '@freepass-creator', U: '@freepass-creator' };

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const 지도 = 지도읽기();
  const 파일 = 추적파일();
  const { 공백, lane별, 덮인수, 전체 } = 덮임검사(파일, 지도);
  const 사문 = 사문검사(파일, 지도);

  console.log(`추적 파일 ${전체}개 · 덮임 ${덮인수} (${(덮인수 / 전체 * 100).toFixed(1)}%)`);
  for (const [코드, lane] of Object.entries(지도.lanes)) {
    const n = (lane별[코드] ?? []).length;
    console.log(`  ${코드} ${lane.title.padEnd(6)} ${String(n).padStart(5)}${lane.dormant ? '  (잠금)' : ''}`);
  }

  if (process.argv.includes('--write-codeowners')) {
    const 길 = resolve(root, '.github/CODEOWNERS');
    mkdirSync(dirname(길), { recursive: true });
    writeFileSync(길, codeowners(지도, 소유자));
    console.log(`\nCODEOWNERS 다시 만듦: .github/CODEOWNERS`);

    /** 문서의 lane 표도 «같은 지도»에서 만든다. 둘을 따로 쓰면 어긋나고 그 어긋남이 새 공백이다. */
    const 문서길 = resolve(root, 'docs/UFEI-OPERATING-MODEL.md');

    writeFileSync(문서길, 문서에끼우다(readFileSync(문서길, 'utf8'), 문서표(지도)));
    console.log('운영 모델 문서 표 다시 만듦: docs/UFEI-OPERATING-MODEL.md');
  }

  const 잘못 = [];
  if (공백.length) {
    /** ★여기가 요점이다. 공백은 「나중에 정하자」가 아니라 지금 빨개지는 고장이다. */
    잘못.push(`lane 이 없는 파일 ${공백.length}개 — registry/lanes.json 에 규칙을 더해라`);
    const 묶음 = {};
    for (const f of 공백) { const k = f.split('/').slice(0, 2).join('/'); 묶음[k] = (묶음[k] ?? 0) + 1; }
    for (const [k, n] of Object.entries(묶음).sort((a, b) => b[1] - a[1]).slice(0, 12)) console.error(`    ${String(n).padStart(5)}  ${k}`);
  }
  if (사문.length) {
    /** 앞 규칙이 늘 먼저 가져가서 한 번도 못 이기는 줄. 있는 척하는 분류라 지우거나 위로 올려야 한다. */
    잘못.push(`한 번도 이기지 못하는 규칙 ${사문.length}줄 — 지우거나 위로 올려라`);
    for (const x of 사문) console.error(`    ${x.lane}  ${x.pattern}`);
  }

  if (잘못.length) {
    for (const e of 잘못) console.error(`FAIL: ${e}`);
    process.exit(1);
  }
  console.log('\nPASS: 공백 없음 · 죽은 규칙 없음');
}
