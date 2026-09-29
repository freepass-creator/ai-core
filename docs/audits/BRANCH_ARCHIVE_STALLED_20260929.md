# 브랜치 아카이브 — 멈춘 가지 61개 (2026-09-29)

★대표 2026-09-29: 「브랜치 이런 거 **메인에 다 병합되게 한 방향으로** 잘 가게 해줘야 돼」

## 왜 이 61개인가

`registry/development-continuity-policy.json` 은 2026-09-26 부터 이미 이렇게 정해 두었다:

- ai-core 프로필 `COMPLEX` → 활성 작업선 **hard_max 3**
- 가지 수명 `critical: 72시간`
- `actor_prefixed_unique_target: 0` · `stale_unique_target: 0`

★**아무도 강제하지 않았다.** 그래서 원격 가지가 126개가 됐다.
`check-branch-discipline.mjs` 는 «PR 의 head» 하나만 본다 — 이미 서 있는 가지는 아무도 안 봤다.
이번에 전수 검사 `scripts/check-branch-flow.mjs` 를 붙였다.

이 61개는 **2026-09-13 ~ 09-21 에 멈췄고 열린 PR 이 없다.** main 으로 흐르지 않는 가지다.

## 보존 — 지워도 사라지지 않는다

```
아카이브 커밋   ac62c590e0400d027f5dbee56e5b3a3695294c3c
브랜치          work/ai-core/archive-stalled-20260929
부모            63 (자신 1 + main 1 + head 61)
트리            origin/main 과 동일 — 내용 변화 0
검증            61개 전부 조상 · 누락 0
```

## 되살리는 법

```bash
git fetch origin work/ai-core/archive-stalled-20260929
git checkout -b work/ai-core/<새-work-id> <아래 sha>
```

## 목록

