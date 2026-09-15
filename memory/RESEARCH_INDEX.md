# AI Core Research Index

이 문서는 Chat 연구와 차세대 AI Core 설계를 Work/Codex와 다른 AI가 빠르게 찾기 위한 색인이다.

## 읽기 원칙

1. 현재 작업의 정본/Work Packet이 항상 우선한다.
2. 이 문서의 항목은 대부분 `RESEARCH_CANDIDATE` 또는 `DESIGN`이며 자동 운영 채택이 아니다.
3. 필요한 항목만 해당 branch/PR 또는 공유 연구 문서에서 읽는다. 전체 연구 브랜치를 매번 재독하지 않는다.

## 연구 계보

| 주제 | 위치/branch | PR | 상태 | 핵심 |
|---|---|---:|---|---|
| v0.4 planning candidate | `feature/orchestrator-v0.1` | #1 | LOCALLY_TESTED_CANDIDATE | 유일한 현재 구현 평가선. 계획·HOLD·proof gate를 제공하지만 실행기나 운영 채택본은 아님 |
| v0.5 stacked extension | `feature/human-agency-v0.5` | #17 | DEFERRED_CANDIDATE | #1 위에 쌓인 의도·준비 계층. 실제 episode에서 필요성이 관찰되기 전에는 진행하지 않음 |
| v0.6 stacked extension | `feature/cognitive-runtime-v0.6` | #18 | DEFERRED_CANDIDATE | #17 위에 쌓인 runtime·stewardship 계층. 연구 #9~#11과 개념·파일이 겹치며 현재 채택선이 아님 |
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
| CIVILIZATION v11-v15 mail lineage | `memory/EMAIL_INDEX.json` | — | RESEARCH_CANDIDATE | 선택 비교 → 의도 → 약속 → 포트폴리오 용량 → 현실 변화·증거 무효화. v12-v15는 Gmail 첨부가 없어 본문 기록만 보존 |
| Chat Research Notebook | `chat/research-notebook` | #12 | RESEARCH_POSITION | AI 본질/인간 주체성/Chat 판단 기록 |
| Civilization Ledger | `memory/civilization-ledger-v1` | #13 | MEMORY_LAYER | 메일/연구의 중복 제거 장기기억 |

## Work가 실제로 참고해야 할 순서

1. `MEMORY.md`
2. `memory/CURRENT.md`
3. 현재 Work Packet / 대상 프로젝트 지침
4. 필요한 경우 `memory/CANONICAL.md`
5. 현재 작업과 직접 관련된 연구 문서/branch 하나만 선택
6. 구현/검증 결과를 `WORK_RESULT` 또는 PR evidence로 반환

## 현재 개발 작업

`memory/CURRENT.md`에 지정된 `DEV-EPISODE-001`만 진행한다. PR #19의 관찰 양식은 실제 사실을 기록할 때만 사용한다. 다른 연구 항목은 episode에서 구체적인 결손이 관찰되고 해당 항목이 직접 관련될 때만 한 건씩 읽는다.

## 중요

- 연구 문서/branch의 존재 자체는 채택/merge/배포를 의미하지 않는다.
- 구현 계보는 `#1 → #17 → #18`의 stacked branches다. 세 구현을 독립된 현재 상태로 합치지 않는다. 현재 평가 대상은 #1 하나이며 #17/#18은 보류한다.
- 연구 #9~#11과 구현 #18의 같은 개념·파일은 별도 세계의 후보다. 이름이 같다는 이유로 내용을 합치거나 둘 다 정본으로 취급하지 않는다.
- PR #19는 관찰 양식과 집계기다. 질문·시간·재사용·회귀를 자동 관측하는 측정기로 설명하지 않는다.
- Chat이 새 연구를 만들면 이 Index에만 1줄 추가하고 기존 원칙과 중복이면 새 항목을 만들지 않는다.
- Work가 연구를 구현하려면 현재 Work Packet 범위와 충돌하지 않는지 먼저 확인한다.
- 현재 사용자 우선순위는 **개발 경험 단순화**다. 이제 우선순위는 연구 추가보다 `DEV-EPISODE-001`의 실제 관찰을 얻는 쪽으로 이동한다.
