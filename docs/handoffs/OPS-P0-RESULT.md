# OPS-P0 — Work Map / Natural Language Router

상태: IMPLEMENTED_ON_BRANCH / NOT_YET_OPERATIONALLY_ACTIVATED  
branch: `work/ops-p0-router`

## 구현

- `registry/projects.json`
  - 기존 5개 project에 더해 GitHub에서 실제 존재가 확인된 핵심 repo 8개를 `HOLD`로 색인.
  - DocsHub, FP Settlement, Freepass Homepage, Sonogong Estimator, WorkControl, CaseMap Private, Freepass Admin, TeamJPK Work.
  - source review 전에는 실행 대상으로 승격하지 않는다.

- `registry/work-map.json`
  - 실제 회사 업무 24종을 domain / aliases / target project / capability / approval boundary / completion condition에 연결.
  - 프로젝트 데이터나 업무 원문을 복제하지 않고 포인터만 가진다.

- `src/routing/work-router.mjs`
  - 자연어 요청을 alias 기반으로 deterministic하게 resolve.
  - target project가 ACTIVE면 `RESOLVED`.
  - HOLD/REFERENCE/RETIRE이면 `HOLD_PROJECT_<STATUS>`.
  - 매칭이 없으면 `UNKNOWN`, 동률이면 `AMBIGUOUS`.
  - 어떤 경우에도 실행/쓰기/claim을 수행하지 않는다.

- `scripts/route-work.mjs`
  - 사용: `npm run ops:route -- "ERP 상품 상세 고쳐"`

- Order intake routed fallback
  - `POST /api/orders`에서 project가 비어 있으면 title+intent를 같은 Work Map으로 resolve.
  - ACTIVE project면 project_id를 자동 주입해 기존 OrderStore로 접수.
  - HOLD/UNKNOWN/AMBIGUOUS이면 `PROJECT_ROUTE_HOLD` 409로 fail-closed.
  - 사용자가 project를 명시하면 자동 라우팅으로 덮어쓰지 않는다.

- `scripts/validate-work-map.mjs`
  - 사용: `npm run workmap:validate`

- `registry/work-routing-fixtures.json`
  - 실제 대표 자연어 요청 fixture 22개.

- `test/work-router.test.mjs`
  - work-map schema/project 연결, fixture route, unknown fail-closed, HOLD project 차단 검증.

## 현재 의도

이 기능은 기존 Control Tower/work ledger를 대체하지 않는다.

`natural language request → Work Map resolve → routed order intake → existing project/capability → Control Tower/work packet`

중 첫 번째 resolve 단계만 구현한다. 운영 실행은 기존 승인·claim·ledger 경계를 그대로 사용한다.

## 다음 연결

1. source review가 끝난 HOLD project를 Project Capsule 근거와 함께 ACTIVE/REFERENCE로 갱신.
2. route result를 기존 order intake의 project/capability 제안에 연결.
3. 실제 비운영 요청 1건을 `오더 → route → work packet → 검증 → result`로 끝까지 확인.
4. 운영 `orders.connection.json` workSources를 실제 registry/snapshot/mappings/ledger에 고정한 뒤 별도 검토.
