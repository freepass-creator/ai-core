// 구글 시트·드라이브·지메일은 세션이 gws 로 «직접» 한다 — 그 길을 AI Core 정본이 가리키는지 지킨다.
//
// ★2026-10-03 대표: 「왜 구글 시트를 직접 못 만지고 코덱스를 통해서 만지냐 … 세션마다 노하우를 모르고 헤맨다」.
//   그때 라우터는 「구글 시트에 값 넣어」를 NO_WORK_TYPE_MATCH 로 돌려보냈고, reuse:check 후보도 0 이었으며,
//   TOOL_CONNECTIONS 는 「Workspace default policy remains read-only」라고 적고 있었다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeWork } from '../src/routing/work-router.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
const 판 = { workMap: json('registry/work-map.json'), projectRegistry: json('registry/projects.json'), capabilityRegistry: json('registry/capabilities.json') };

test('★시트·드라이브 요청이 «직접 하라»는 길로 간다 — 매칭 실패로 돌려보내지 않는다', () => {
  for (const q of ['구글 시트에 값 넣어', '시트 읽어줘', '드라이브에서 파일 찾아', '구글 드라이브 폴더 봐줘']) {
    const r = routeWork(q, 판);
    assert.equal(r.work_type_id, 'google-workspace-direct', `${q} → ${r.status}`);
    assert.equal(r.capability_id, 'workspace.google-direct');
    /** 막힘 사유로 다른 프로젝트(카톡 자동화)의 게이트가 보이면 AI 는 「시트를 못 쓴다」로 읽는다 */
    assert.ok((r.blockers ?? []).some((b) => /gws/.test(b)), `${q}: 경로가 gws 직접 사용을 말하지 않는다`);
    assert.ok(!(r.blockers ?? []).some((b) => /DPI|automatic-response|Kakao|카톡/i.test(b)), `${q}: 상관없는 막힘이 섞였다`);
  }
});

test('능력은 REFERENCE(엔진이 아니라 세션이 직접) · 모든 프로젝트 · 쓰기 경계(발송·공유·삭제)가 벽이다', () => {
  const c = 판.capabilityRegistry.capabilities.find((x) => x.id === 'workspace.google-direct');
  assert.ok(c);
  assert.equal(c.status, 'REFERENCE');
  assert.deepEqual(c.projects, ['*']);
  for (const 벽 of ['메일발송', '공유·권한변경', '파일삭제']) assert.ok(c.walls.includes(벽), 벽);
  assert.match(c.hold_reason, /다른 AI·대표를 거치지 않는다/);
});

test('낡은 「read-only」 서술이 없고, 직접 사용 절차와 경계가 있다', () => {
  const t = readFileSync(resolve(root, 'memory/TOOL_CONNECTIONS.md'), 'utf8');
  assert.doesNotMatch(t, /Workspace default policy remains read-only/);
  assert.match(t, /## Google Workspace direct use/);
  assert.match(t, /gws sheets \+read/);
  assert.match(t, /쓰기 전 같은 범위 읽기 → 쓰기 → 다시 읽어 확인/);
  assert.match(t, /보내기는 대표 지시가 있을 때만/);
  const ws = json('registry/operating-knowledge.json').platforms.find((p) => p.id === 'platform.google-workspace');
  assert.match(ws.procedure[0], /gws CLI/);
  assert.ok(ws.do_not_ask.some((d) => /Codex or the user: no/.test(d)));
});
