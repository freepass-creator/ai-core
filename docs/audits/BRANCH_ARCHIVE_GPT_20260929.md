# 브랜치 아카이브 — work/gpt 43개 (2026-09-29)

★대표 2026-09-28: UFEI 로 가려면 고정 lane 넷만 남아야 한다. 그 전에 «보존»이 먼저다(Codex: 보존·분류 → 통합 → 검증 → 순차 폐쇄).

## 왜 이 43개인가

- 전부 `work/gpt/…` — **actor 이름 브랜치**다. `scripts/check-branch-discipline.mjs` 가 `ACTOR_OWNED_BRANCH_FORBIDDEN` 으로 이미 금지한다.
- 마지막 커밋이 2026-09-19 ~ 09-21 에 멈춰 있다.
- 규칙상 살아 있으면 안 되는 이름인데 43개가 남아 있었다 — 규칙이 «새 PR» 만 보고 «기존 브랜치» 는 안 봤기 때문이다.

## 보존 방식 — 지워도 사라지지 않는다

저장소에 이미 있던 방식을 그대로 쓴다(`work/ai-core/archive-research-history-20260926`, 부모 20개).
아카이브 커밋 하나에 43개 head 를 **부모로** 달아 도달 가능성을 붙잡는다. 트리는 `origin/main` 그대로라 **내용은 하나도 안 바뀐다**.

```
아카이브 커밋   7a8aab7d3efcd94e15ee9046edb98c52cdd67cc4
브랜치          work/ai-core/archive-gpt-lanes-20260929
부모            45 (자신 1 + main 1 + head 43)
검증            43개 전부 조상으로 확인 · 누락 0
```

## 되살리는 법

```bash
git fetch origin work/ai-core/archive-gpt-lanes-20260929
git checkout -b <새-작업선-이름> <아래 sha>
```

## 목록

| 브랜치 | sha | 마지막 커밋 |
|---|---|---|
| `work/gpt/a-aiops-cutover-rescan-20260920` | `894cfd0ff8f6` | 2026-09-20 |
| `work/gpt/a-aiops-cutover-rescan-v2-20260920` | `255220b319d3` | 2026-09-20 |
| `work/gpt/a-review-allocator-successor-v1` | `e48ccc0b7f54` | 2026-09-20 |
| `work/gpt/a-successor-inventory-repair-20260920` | `755a75a08524` | 2026-09-20 |
| `work/gpt/ai-core-master-map-20260919` | `4babb11fbd2d` | 2026-09-19 |
| `work/gpt/ai-core-master-map-v2-20260919` | `51ac0e4889ff` | 2026-09-19 |
| `work/gpt/b-machine-conformance-gate-v1` | `79b12511db6c` | 2026-09-20 |
| `work/gpt/b-sales-consumer-sync-20260920` | `cb6d295b0930` | 2026-09-20 |
| `work/gpt/build-deploy-governance-p0-candidate-20260920` | `8bd7fb26338b` | 2026-09-20 |
| `work/gpt/business-planning-adapter-v1` | `052d8fdf7ecc` | 2026-09-20 |
| `work/gpt/c-fact-evidence-v1` | `7857ef1b46f5` | 2026-09-20 |
| `work/gpt/c-proof-input-binding-v1` | `0333f3b819c4` | 2026-09-20 |
| `work/gpt/c-schedule-observation-v1` | `f4cd411e3031` | 2026-09-20 |
| `work/gpt/capability-readiness-gate-v1` | `374266c0b720` | 2026-09-20 |
| `work/gpt/d-compensated-multiwrite-v1` | `da656eea8935` | 2026-09-20 |
| `work/gpt/d-schedule-timing-v1` | `f7201f0a68ff` | 2026-09-20 |
| `work/gpt/group-integration-colocate-adapter-v1` | `eed096e3c458` | 2026-09-20 |
| `work/gpt/group-integration-executor-v1` | `b150b107c95e` | 2026-09-20 |
| `work/gpt/group-integration-keep-separate-adapter-v1` | `9f7e56d2f2ce` | 2026-09-20 |
| `work/gpt/group-integration-plan-compiler-v1` | `758dc8e5b6f8` | 2026-09-20 |
| `work/gpt/group-integration-preflight-receipt-v1` | `efe70b8deb07` | 2026-09-20 |
| `work/gpt/group-integration-work-packet-v1` | `81dbed4001bc` | 2026-09-20 |
| `work/gpt/project-4-audit-readiness-20260920` | `dbc0ad1a6d44` | 2026-09-20 |
| `work/gpt/project-audit-readiness-v1-20260920` | `4fe23a28098b` | 2026-09-20 |
| `work/gpt/project-registry-candidate-v1` | `009c163e993f` | 2026-09-20 |
| `work/gpt/qa-observability-p0-candidate-20260920` | `6d381ede70bf` | 2026-09-20 |
| `work/gpt/qa-observability-p0-candidate-v2-20260920` | `584026ecaaac` | 2026-09-20 |
| `work/gpt/sales-customer-search-activation-v1` | `64f7e7339816` | 2026-09-20 |
| `work/gpt/security-audit-machine-enforcement-gate-v1-20260920` | `8bb6993f75bd` | 2026-09-20 |
| `work/gpt/security-audit-p0-candidate-20260920` | `dc8c255ece5b` | 2026-09-20 |
| `work/gpt/security-audit-p0-candidate-v2-20260920` | `791d0e1963cd` | 2026-09-20 |
| `work/gpt/security-audit-promotion-gate-v1-20260920` | `b60597e878e8` | 2026-09-20 |
| `work/gpt/shared-extraction-candidate-v1` | `c3685ad43ccb` | 2026-09-20 |
| `work/gpt/ui-composition-search-discovery-20260921` | `fb3d852cedf4` | 2026-09-21 |
| `work/gpt/uiux-b5-promotion-gate-20260919` | `5050d720c851` | 2026-09-20 |
| `work/gpt/uiux-b5-promotion-replay-20260920-v2` | `9af853473e23` | 2026-09-20 |
| `work/gpt/workflow-d5-admin-derived-projection-20260920` | `dec983004ce9` | 2026-09-20 |
| `work/gpt/workflow-d6-source-parity-evidence-20260920` | `c4b9b120586d` | 2026-09-20 |
| `work/gpt/workflow-d6-source-parity-evidence-refresh-20260920` | `062d9a91afe7` | 2026-09-20 |
| `work/gpt/workflow-d7-sales-forward-skip-20260920` | `cdd820fe1e99` | 2026-09-20 |
| `work/gpt/workflow-d8-sales-source-parity-20260920` | `32cdea6bf9e7` | 2026-09-20 |
| `work/gpt/workflow-d8-sales-source-parity-replay-20260920` | `9ffd1e1f44bd` | 2026-09-20 |
| `work/gpt/workflow-standard-v2-engine-admission-20260920` | `562b072e5272` | 2026-09-20 |
