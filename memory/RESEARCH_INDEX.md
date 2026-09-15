# AI Core Research Index

이 문서는 Chat 연구와 차세대 AI Core 설계를 Work/Codex와 다른 AI가 빠르게 찾기 위한 색인이다.

## 읽기 원칙

1. 현재 작업의 정본/Work Packet이 항상 우선한다.
2. 이 문서의 항목은 대부분 `RESEARCH_CANDIDATE` 또는 `DESIGN`이며 자동 운영 채택이 아니다.
3. 필요한 항목만 해당 branch/PR 또는 공유 연구 문서에서 읽는다. 전체 연구 브랜치를 매번 재독하지 않는다.
4. 외부 Chat/CIVILIZATION/DEVKIT 고도화는 [AI Core Evolution Bridge](../docs/AI_CORE_EVOLUTION_BRIDGE.md)를 통해 후보화·검증·채택한다.

## 연구 계보

| 주제 | 위치/branch | PR | 상태 | 핵심 |
|---|---|---:|---|---|
| Development Runtime | `main/docs/DEVELOPMENT_RUNTIME.md` | — | RESEARCH_CANDIDATE | Project Capsule / Codebase Twin / Change Compiler / Proof Bundle / Preview·Release 자동화 |
| Development Autonomy + Continuity | `research/development-autonomy-v0.1` | #14 | RESEARCH_CANDIDATE | L0→L6 개발 성숙도 + Project Capsule / Change Packet / Proof Bundle + Living Requirement Graph / Development Episode / stale plan detection / multi-agent write conflict |
| Engine / Port / Adapter Contracts | `research/engine-adapter-contract-v0.1` | #15 | DESIGN | Engine=업무의미, Port=추상계약, Adapter=provider/project 연결, Connector=transport, Binding Profile=배선, Runtime=실행조정 |
| Semantic Capability Fabric | `research/semantic-capability-fabric-v0.1` | #16 | RESEARCH_CANDIDATE | Raw symbol→Capability Cell→Capability Graph→Resolver; 의미·계약·증거 기반 재사용, semantic graph first |
| Development Episode Pilot | `experiment/development-episode-pilot-v0.1` | #19 | EXPERIMENT_DESIGN | 다음 실제 비운영 개발 요청을 DEV-EPISODE-001로 측정; 반복질문·stale·rework·preview 시간·evidence coverage·false completion 관찰 |
| Evolution Engine | `research/evolution-engine-v0.1` | #3 | DESIGN | 실제 outcome 기반 진화/승격 |
| Self-Improvement Loop | `research/self-improvement-loop-v0.1` | #4 | RESEARCH_CANDIDATE | 관찰→진단→제안→실험→승격/폐기 |
| Precision-Speed Learning | `research/precision-speed-controller-v0.1` | #5 | LOCALLY_TESTED candidate | 신속 정확, 라우팅 outcome 학습 |
| Document Domain | `research/document-domain-v0.1` | #7 | DESIGN | DocsHub/문서 SSOT/문서 QA |
| Federation Architecture | `research/federation-architecture-v0.1` | #8 | DESIGN | Plane + Center + Project Reality |
| Cognitive Runtime | `research/cognitive-runtime-v0.1` | #9 | DESIGN | Goal/World/Decision/Plan Slice |
| Human Orchestration | `research/human-orchestration-v0.1` | #10 | DESIGN | Intent/Question Value/Domain Pack/Follow-through |
| Human Stewardship OS | `research/human-stewardship-v0.1` | #11 | RESEARCH_CANDIDATE | Direction/Portfolio/Foresight/Agency |
| Chat Research Notebook | `chat/research-notebook` | #12 | RESEARCH_POSITION | AI 본질/인간 주체성/Chat 판단 기록 |
| Civilization Ledger | `memory/civilization-ledger-v1` | #13 | MEMORY_LAYER | 메일/연구의 중복 제거 장기기억 |

## 외부 연속 고도화 스트림

이 항목은 AI Core repo 외부의 계속 고도화되는 연구 흐름을 연결하기 위한 **포인터**다. 원본을 AI Core에 복제하지 않으며 실제 source revision/manifest는 후보를 가져오는 시점에 재확인한다.

