# 열린 PR 재고 정리 — 2026-09-23

> 자동 생성: `node scripts/pr-backlog-triage.mjs --write`. 손으로 고치지 않는다.

통합의 병목은 «만드는 속도»가 아니라 «합치는 속도»다. 지금 **열린 PR 78개**(초안 50) 중
**17개가 이미 충돌**하고 있다. 하나를 합칠 때마다 나머지가 더 어긋난다.

## 지금 상태

| 갈래 | 수 | 뜻 |
|---|---|---|
| 바로 합칠 수 있음 (CLEAN) | 29 | 충돌 없음 · 검사 통과 |
| 검사가 막힘 (UNSTABLE) | 32 | ★GitHub Actions 가 결제 문제로 «시작조차» 못 한다 |
| 충돌 (DIRTY) | 17 | 다시 얹어야 한다 |

## ★같은 파일을 여럿이 건드린다 — 충돌의 구조적 원인

| 그 파일을 건드리는 PR 수 | 파일 |
|---|---|
| 18 | `package.json` |
| 15 | `docs/episodes/ORDER-DESK-001.json` |
| 7 | `README.md` |
| 6 | `registry/workflows.json` |
| 6 | `.github/workflows/main-state.yml` |
| 5 | `src/engine/capability-engine.mjs` |
| 4 | `registry/workflow-bridges.json` |
| 4 | `src/orders/server.mjs` |
| 4 | `docs/UI_UX_START_HERE.md` |
| 3 | `test/capability-execution-api.test.mjs` |

**`docs/episodes/ORDER-DESK-001.json` 이 가장 아프다.** 규칙상 모든 PR 이 자기가 바꾼 파일을 이 «한 배열»에 적어야 해서,
PR 이 늘어날수록 **서로가 서로를 충돌시킨다**. 내용이 겹쳐서가 아니라 «같은 줄에 적어야 해서» 충돌한다.

## 주제별 묶음 (한 번에 하나씩 합치기 위한 단위)

| 수 | 주제 | 번호 |
|---|---|---|
| 15 | AI | 19, 18, 17, 16, 14, 11, 10, 9 … |
| 5 | docs | 248, 177, 175, 174, 91 |
| 4 | feat | 197, 196, 195, 194 |
| 3 | [Claude] | 262, 261, 219 |
| 3 | fix(adapter) | 256, 254, 253 |
| 3 | A | 139, 138, 125 |
| 3 | C | 131, 130, 129 |
| 2 | fix(result) | 249, 237 |
| 2 | fix(shared-services) | 247, 246 |
| 2 | fix(academy) | 217, 207 |
| 2 | Add | 188, 21 |
| 2 | B | 136, 127 |

## 가장 오래 열려 있는 것

- #1 · 9일 · AI Core v0.4 candidate — continuous learning and domain proof gates
- #2 · 9일 · AI Core protocol — Chat ↔ Work handoff v0.1
- #3 · 9일 · AI Core research — outcome-based Evolution Engine v0.1
- #4 · 9일 · AI Core research — bounded Self-Improvement Loop v0.1
- #5 · 9일 · AI Core research — Precision-Speed Learning v0.1
- #7 · 9일 · AI Core research — Document Domain & DocsHub integration v0.1
- #8 · 9일 · AI Core research — Federation Architecture v0.1
- #9 · 9일 · AI Core research — Cognitive Runtime v0.1

## 제안 (판단은 대표가)

1. **결제부터** — Actions 가 멈춰 있어 32개가 검사조차 못 받는다. 이걸 풀지 않으면 나머지는 의미가 없다.
2. **에피소드 목록 규칙을 바꾼다** — 지금은 PR 하나가 모든 PR 을 충돌시킨다.
   목록을 PR 별 파일로 쪼개거나, `verify-main-state` 가 git diff 에서 «유도»하게 하면 이 충돌이 사라진다.
3. **주제 단위로 한 묶음씩** — 같은 주제 PR 을 한 번에 올리고, 합친 직후 나머지를 다시 얹는다.
4. **9일 넘게 열린 것부터 판정** — 합칠지 닫을지. 열어 두는 것 자체가 비용이다.