| 브랜치 | sha | 마지막 커밋 |
|---|---|---|
| `c-session/logical-execution-identity-v1-20260920` | `00c477b35342` | 2026-09-20 |
| `c-session/logical-execution-identity-v2-20260920` | `08b4377db5a0` | 2026-09-20 |
| `chat/research-notebook` | `abdf681eeda5` | 2026-09-13 |
| `codex/ai-core-main-sync-20260920` | `e8ccbf5938d5` | 2026-09-20 |
| `codex/ai-core-recovery-20260921` | `dd2a59cff29b` | 2026-09-21 |
| `codex/ai-core-usable-flow-20260920` | `499e084720d9` | 2026-09-20 |
| `codex/firebase-operating-data-map-20260920` | `54ca913bdbb1` | 2026-09-20 |
| `codex/github-release-automation-20260921` | `7e4784755364` | 2026-09-21 |
| `codex/local-repo-cleanup-20260920` | `a53aa90c1d8d` | 2026-09-20 |
| `codex/order-continuity-hardening-20260920` | `c890822614fd` | 2026-09-20 |
| `codex/order-lifecycle-hardening-20260920` | `f428452c99e5` | 2026-09-20 |
| `codex/release-automation-20260921` | `9529948327cd` | 2026-09-21 |
| `codex/result-delivery-recovery-20260920` | `5d8f5417bf7f` | 2026-09-21 |
| `codex/runtime-set-catalog-20260921` | `9fffae4fbdb9` | 2026-09-21 |
| `codex/self-evolution-evidence` | `f08e79e2be5f` | 2026-09-15 |
| `gpt/intake-snapshot-rmw-lock-20260921` | `0699927a9f25` | 2026-09-21 |
| `gpt/project-runtime-revision-binding-20260921` | `a133e3e91b31` | 2026-09-21 |
| `gpt/uiux-target-binding-preflight-20260921` | `afecdf411031` | 2026-09-21 |
| `work/codex/order-control-v1` | `06cbba78425b` | 2026-09-16 |
| `audit/freepass-jpk-firebase-map-20260920` | `08d71155a493` | 2026-09-20 |
| `docs/chat-github-handoff-policy-20260920` | `0fe9e864799c` | 2026-09-21 |
| `docs/freepass-ui-standard-v1-20260919` | `c4413d881b09` | 2026-09-19 |
| `docs/issue-178-rental-erp-jpk-work-contract` | `e464324595b7` | 2026-09-20 |
| `docs/project-naming-registry-20260920` | `37fd3e25bbe7` | 2026-09-20 |
| `docs/public-product-ui-standard-20260919` | `27089d86851d` | 2026-09-19 |
| `docs/session-missions-2` | `541b61c676d3` | 2026-09-16 |
| `experiment/development-episode-pilot-v0.1` | `3c198613606f` | 2026-09-14 |
| `feat/freepass-suite-ui-consumers-20260921` | `92c1b439b663` | 2026-09-21 |
| `feature/human-agency-v0.5` | `5611133cb3dc` | 2026-09-14 |
| `fix/a-session-claim-episode-consistency-20260920` | `1af857173f88` | 2026-09-20 |
| `fix/ai-core-recovery-mode-20260920` | `27d7f216a6cb` | 2026-09-20 |
| `fix/capability-live-result-v1` | `ccd0b7aa40ce` | 2026-09-19 |
| `fix/g0-control-tower-parity` | `cb53be0d4b7c` | 2026-09-17 |
| `fix/ledger-revision-continuity` | `ecce1093eefe` | 2026-09-18 |
| `group/g0-result` | `1b23cc9da75a` | 2026-09-17 |
| `noop` | `722b86f2e524` | 2026-09-13 |
| `protocol/chat-work-handoff-v0.1` | `6de66dd0b104` | 2026-09-13 |
| `research/a-intake-worker-v1-20260920` | `604103c6cad7` | 2026-09-20 |
| `research/a-intake-worker-v1-refresh2-20260920` | `128bc6a4bec1` | 2026-09-20 |
| `research/a-receiver-inbox-v1-20260920` | `6cd5307f5192` | 2026-09-20 |
| `research/a-review-allocator-v1-20260920` | `73b44e04016b` | 2026-09-20 |
| `research/a-review-allocator-v1-final-20260920` | `b450c89c2ae6` | 2026-09-20 |
| `research/a-review-allocator-v1-final2-20260920` | `e33299f5e31f` | 2026-09-20 |
| `research/a-review-pack-v1-20260920` | `4a030f320982` | 2026-09-20 |
| `research/a-session-post-phase1` | `cce8b414f26c` | 2026-09-19 |
| `research/a-session-post-phase1-c-v1` | `8d91df6f6b62` | 2026-09-20 |
| `research/a-session-rescan-20260920` | `1b98b8be5ad4` | 2026-09-20 |
| `research/a-session-rescan-20260920-v2` | `58be7b6f426f` | 2026-09-20 |
| `research/cognitive-runtime-v0.1` | `8a593def0e23` | 2026-09-13 |
| `research/document-domain-v0.1` | `2430f4a52375` | 2026-09-13 |
| `research/evolution-engine-v0.1` | `bab62bafe20b` | 2026-09-13 |
| `research/federation-architecture-v0.1` | `ef29815fe9c4` | 2026-09-13 |
| `research/human-orchestration-v0.1` | `9fb1e781e4f7` | 2026-09-13 |
| `research/human-stewardship-v0.1` | `9cb9d4f01191` | 2026-09-13 |
| `research/precision-speed-controller-v0.1` | `642bdbe041b4` | 2026-09-13 |
| `research/self-improvement-loop-v0.1` | `876ee1749e7c` | 2026-09-13 |
| `work/ai-core-no-actions-20260920` | `f2d83a814024` | 2026-09-20 |
| `work/capability-execution-e2e-p0` | `e9dbc3f81fa0` | 2026-09-19 |
| `work/chat/integration-monitor-20260916` | `4ca0b9c171ef` | 2026-09-16 |
| `work/final-consolidation-standards-bundle-20260920` | `72b52a863e5d` | 2026-09-20 |
| `work/gpt-shared-work-ui-v2` | `75b6cd212ddc` | 2026-09-18 |
