# AIOps Shared Infrastructure Learning — 2026-09-19

- 상태: `CANDIDATE-CATALOG / DO_NOT-MOVE-CODE-YET`
- 원천: `freepass-creator/aiops`
- 관측 head: `c37a422765e784cdd843f36efb4be5328d7df4bb`
- 정본 분류: `docs/공통후보-지도.md`
- 목적: AIOps 안에서 업무규칙과 분리되어 실제로 재사용 가능성이 높은 메커니즘을 AI Core/DevCenter capability 후보로 인지한다.

## 1. 현재 문제

AI Core는 Engine/Adapter/Runtime 개념은 정교하지만, AIOps에서 이미 오래 운영하며 검증한 작은 공용 메커니즘 상당수가 first-class Capability Cell로 등록되어 있지 않다.

반대로 AIOps의 과태료/미수/보험/자금 업무규칙을 통째로 공통화하면 안 된다.

따라서 코드 이동보다 **분류와 계약 추출**이 먼저다.

## 2. AIOps가 shared-candidate로 분류한 핵심

대표 후보:

- `lease.mjs` — 중앙 작업 lease / concurrent writer mutex
- `atomic-stream-write.mjs` — 완전수신 후 교체하는 bounded writer
- `atom-sync.mjs` — 원문 대조/canonical reconcile
- `fb.mjs` — Firestore 원자 입출력 경계
- `fb-kaesi.mjs` — 한 사이클 cache
- `goog.mjs`, `drive.mjs`, `sheet.mjs` — Google/Drive/Sheets 얇은 연결층
- `task-board.mjs` — 작업 coordination ledger
- `workapi.mjs` — 화면↔백엔드 추상화
- `nalja.mjs` — 날짜 정규화
- `haengjeong.mjs` — 주소/행정구역 정규화
- `wonja-mun.mjs`, `wonja-scan.mjs` — canonical atom read/scan mechanics
- `정본.mjs`, `정본모음.mjs` — SSOT registry mechanics

원천 문서는 shared-candidate 27개를 따로 관리한다.

## 3. 절대 같이 가져오면 안 되는 것

다음은 FreePass 운영 의미가 박힌 operational domain 코드다.

예:
- 과태료 판정/기관/변경부과
- 자금 대사 규칙
- 미수 projection
- 계약/차량 업무 규칙
- 손오공 공급사 연동
- 업무 종류 사전

공통화 대상은 이 업무 의미가 아니라:
- lock
- idempotency
- bounded read/write
- source registry
- canonicalization mechanics
- connector contract
- audit/proof envelope

이다.

## 4. AI Core가 뒤처진 부분

현재 AI Core capability registry는 penalty/finance adapter 등 일부 실제 연결은 갖고 있지만, 위 shared-candidate를 개별 의미/입출력/side-effect/검증 상태를 가진 Capability Cell로 아직 다루지 않는다.

후속:
1. 후보별 semantic purpose 추출
2. input/output/side-effect 명시
3. AIOps 고유 경로/상수 제거 가능성 확인
4. 최소 두 번째 프로젝트 재사용 증거
5. pinned revision + test evidence
6. 그 뒤 DevCenter/shared-service로 승격

## 5. 코드 이동 금지

지금 단계에서는 AIOps 파일을 AI Core로 복사하지 않는다.

먼저:
- capability pointer
- contract
- evidence
- second-project adoption

을 만든 뒤 이동 여부를 결정한다.

이는 AI Core의 “Semantic Capability Graph first, code move later” 원칙과 맞는다.

## 6. 한 줄 결론

> **AIOps에는 이미 공용 인프라 씨앗이 많다. AI Core가 할 일은 업무 코드를 빼앗는 것이 아니라, 재사용 가능한 메커니즘을 계약·증거 단위 Capability로 승격시키는 것이다.**
