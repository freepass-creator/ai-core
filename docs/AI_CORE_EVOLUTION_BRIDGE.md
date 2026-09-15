# AI Core Evolution Bridge

- 문서 버전: 1.0
- 작성일: 2026-09-16 (Asia/Seoul)
- 상태: `ADOPTION BRIDGE / NOT AN AUTOMATIC PROMOTION MECHANISM`
- 기준선: `freepass-creator/ai-core@655939e49c1dd482b364e220795c266e8a9acadf`

## 0. 목적

이 문서는 계속 고도화되는 Chat 연구, CIVILIZATION, DEVKIT, AI Core 연구 브랜치와 실제 회사 업무·개발 프로젝트를 연결한다.

핵심은 연구 내용을 곧바로 운영 규칙으로 복사하는 것이 아니라 다음 순환을 만드는 것이다.

`Research/Chat → Candidate → Source/Revision 고정 → 작은 실험 → 실제 프로젝트 증거 → 채택/보류/폐기 → 공통 교훈 환류 → 다음 연구`

연구가 많아지는 것 자체는 진화가 아니다. 실제 업무의 반복 설명, 오류, 충돌, 재작업, 검증 누락을 줄인 근거가 있어야 승격한다.

## 1. 연결 대상

현재 연결해야 할 장기 고도화 스트림은 다음과 같다.

- CIVILIZATION: 의도·약속·할당·현실·종결, freshness/invalidation, evidence와 권한 분리, 포트폴리오·거버넌스 연구.
- DEVKIT: 개발 표준, 재사용/적응/조합/확장/신규/HOLD 판정, revision-bound 검증, 인수인계와 stale evidence 방지.
- AI Core research branches: Evolution Engine, Self-Improvement Loop, Development Runtime, Engine/Port/Adapter, Semantic Capability Fabric, Development Episode 등.
- 실제 프로젝트: ERP, 영업, 정산, 홈페이지, AIOps, 문서, 기타 자회사 저장소.

2026-09-16 기준 외부 고도화 흐름에서 알려진 최신 연구 포인터는 `CIVILIZATION v18`, `DEVKIT v6.6`이다. 이 표기는 **연구 후보의 현재 포인터**일 뿐 AI Core 운영 채택을 뜻하지 않는다. 해당 원본 위치·manifest·revision은 실제 가져올 때 다시 확인한다.

## 2. 상태 모델

연구/개선 후보는 최소 다음 상태를 구분한다.

1. `IDEA` — 대화 또는 관찰에서 나온 아이디어.
2. `RESEARCH_CANDIDATE` — 메커니즘과 적용 범위가 설명됨.
3. `LOCALLY_TESTED` — 합성/로컬 검사를 통과했으나 실제 업무 증거는 없음.
4. `INDEPENDENTLY_VERIFIED` — 독립 실행자가 동일 범위에서 재현.
5. `SHADOW_VALIDATED` — 실제 업무를 바꾸지 않는 shadow 방식으로 비교.
6. `OUTCOME_VERIFIED` — 실제 의도한 결과와 부작용이 관측됨.
7. `ADOPTED_LOCAL` — 특정 프로젝트에만 채택.
8. `ADOPTED_DOMAIN` — 특정 업무 도메인 공통 규칙으로 채택.
9. `ADOPTED_UNIVERSAL` — 서로 다른 도메인 전이 증거까지 확인한 공통 규칙.
10. `HOLD` / `REJECTED` / `SUPERSEDED` — 증거 부족, 비용 과다, 충돌 또는 후속 버전으로 대체.

버전 번호, 테스트 개수, AI 동의, 문서 길이만으로 상태를 올리지 않는다.

## 3. Candidate Intake — 고도화 채팅에서 GitHub로 넘기는 최소 계약

고도화 채팅에서 실무에 적용할 만한 내용이 나오면 전체 대화를 복사하지 않고 아래 최소 정보를 AI Core에 남긴다.

```yaml
candidate_id: EVO-<domain>-<number>
source_stream: CIVILIZATION | DEVKIT | CHAT | AI_CORE_RESEARCH | PROJECT
source_pointer: <정확한 문서/브랜치/파일/버전>
source_revision: <commit/hash/manifest 또는 UNKNOWN>
status: RESEARCH_CANDIDATE
before_failure: <현재 무엇이 반복되거나 잘못되는가>
mechanism: <무엇을 바꾸는가>
prediction: <적용하면 무엇이 관측되어야 하는가>
target_scope: LOCAL | DOMAIN | UNIVERSAL_CANDIDATE
required_conditions: []
failure_conditions: []
proposed_pilot: <가장 작은 실제/비운영 검증>
authority_boundary: <실행 승인과 별개임>
```

연구 원본은 해당 위치에 유지한다. AI Core는 후보 요약과 포인터만 가진다.

## 4. 어디로 보내는가

후보는 의미에 따라 아래로 보낸다.

- 회사 업무 절차·권한·운영 실패 → AIOps/해당 운영 도메인 후보.
- 개발 표준·재사용 컴포넌트·테스트/검증 도구 → DevCenter 후보.
- 라우팅·기억·인계·증거·채택 로직 → AI Core 후보.
- 특정 ERP/앱/홈페이지 고유 규칙 → 해당 프로젝트 LOCAL.
- 문서/PDF/양식 규격 → DocsHub/문서 도메인 후보.

공통화 여부는 이름이 비슷해서가 아니라 의미·입출력·오류·부작용·권한 조건이 실제로 맞는지로 판정한다.

## 5. 실제 검증 연결

후보를 실제 프로젝트로 연결할 때는 `SOURCE EXPERIENCE → CAUSAL PRINCIPLE → REQUIRED CONDITIONS → FAILURE CONDITIONS → TARGET DOMAIN TRANSLATION → SMALL TEST → ADOPT/HOLD/REJECT` 순서를 따른다.

