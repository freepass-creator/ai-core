# AIOPS / CIVILIZATION Lineage

This is the compact historical chain. It preserves what changed without repeating the full prose of each mail.

## Foundation

### `1a099198ee9e8289` — 자율개발·고도화 시스템 시작 기준
- Goal: move from prompt-following to a loop of observation → problem discovery → root cause → improvement design → implementation → test → evaluation → record → next improvement.
- Established the idea of long-term external memory and role separation for AI-assisted development.

### `1a0991a075a3b302` — 개발 AI 공용지식 공유 프로토콜 v1
- Established shared knowledge inheritance across AIs.
- Early default was to search `[AI AIOPS]` Gmail at the start of work and reuse decisions/failures/standards.
- Later superseded as a default by selective GitHub memory/context retrieval.

## CIVILIZATION research

### v2 — `1a0991e8a91a4f83` — 지식을 저장하지 말고 진화시켜라
- Shifted from storing answers to inheriting prior progress as a starting point.
- Core idea: preserve what survives correction; discard what fails; combine discoveries instead of copying prose.

### v3 — `1a09920cad5cc22e` — 증거 기반 지식 상속
- Addressed duplicated-error-as-evidence, vague confidence labels, weak benchmark/regression practice, conflicts, expiry, and over-generalization.
- Core change: inherit claims with evidence/provenance/lineage rather than naked memory.

### v4 — `1a09922ea0ddd790` — 자기교정 운영체제
- Added prediction/experiment/dependency/recovery thinking.
- Explicitly assumed good AI can still be wrong; knowledge itself must be falsifiable and correctable.

### v5 — `1a0992538f63018f` — 범용 지식 운영체제: Kernel·Domain Adapter·Context Compiler
- Broadened beyond a development-centric worldview.
- Separated common kernel from domain-specific reasoning and context compilation.
- Strong precursor to later UNIVERSAL / DOMAIN / LOCAL and Domain Pack architecture.

### v6 — `1a0992e30c368a84` — 선언에서 집행으로: 검증 가능한 업무 계약
- Converted abstract principles into explicit work/capability contracts.
- Separated artifact / verification / authorization / execution / outcome states.
- Added the capability-cell concept, minimal decision-gap context retrieval, evidence-vs-authority separation, research-vs-adoption separation, privacy boundary, and anti-version-inflation rule.
- Status in the mail: operating design + local structural prototype; practical performance still unverified.

### v7 — `1a09ab6323ec491f` — 연방형 AI 운영체제
- Added system topology: common planes, domain centers, project reality, outcome/evolution loop.
- Introduced the idea that repositories/centers own separate SSOTs while AI Core orchestrates across them.
- Research candidate, not automatic operational adoption.

### v8 — `1a09ac08579739a2` — 지속형 인지 런타임
- Added persistent task cognition: Goal Graph, World State, Decision Ledger, Evidence Index, Outcome Stream, Learning Queue, revision-bound Plan Slice.
- Goal: reduce context reconstruction and handoff loss between Chat/Work/tools/centers.
- Research candidate.

### v9 — `1a09ac6a6fd1fd9f` — 인간 조력 운영체제
- Shifted from system-centric orchestration to human-facing intent discovery.
- Added Human Intent Envelope, Question Value Gate, Domain Packs, proactive support levels, and follow-through.
- Explicitly rejects mind-reading: inferred intent is provisional.
- Research candidate.

### v10 — `1a09acf250dc71ff` — 인간 수탁 운영체제 / Human Stewardship
- Moved the six planes down into AI infrastructure and added a human-outcome layer above them.
- Direction / Reality / Foresight / Choice / Commitment / Resource / Agency / Resilience / Growth.
- Added portfolio/commitment conflict thinking and human agency as a distinct quality dimension.
- Research candidate; practical human-outcome improvement not yet proven.

## DEVKIT implementation line

### v6.1 — `1a0993e70cb41abd` — 재사용 개발 파일과 v1→v6 발전 비교
- Packaged reusable source/check/test/handoff/comparison/pilot material around v6.
- Distinguished reusable implementation package version from research CIVILIZATION version.

### v6.2 — `1a0995c7e37d32c2` — 공통 개발 표준 v1.0
- Introduced common development baseline: purpose/scope/done, SSOT/source boundary, reproducible execution, I/O and structure contract, security/authority, actual verification/regression/error cases, observability, recovery, change control, handoff.
- UI/DB/account/external connection/AI/deployment checks remain conditional rather than mandatory for every project.

### v6.3 — `1a0996cc49b6e014` — 검사 결과의 유효성
- Bound verification receipts to actual Git/file state and rerun timing.
- Main lesson: PASS is not durable if the source changed; reported changes must be compared with actual changes; zero/skipped/failed execution is not PASS.
- Added candidate Git verification profile 1.1.

### v6.4 — `1a09a5d3984db410` — 요구사항↔검사 추적성
- Added purpose/requirement binding on top of state binding.
- A current green check is insufficient if a required completion criterion is uncovered or changed.
- Manual/external verification remains separate from automated PASS.
- Mail status: LOCALLY_TESTED candidate; not independently validated or operationally adopted.

## Consolidation mail

### MASTER — `1a09a482b7c37da2` — 범용 업무 통합 플레이북 2026-09-13
- Consolidated the v6-era principles across development, documents, legal, business/management, operations, communication, and research.
- Reinforced separation of memory/verification/authorization/execution/outcome, selective context retrieval, Transfer Gate, and decision→outcome linkage.
- Explicitly stated Gmail is archive/distribution, not automatic operating-standard adoption.

## What is superseded vs retained

### Superseded defaults
- “Read all AIOPS Gmail before every task.” → replaced by current GitHub memory + decision-changing retrieval.
- “Newest mail = newest operating standard.” → replaced by explicit research/adoption state.
- “PASS can be reused if it once passed.” → replaced by revision/requirement-bound evidence.

### Retained foundations
- externalized memory across sessions/AIs;
- evidence/provenance/lineage;
- continuous correction;
- domain-sensitive reasoning;
- explicit work contracts;
- independent state machines for artifact/verification/authority/execution/outcome;
- real failures and outcomes as the source of meaningful evolution.