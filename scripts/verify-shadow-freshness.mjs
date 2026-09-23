#!/usr/bin/env node
// 그림자가 아직 원본을 비추는지 «재서» 확인하고, 움직였으면 재확인 기록을 만든다.
//
//   node scripts/verify-shadow-freshness.mjs           — 기록만으로 판정한다(네트워크 없음)
//   node scripts/verify-shadow-freshness.mjs --remote   — 원격 원본에서 blob sha 를 읽어 재확인 기록을 갱신한다
//
// 판정 근거는 src/integration/shadow-freshness.mjs 에 있다. 이 파일은 «읽고 쓰는 일»만 한다.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { 그림자신선도, 판정 } from '../src/integration/shadow-freshness.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const 읽기 = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
const 내력길 = 'shared-services/PROVENANCE.json';

/** 원격 저장소의 한 revision 에서 파일의 blob sha 를 읽는다. gh 가 있어야 하고, 없으면 그 사실을 말한다. */
const 원격blob = (저장소, 경로, revision) => {
  const out = execFileSync('gh', ['api', `repos/${저장소}/contents/${경로}?ref=${revision}`, '--jq', '.sha'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return out.trim();
};

const 원격head = (저장소) => {
  const out = execFileSync('git', ['ls-remote', '--exit-code', `https://github.com/${저장소}.git`, 'refs/heads/main'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return out.trim().split(/\s+/)[0];
};

const 내력 = 읽기(내력길);
const 프로젝트 = 읽기('registry/projects.json').projects.find((p) => p.project_id === 'aiops');
const 원격 = process.argv.includes('--remote');

/** `--head <sha>` 는 «원본이 움직였다면» 을 실제로 시험해 보기 위한 입력이다. 정본을 고치지 않고 경로를 확인한다. */
const 준head = (() => { const i = process.argv.indexOf('--head'); return i > 0 ? process.argv[i + 1] : null; })();
let 관측head = 준head ?? 프로젝트?.head_revision ?? null;
if (원격 && !준head) {
  try {
    관측head = 원격head(내력.source_repository);
    console.log(`원격 head 관측: ${관측head.slice(0, 12)}`);
  } catch (오류) {
    console.log(`WARN 원격을 못 읽었다(${오류.message.split('\n')[0]}) — 관측값으로 판정한다`);
  }
}

let 판 = 그림자신선도(내력, 관측head);

/** 움직였는데 기록이 없으면, --remote 일 때 그 head 에서 blob 들을 다시 읽어 기록을 만든다. */
if (원격 && 판.state === 판정.보류 && 판.이유.some((r) => /REVALIDATION|SOURCE_MOVED/.test(r))) {
  const 본것 = [];
  let 실패 = null;
  for (const e of 내력.entries) {
    try {
      본것.push({ source_path: e.source_path, source_blob_sha_at_checked_head: 원격blob(내력.source_repository, e.source_path, 관측head) });
    } catch (오류) {
      실패 = 오류;
      break;
    }
  }
  if (실패) {
    console.log(`WARN 원본 blob 을 못 읽었다: ${실패.message.split('\n')[0]}`);
  } else {
    내력.revalidation = { checked_head: 관측head, checked_at: new Date().toISOString(), entries: 본것 };
    writeFileSync(resolve(root, 내력길), JSON.stringify(내력, null, 2) + '\n');
    console.log(`재확인 기록을 갱신했다: ${본것.length} 개 경로 @ ${관측head.slice(0, 12)}`);
    판 = 그림자신선도(내력, 관측head);
  }
}

console.log(`고정 ${String(판.고정).slice(0, 12)} · 관측 ${String(판.지금).slice(0, 12)} → ${판.state}`);
for (const 이유 of 판.이유) console.log(`  ${이유}`);
for (const 길 of 판.바뀐것 ?? []) console.log(`  DRIFT ${길}`);
for (const 길 of 판.확인안된것 ?? []) console.log(`  UNCHECKED ${길}`);

if (판.state === 판정.보류) {
  console.log('\nHOLD: 그림자가 원본을 비추고 있다고 말할 수 없다. --remote 로 다시 확인하거나, 바뀐 것을 반영해야 한다.');
  process.exit(1);
}
console.log(`\nPASS: 그림자 ${내력.entries.length} 개가 원본과 맞다 (${판.state})`);