### 예시 A — 개발 고도화

CIVILIZATION/DEVKIT에서 `stale evidence는 재검증해야 한다`는 원칙이 나왔다면:

1. 실제 ERP UI 변경 한 건을 선택한다.
2. source revision과 requirement set을 기록한다.
3. 변경 전 검증 결과를 만든다.
4. source/requirement를 바꿔 기존 증거가 stale 되는지 확인한다.
5. stale이면 Release Gate가 HOLD하는지 본다.
6. 불필요한 false block과 추가 비용을 함께 기록한다.
7. 유효하면 해당 프로젝트 또는 DevCenter 규칙으로 채택한다.

### 예시 B — 실제 회사 업무

업무 고도화에서 `Intent → Commitment → Allocation → Reality → Closure`가 유효하다는 후보가 있다면:

1. 대표 요청 한 건을 실제 업무지도에 등록한다.
2. 요청과 AI 추론을 구분한다.
3. 담당/기한/의존성/실제 실행을 연결한다.
4. 문서 작성과 실제 업무 완료를 분리한다.
5. 대표가 “어제 그거 어디까지 됐지?”라고 물었을 때 재탐색 없이 정확히 이어지는지 본다.
6. 관리 오버헤드가 더 큰지까지 측정한다.

## 6. 실제 업무/프로젝트에서 연구로 돌아오는 Feedback Packet

각 실제 업무는 장문의 회고 대신 아래를 반환한다.

```yaml
feedback_id: FB-<project>-<number>
subject_revision: <commit/data revision>
user_intent: <확정된 목적>
what_worked: []
what_failed: []
rework_count: <관측값 또는 UNKNOWN>
repeated_context: <관측값 또는 UNKNOWN>
false_completion: true|false
false_block: true|false
unresolved: []
evidence_refs: []
candidate_implications:
  - keep
  - modify
  - reject
  - new_candidate
```

공통 교훈만 비식별 요약으로 AI Core에 올리고, 프로젝트별 원본·세부 데이터는 프로젝트 정본에 남긴다.

## 7. 고도화 채팅의 역할

계속 고도화되는 채팅은 앞으로 다음 역할을 맡는다.

- 여러 프로젝트의 실패·마찰을 비교한다.
- 단일 사례를 과잉 일반화하지 않는다.
- 다음 후보 메커니즘과 counterexample을 설계한다.
- 실제 검증이 필요한 후보를 GitHub Candidate로 넘긴다.
- 이미 채택된 규칙을 문구만 바꿔 새 버전으로 만들지 않는다.

반대로 채팅이 직접 운영 SSOT가 되지는 않는다. 세션 종료 후에도 이어져야 할 것은 GitHub의 candidate/evidence/handoff에 남긴다.

## 8. 정기적인 Evolution Review

Evolution Review는 버전을 자동으로 올리는 행사가 아니다. 다음 질문만 본다.

- 실제로 반복된 실패가 있었는가?
- 현재 규칙으로 잡지 못한 원인은 무엇인가?
- 새 메커니즘이 기존 것과 무엇이 다른가?
- 어떤 작은 실험으로 틀렸음을 증명할 수 있는가?
- 통과했다면 LOCAL/DOMAIN/UNIVERSAL 중 어디까지만 채택할 것인가?
- 추가된 절차의 비용이 이득보다 큰가?
- 기존 후보 중 폐기하거나 합쳐야 할 것이 있는가?

실제 증거가 없으면 `HOLD`로 유지한다.

## 9. AI Core에 필요한 구현

마스터 기획의 그룹 Registry와 연결해 최소 다음을 구현한다.

- `evolution/candidates/` 또는 동등 저장소: 후보 카드.
- `evolution/evidence/`: 비식별·revision-bound 검증 포인터.
- `evolution/adoptions.json`: 프로젝트/도메인별 채택 revision.
- Project Capsule의 `shared_capabilities`와 adoption 연결.
- 업무/개발 Proof Bundle에서 Feedback Packet 생성.
- Research Index에서 최신 연구 포인터와 상태 조회.

기존 Evolution Engine 연구 브랜치(`research/evolution-engine-v0.1`)의 계약/게이트를 먼저 재사용 검토하며 평행 엔진을 새로 만들지 않는다.

## 10. 첫 연결 작업 — EVO-BRIDGE-P0

클로드/Work가 수행할 첫 작업은 코드 대공사가 아니라 다음이다.

1. `memory/RESEARCH_INDEX.md`, 현재 연구 브랜치, 실제 고도화 원본 포인터를 inventory한다.
2. CIVILIZATION/DEVKIT 최신 포인터를 source revision과 함께 확인한다.
3. 중복 후보를 합친다.
4. 실제 프로젝트에서 검증 가능한 후보 1~3개만 선택한다.
5. 그중 하나를 다음 실제 비운영 업무/개발 Episode에 붙인다.
6. 결과를 Feedback Packet으로 반환한다.
7. 채택하지 않은 이유도 기록한다.

**완료 기준은 후보 목록을 많이 만드는 것이 아니라, 연구 후보 하나가 실제 업무 증거와 왕복 연결되는 것**이다.

## 11. 안전/권한 경계

Evolution Bridge는 채택 상태를 제안·기록할 뿐 권한을 만들지 않는다. 실데이터 변경, 배포, 권한, 삭제, 결제, 법적 제출 등은 원래 시스템의 승인 경계를 유지한다.

새 연구가 더 최신이라는 이유로 현재 프로젝트의 SSOT·AGENTS·승인 규칙을 자동 덮어쓰지 않는다. source/requirement/evidence가 바뀌면 이전 PASS는 필요 범위에서 stale 처리한다.
