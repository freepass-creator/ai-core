# AI Core Research Index

이 문서는 Chat 연구와 차세대 AI Core 설계를 Work/Codex와 다른 AI가 빠르게 찾기 위한 색인이다.

## 읽기 원칙

1. 현재 작업의 정본/Work Packet이 항상 우선한다.
2. 이 문서의 항목은 대부분 `RESEARCH_CANDIDATE` 또는 `DESIGN`이며 자동 운영 채택이 아니다.
3. 필요한 항목만 해당 branch/PR 또는 공유 연구 문서에서 읽는다. 전체 연구 브랜치를 매번 재독하지 않는다.

## 연구 계보

| 주제 | 위치/branch | PR | 상태 | 핵심 |
|---|---|---:|---|---|
| Development Runtime | `main/docs/DEVELOPMENT_RUNTIME.md` | — | RESEARCH_CANDIDATE | Project Capsule / Codebase Twin / Change Compiler / Proof Bundle / Preview·Release 자동화 |
| Development Autonomy Runtime | `research/development-autonomy-v0.1` | #14 | RESEARCH_CANDIDATE | L0→L6 개발 성숙도, Project Capsule / Change Packet / Proof Bundle 계약과 synthetic tests |
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

## Work가 실제로 참고해야 할 순서

1. `MEMORY.md`
2. `memory/CURRENT.md`
3. 현재 Work Packet / 대상 프로젝트 지침
4. 필요한 경우 `memory/CANONICAL.md`
5. 현재 작업과 직접 관련된 연구 문서/branch 하나만 선택
6. 구현/검증 결과를 `WORK_RESULT` 또는 PR evidence로 반환

## 개발 우선순위일 때

1. `main/docs/DEVELOPMENT_RUNTIME.md`로 전체 방향을 본다.
2. 실제 개발 런타임 계약을 검토할 때는 PR #14 / `research/development-autonomy-v0.1`만 추가로 본다.
3. 먼저 기존 Work Packet/WORK_RESULT를 확장 가능한지 검토하고, 평행 규격을 새로 만들지 않는다.
4. Project Capsule + Change Compiler + Proof Bundle의 실제 Shadow Pilot 전에는 Codebase Twin 대규모 구현을 우선하지 않는다.

## 중요

- 연구 문서/branch의 존재 자체는 채택/merge/배포를 의미하지 않는다.
- Chat이 새 연구를 만들면 이 Index에만 1줄 추가하고 기존 원칙과 중복이면 새 항목을 만들지 않는다.
- Work가 연구를 구현하려면 현재 Work Packet 범위와 충돌하지 않는지 먼저 확인한다.
- 현재 사용자 우선순위는 **개발 경험 단순화**다. Development Runtime 연구는 Work가 개발 관련 고도화를 검토할 때 첫 참조 후보로 본다.
