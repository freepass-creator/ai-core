# 현재 활성 세션 미션 배정 (2026-09-16)

> **시점 주의 — 2026-09-19:** 이 표는 9/16 당시 관측된 세션 배정 스냅샷이다. 지금 살아 있는 세션 목록으로 단정하지 않는다. 현재 작업을 시작할 때는 `npm run core:brief`, 최신 project registry, 열린 PR/현재 branch와 대상 저장소 정본을 다시 본다. 이 표의 미션·담당이 최신 evidence와 충돌하면 최신 관측을 우선한다.

CLI 연결 유무와 무관하게 이 세션들이 실제로 돌고 있다. 각자 확정된 범위 밖은 건드리지 않는다. 새 세션이 뭘 할지 모르겠으면 여기부터 본다.

| 세션 | 저장소 | 미션 | 안 건드리는 것 |
|---|---|---|---|
| freepasserp4-0d | freepasserp4 (`claude/f86-on-gate`, `claude/shop-deposit-rule`) | 하허호 F86 발행엔진 · 판매시트 파이프라인 · 예약 통일 | `lib/server/sales-publish-snapshot.ts`는 export 1개만 추가 예정, 큰 구조변경 없음 |
| freepasserp4-a0 | freepasserp4 (`.wt-newcar`, PR #265) | 신차/중고차 견적기(`app/estimate` 등) | 손님화면·상품찾기·정산·RTDB컷오버 |
| freepasserp4-4d | freepasserp4 (`fp-freepass`) | 화이트라벨 채널간판(`lib/whitelabel.ts`) | 지금 유휴, PR232 머지 완료. 다음 요청 대기 |
| freepasserp4-7e | freepasserp4 | 미확인 — 응답 없음 | — |
| teamjpkwork-d9 | teamjpkwork + aiops | teamjpkwork: `lib/erp/문열기.ts`(API 문지기)·`lib/erp/화면규격.ts`(입체/입체쓰임)·각종 검사기(문지기·각도·대조·설치·동선)·write/actions/Erp 원장반영. aiops: `사건/*.mjs`·`lib/dispatch.mjs`·`scripts/과태료-발송대기-자동전환.mjs`·`scripts/과태료-발송막힘.mjs`. 운영: teamjpkwork 결제계정 재연결 완료, 예약 셋(`aiops-daily` 등) 비활성 후 재활성화 대표 답 대기 | **정정**: `lib/whitelabel.ts`(freepasserp4 소속)는 이 세션 담당 아님 — 읽기만 한 번 했을 뿐 편집한 적 없음. 실제 담당은 freepasserp4-4d |
| casemap-bb | casemap | 사건 02(컴공 임시주총) — 심문 복기·보정서/사실조회신청서 초안 대기 | 사건 06(임대보증금) |
| webtoon-studio-6c | webtoon-studio | 배우 얼굴/전신 이미지 생성 파이프라인 | `local-generator/`·`casting-studio/reference-data/`·127.0.0.1:7860 (다른 세션 동시 실행시 OOM) |
| sales-8f | freepass-sales | 4관점 전수검사(3/4 완료, 코드버그 검사 1개 진행 중) | — |
| docshub-b0 | docshub | 문서규격 '범용' 구축(6종 틀) + 뮤카 잔가시장 보고서 규격 적용. 대표 판단 대기: 아이콘 세트 교체·폰트 로컬번들·본문 단폭·자동쪽번호 | `양식/카드형.css`·`_카드형.html`은 docshub-8d 영역, 남겨둠 |
| ai-core-88 | ai-core(`C:\dev\ai-core`, PR #21/#29) | order-control-v1 오더 데스크 구현 이어가기 | ai-core-control-tower worktree(이 문서가 있는 곳)는 이 세션(Claude/ai-core-fd)이 전담 |
| aiops-49 | aiops | **완료(9e1036ba)** — 과태료 엔진 입력을 `01_올리는곳` 폴더로 고침. 대기 중인 건 작업이 아니라 대표 판단 하나(`02_발송할것` 맨 위 8/27 보류쪽지·8/27~28 옛 공문을 `04_완료한것`으로 옮길지 버릴지). 사람 몫: 오늘자 공문 44장 중 관청명 오타 2건·같은 관청 갈린 3곳, `01_올리는곳` 16장 | `01_올리는곳` 폴더는 이 세션이 계속 보고 있음 — 딴 세션이 손대지 않는다 |
| aiops-74 | aiops | 완료(유민 내용증명 16건) — archive 대기, Remote Control 연결로 자동 종료 안 됨 | — |
| SSOT 작업 / 작업 내용 파악 / 로컬 보조 작업 (cloud) | 미확인 | claude.ai/code에서 별도 실행 중, 이 세션에서 상태만 확인 가능(양방향 메시지 불가) | — |

## 이 세션(ai-core-fd)의 미션

`C:\dev\ai-core-control-tower` worktree 전담. GROUP-G0→G1→AI-CORE-MERGE-P0 진행, Control Tower registry/HANDOFF 배포, PR22 CI 이슈 해결, freepasserp4 3개 브랜치 cherry-pick 준비, 세션 조정 허브 — 사용자가 이 창 하나로 전체 현황 보고받음.

## A 세션 — Repo 조사 · AI Core 역수입

- 상태: **ACTIVE**
- 역할: 기존 프로젝트 전수조사 / AI Core 역수입 / 글로벌 표준 근거 조사
- 목표: 각 프로젝트가 AI Core보다 앞선 기능·규격·실패사례를 찾아 중앙 표준 후보로 공급한다.
- 범위: UI/UX, Data/SSOT, Engine/Adapter, API/Event/Error, Workflow, Security/Audit, Observability/QA, Build/Deploy/Governance 전 축.
- 우선순위: **Data/SSOT → Engine/Adapter → API/Event/Error → Workflow**. UI/UX 표준 세션에는 외부 표준·수치 근거를 공급한다.
- 산출물: learning packet, evidence matrix, project comparison, promotion candidate, exception/hold reason.
- 금지: 다른 세션이 만드는 canonical standard를 별도 파일로 복제하거나 경쟁 정본을 만들지 않는다. 프로젝트 고유 업무 의미를 AI Core로 강제 이동하지 않는다.
- 승격 규칙: PROJECT_VERIFIED → CROSS_PROJECT_VERIFIED → COMMON_ADOPTED. 근거 없는 자동 승격 금지.
- 현재 조사팩: `docs/research/GLOBAL_PRODUCT_STANDARD_EVIDENCE_2026-09-19.md`, `docs/coordination/REPOSITORY_BACKFILL_AUDIT_2026-09-19.md`.

## 갱신 규칙

세션이 끝나거나 범위가 바뀌면 이 표를 그 자리에서 고친다. 새 표를 만들지 않는다.
