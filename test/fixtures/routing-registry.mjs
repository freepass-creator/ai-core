/** 라우팅 검사들이 쓰는 «고정된» 등록부.
 *
 * ★왜 (2026-09-27 · Codex 와 상의해 정함)
 *   전체 스위트의 실패 35건 중 30건이 한 원인이었다: 검사들이 «살아 있는» `registry/projects.json` 을 읽는데,
 *   `scripts/registry-refresh.mjs` 가 원격 head 변화를 보면 `execution_readiness_status` 를 ACTIVE→HOLD 로 내린다.
 *   오늘 10:03 자동 갱신으로 ACTIVE 5개 → 2개가 되면서, PLANNED 를 기대하던 검사들이 HOLD 를 받았다.
 *
 *   Codex 판단(둘 다 물었다):
 *     · HOLD 로 내리는 «동작 자체는 맞다» — 원격 head 가 바뀌면 기존 실행 증거가 새 revision 을 보증하지 못한다.
 *       재검증 뒤 사람이 ACTIVE 로 올려야 한다. 그러니 refresh 는 고치지 않는다.
 *     · 고칠 곳은 검사다 — **단위·E2E 는 고정 fixture 를 쓰고, 실제 등록부는 별도 통합·스모크 검사에서만 읽는다.**
 *
 *   그래서 이 파일이 생겼다. 값은 실제 등록부에서 가져오되 «실행 준비 상태»만 고정한다.
 *   실제 등록부가 HOLD 로 내려가도 라우팅 규칙 자체를 검사하는 일은 흔들리지 않아야 한다.
 */
import { readFileSync } from 'node:fs';

const 읽기 = (이름) => JSON.parse(readFileSync(new URL(`../../registry/${이름}`, import.meta.url), 'utf8'));

/** 고정할 «실행 가능» 프로젝트 — 값을 지어내지 않는다. **자동 갱신 직전 커밋 `b2aef6d` 의 상태 그대로**다.
 *  검사들은 그 상태에서 쓰였고, 라우팅 기대값(`registry/work-routing-fixtures.json`)도 그때 것이다.
 *
 *  ★임의로 늘리거나 줄이면 다른 검사의 전제가 흔들린다(실측):
 *    · 다섯에 freepass-admin 을 더했더니 라우팅이 HOLD_PROJECT_HOLD → HOLD_CAPABILITY_HOLD 로 바뀌었다.
 *    · 둘로 줄였더니 ERP·work-map 검사가 반대로 깨졌다.
 *  그래서 «그때의 값»을 기준으로 삼는다. 실제 등록부가 재검증을 거쳐 ACTIVE 로 돌아오면 이 목록을 줄여 간다.
 *
 *  ★그리고 «이미 실제로 ACTIVE 인 것»은 여기 두지 않는다 — 덮어 봐야 아무것도 증명하지 않는다.
 *    `test/routing-fixture-shrinks.test.mjs` 가 실제와 겹치면 빨개져서, 재검증으로 ACTIVE 가 돌아올 때마다
 *    이 목록이 스스로 줄어든다(넣자마자 ai-core·mewcar 가 걸려 빠졌다). */
export const 고정ACTIVE = ['aiops', 'freepass-sales', 'freepasserp4'];

/**
 * 살아 있는 등록부를 바탕으로, 실행 준비 상태만 고정한 사본을 만든다.
 * 구조·capability·work-map 은 정본 그대로라 규칙이 바뀌면 검사도 같이 움직인다.
 */
export function 고정등록부({ active = 고정ACTIVE } = {}) {
  const projectRegistry = 읽기('projects.json');
  const 고정 = new Set(active);
  return {
    workMap: 읽기('work-map.json'),
    capabilityRegistry: 읽기('capabilities.json'),
    projectRegistry: {
      ...projectRegistry,
      projects: projectRegistry.projects.map((프) =>
        고정.has(프.project_id) ? { ...프, execution_readiness_status: 'ACTIVE' } : 프
      )
    }
  };
}

/** 라우팅 검사들이 그대로 넘겨 쓰는 모양. */
export const routingConfig = 고정등록부();
export const { workMap, capabilityRegistry, projectRegistry } = routingConfig;
