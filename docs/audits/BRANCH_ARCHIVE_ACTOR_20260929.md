# 브랜치 아카이브 — 마지막 15개 (2026-09-29)

1차 work/gpt 43개, 2차 멈춘 61개에 이은 **3차이자 마지막**이다.

## 왜 이제야 닫았나

이 15개는 대부분 **actor 이름 «최근»** 가지였다. 2차 때 일부러 남겼다 —
`codex/knowledge-refresh-20260929` 가 그날 만들어진 것이었듯, 남이 «쓰는 중»일 수 있었기 때문이다.
묶어서 닫으면 남의 작업을 끊는다.

1순위 규칙대로 Codex 에 물었고(2026-09-29), 답이 명확했다:

> (가) 없음. 나는 `work/ai-core/OPS-ERP5-PREWORK-20260928` 사용 중.
> (나) 12개 모두 동일 절차로 닫아도 됨.
> (다) PR 은 `work/` 로 다시 열 것. 예외 비추천.
> (라) 반례는 동시 생성 경합·긴급 작업 차단. **원자적 검사와 만료형 예외만 허용.**

(라) 를 정책에 반영했다 — `flow_enforcement.expiring_exceptions`. **만료 없는 예외는 받지 않는다.**
만료 없는 예외는 영구 구멍이 되고, 이 저장소가 바로 그렇게 126개가 됐다.

## 닫지 않은 하나

`codex/knowledge-refresh-20260929` 은 **열린 PR #337** 로 main 을 향하는 중이다.
이름만 규칙 위반이라 지금 끊으면 «흐르던 일»을 막는다. **2026-10-06 만료 예외**로 두었다 —
그때까지 `work/` 이름으로 다시 열지 않으면 검사가 스스로 다시 빨개진다.

## 보존

```
아카이브 커밋   af5280e6b02dfdf5d225a439e1b836cf076c06b0
브랜치          work/ai-core/archive-actor-20260929
부모            17 (자신 1 + main 1 + head 15)
트리            origin/main 과 동일 — 내용 변화 0
검증            15개 전부 조상 · 누락 0
```

## 목록

| 브랜치 | sha | 마지막 커밋 |
|---|---|---|
| `claude/erp-platform-prototype-9hzh8d` | `b3a4b78f1dad` | 2026-09-23 |
| `claude/startup-erp-spec-0yjg5x` | `e0b5b4882288` | 2026-09-23 |
| `docs/claude-codex-desk` | `42ab0b1ec39c` | 2026-09-22 |
| `gpt/activation-authority-contract-20260925` | `a7574777e898` | 2026-09-25 |
| `gpt/audit-readiness-enforced-source-boundary-20260925` | `eaae1211b986` | 2026-09-25 |
| `gpt/control-tower-authorization-canonical-boundary-20260925` | `720020d7e83c` | 2026-09-25 |
| `gpt/control-tower-proof-boundary-20260925` | `05b177aab38d` | 2026-09-25 |
| `gpt/core-receipt-fail-closed-contract-20260922` | `622afde9fbb2` | 2026-09-22 |
| `gpt/docshub-transition-boundary-20260923` | `30e37b1da757` | 2026-09-23 |
| `gpt/starter-kit-admission-convergence-20260922` | `f3d1956dbec2` | 2026-09-22 |
| `gpt/starter-kit-bootstrap-revision-gate-20260922` | `4b3559abd9f8` | 2026-09-22 |
| `gpt/starter-kit-revision-binding-20260922` | `dc755a699577` | 2026-09-22 |
| `gpt/workflow-recovery-blank-error-boundary-20260925` | `d47c4a69389b` | 2026-09-25 |
| `integration/docshub-templates` | `3921f431906b` | 2026-09-23 |
| `integration/shadow-freshness` | `e4a60aeb4375` | 2026-09-23 |