| 스트림 | 2026-09-16 알려진 포인터 | 상태 | AI Core 연결 방식 |
|---|---|---|---|
| CIVILIZATION | v18 | RESEARCH_CANDIDATE / external | Intent→Commitment→Allocation→Reality→Closure, freshness/invalidation, evidence/authority 원칙을 Candidate Intake 후 실제 업무 shadow/episode로 검증 |
| DEVKIT | v6.6 | RESEARCH_CANDIDATE / external | 재사용/적응/조합/확장/신규/HOLD, revision-bound proof, stale capability/evidence 방지를 DevCenter/실제 프로젝트에서 제한 검증 |
| 장기 고도화 Chat | 지속 | RESEARCH_SOURCE | 반복 실패·마찰에서 candidate를 만들고 전체 대화가 아닌 source pointer + mechanism + prediction만 GitHub로 넘김 |

새 버전이 나와도 이 표의 버전 숫자만 올리고 운영 규칙을 자동 변경하지 않는다. 실제 adoption은 `AI_CORE_EVOLUTION_BRIDGE.md`의 상태 모델과 evidence를 따른다.

## Work가 실제로 참고해야 할 순서

1. `MEMORY.md`
2. `memory/CURRENT.md`
3. 현재 Work Packet / 대상 프로젝트 지침
4. 필요한 경우 `memory/CANONICAL.md`
5. 현재 작업과 직접 관련된 연구 문서/branch 하나만 선택
6. 구현/검증 결과를 `WORK_RESULT` 또는 PR evidence로 반환
7. 공통화할 가치가 있는 결과만 Evolution Bridge의 Feedback/Candidate로 환류

## 개발 우선순위일 때

1. `main/docs/DEVELOPMENT_RUNTIME.md`로 전체 방향을 본다.
2. 개발의 지속 상태/요구 추적은 PR #14 / `research/development-autonomy-v0.1`을 본다.
3. Engine/Port/Adapter/Runtime 경계는 PR #15 / `research/engine-adapter-contract-v0.1`을 본다.
4. 기존 기능의 의미 기반 재사용/Capability Graph/Resolver는 PR #16 / `research/semantic-capability-fabric-v0.1`을 본다.
5. **다음 실제 비운영 개발 요청을 측정형 Development Episode로 실행할 때는 PR #19 / `experiment/development-episode-pilot-v0.1`을 사용한다.**
6. 먼저 기존 Work Packet/WORK_RESULT/DevCenter registry·기능창고를 확장 가능한지 검토하고, 평행 규격을 새로 만들지 않는다.
7. `DEV-EPISODE-001` 실증 전에는 Full Codebase Twin 대규모 구현을 우선하지 않는다. Semantic Capability Graph와 demand-driven impact expansion을 먼저 검증한다.
8. CIVILIZATION/DEVKIT 후보는 현재 개발 문제와 직접 관련될 때만 선택하고 전체 최신 버전을 일괄 이식하지 않는다.

## 실제 업무 우선순위일 때

1. [AI Core Operating Playbook](../docs/AI_CORE_OPERATING_PLAYBOOK.md)에서 업무 의미와 실행 루프를 본다.
2. 실제 업무/운영 정본과 현재 observation을 먼저 확인한다.
3. 반복 질문·재작업·false completion·stale evidence·잘못된 routing이 관측될 때 관련 연구 후보를 선택한다.
4. 적용 전 prediction과 non-applicable condition을 적는다.
5. 실제 업무 결과를 Feedback Packet으로 Evolution Bridge에 반환한다.

## 중요

- 연구 문서/branch의 존재 자체는 채택/merge/배포를 의미하지 않는다.
- Chat이 새 연구를 만들면 이 Index에 포인터를 추가하고 기존 원칙과 중복이면 새 체계를 만들지 않는다.
- Work가 연구를 구현하려면 현재 Work Packet 범위와 충돌하지 않는지 먼저 확인한다.
- 프로젝트 정본과 실제 사용자 지시가 연구보다 우선한다.
- source/정책/requirement/target Git 상태가 바뀌면 관련 과거 PASS를 stale로 재판정한다.
- 연구 추가보다 실제 Episode/업무에서 왕복 evidence를 얻는 것이 우선이다.
