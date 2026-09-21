# AI Collaboration Protocol — GPT / Codex / Claude 협업 규칙

> **2026-09-21 적용 범위 변경:** 일반 AI 업무의 현재 정본은 [AI Working Standard](AI_WORKING_STANDARD.md)다. 이 문서의 고정 역할 순서와 GitHub Review Note 단계는 중요한 구조·통합 작업에서 선택적으로 재사용하며, 모든 업무의 필수 절차가 아니다. 중앙 오더나 특정 AI 순서를 새로 만들지 않고도 사용자의 현재 업무를 바로 진행할 수 있다.

- 문서 버전: 1.0
- 작성일: 2026-09-16 (Asia/Seoul)
- 상태: `COLLABORATION OPERATING RULE`

## 0. 목적

이 문서는 한 AI가 일방적으로 결론을 내려 다른 AI가 그대로 따르는 구조를 금지하고, **검토 의견 → 근거 → 선택지 → 권고안 → 구현 → 검증 → 반론/수정 → 결과 환류** 구조로 협업하기 위한 공통 규칙이다.

핵심 원칙:

> GPT는 검토·기획을 남기고, Codex는 코드/저장소 관점에서 검토·구현 근거를 남기며, Claude는 전체 구조와 실제 구현을 이어갈 수 있어야 한다. 어느 AI의 단독 판단도 자동으로 정본이 되지 않는다.

## 1. 역할

### GPT / ChatGPT

주 역할:
- 사용자 의도와 실제 목표 정리
- 현재 정본/과거 결정/업무 맥락 연결
- 구조·업무·운영 관점 검토
- 대안 비교와 권고안 작성
- Claude/Codex가 읽을 Work Packet/Review Note 작성
- 결과를 다시 사용자 관점에서 평가

금지:
- 추론만으로 코드 구조나 현재 저장소 상태를 확정
- 다른 AI가 검증해야 할 기술 판단을 확정 사실로 기록
- "내 의견 = 최종 결정"로 표현

### Codex / Work

주 역할:
- 실제 저장소 구조, 코드, dependency, build/test/runtime 검토
- GPT/Claude의 기획이 코드상 가능한지 반박/보완
- 구현 전 impact/reuse/충돌 분석
- branch/worktree에서 실제 구현·테스트
- commit SHA, 변경 파일, 검사 결과, 실패/생략을 반환

Codex는 단순 실행기가 아니다. **기획을 읽고 기술적으로 잘못된 부분이 있으면 반론을 남겨야 한다.**

### Claude

주 역할:
- GPT 검토 의견과 Codex 기술 검토를 함께 읽고 구조적으로 통합
- 큰 범위의 리팩터링/통합/멀티파일 구현
- 기존 시스템을 최대한 재사용하면서 실제 작업 진행
- 충돌하는 의견이 있으면 근거를 비교하고 구현 선택을 명시
- 완료 후 GitHub에 결과·검증·미확인·다음 작업 반환

Claude도 GPT 의견을 지시문으로만 읽지 않는다. 현재 코드/정본과 맞지 않으면 수정안을 제안한다.

## 2. GitHub에 남기는 기본 형식

GPT가 작업 방향을 제시할 때는 최소 아래 형식으로 남긴다.

```markdown
## GPT Review Note

### 사용자 목적
- ...

### 확인한 정본/근거
- source + revision

### 현재 문제
- ...

### 검토 의견
- ...

### 선택지
A. ...
B. ...
C. ...

### 권고안
- 추천: B
- 이유: ...

### 권고안의 가정/불확실성
- ...

### Codex가 확인할 것
- 실제 코드 구조
- 기존 재사용 가능 기능
- dependency/impact
- 테스트/빌드/배포 제약

### Claude가 구현 시 확인할 것
- Codex 검토 결과와 충돌 여부
- 최소 변경 범위
- 완료 기준

### 사용자 결정 필요
- 있으면 구체적으로, 없으면 NONE
```

"이렇게 해"만 남기지 않는다. **왜 그렇게 보는지와 틀릴 수 있는 지점**을 함께 남긴다.

## 3. Codex Review 형식

Codex는 GPT Review Note를 읽고 최소 아래를 반환한다.

```markdown
## Codex Technical Review

### 검토 대상
- GPT note / commit / requirement revision

### 실제 코드 관측
- repo / branch / SHA
- 관련 파일/모듈

### GPT 의견과 일치하는 부분
- ...

### 수정이 필요한 부분
- ...

### 기존 기능 재사용 후보
- ...

### 영향 범위
- ...

### 기술 선택지
A. ...
B. ...

### Codex 권고
- ...

### 검사 계획
- build/test/preview

### 남은 불확실성
- ...
```

Codex는 GPT의 문서가 최신 코드와 다르면 최신 코드 사실을 우선하고 차이를 기록한다.

## 4. Claude Implementation Note 형식

Claude는 GPT와 Codex를 함께 읽고 실제 구현 선택을 남긴다.

```markdown
## Claude Implementation Note

### 입력
- GPT Review Note revision
- Codex Technical Review revision
- target project revision

### 최종 구현 판단
- 채택한 안
- 채택하지 않은 안과 이유

### 구현 범위
- ...

### 기존 기능 재사용
- ...

### 실제 변경
- files / commit

### 검증
- PASS / FAIL / SKIP

### 사용자 지시와 다른 점
- 있다면 반드시 명시

### 미확인/위험
- ...

### 다음 작업
- ...
```

## 5. 의견 충돌 처리

의견 우선순위는 AI 이름으로 정하지 않는다.

1. 사용자의 최신 명시적 결정
2. 대상 프로젝트의 현재 정본/실제 코드/실제 데이터
3. revision-bound 실행/검증 evidence
4. 도메인 승인 규칙
5. GPT/Codex/Claude의 검토 의견
6. 일반 연구/과거 메모

예:
- GPT가 "A 구조가 좋다"고 했지만 Codex가 현재 코드상 A가 데이터 migration을 유발한다고 확인했다면 GPT 권고를 그대로 실행하지 않는다.
- Codex가 기술적으로 가능하다고 해도 사용자의 사업 의도와 다르면 Claude가 임의 채택하지 않는다.
- Claude가 더 나은 구현을 찾았으면 변경 이유와 검증 근거를 남긴다.

## 6. '검토 의견'과 '사용자 확정' 구분

모든 중요한 제안에는 provenance를 둔다.

- `USER_CONFIRMED` — 사용자가 직접 확정
- `SOURCE_DERIVED` — 코드/문서/실데이터에서 확인
- `GPT_REVIEW` — GPT의 검토 의견
- `CODEX_REVIEW` — Codex의 기술 검토
- `CLAUDE_REVIEW` — Claude의 구현/구조 검토
- `RESEARCH_CANDIDATE` — 아직 운영 채택되지 않은 연구

GPT/Codex/Claude 검토 의견은 서로 보완할 수 있지만 사용자 확정을 자동 대체하지 않는다.

## 7. 한 작업의 표준 흐름

```text
사용자 요청
  ↓
GPT: 목적/맥락/선택지/권고안 작성
  ↓
GitHub Review Note
  ↓
Codex: 실제 코드/영향/재사용/테스트 검토
  ↓
GitHub Technical Review
  ↓
Claude: 두 의견 + 정본을 보고 구현 판단
  ↓
branch/worktree 구현
  ↓
검증/Proof Bundle
  ↓
GPT 또는 별도 reviewer: 사용자 목적 충족 여부 재검토
  ↓
결과/다음 작업 기록
```

작은 작업은 일부 단계를 합칠 수 있지만, **중요한 구조 변경/통합/데이터/공통화 작업은 GPT 검토와 코드 관측을 분리**한다.

## 8. Codex와 Claude가 서로 이어받는 방식

Codex가 먼저 작업한 경우:
- commit/branch/SHA
- 변경 목적
- 실제 테스트
- 미완료/실패
- Claude가 이어서 볼 파일/모듈
을 HANDOFF에 남긴다.

Claude가 먼저 작업한 경우도 동일하다. 다음 AI가 전체 대화를 다시 읽게 하지 않는다.

## 9. 현재 AI Core 통합 작업에 적용

현재 본사·자회사 통합과 실제 업무 활용에서는:

- `GROUP_OPERATING_MODEL.md` = 사용자 확정 구조 원칙
- `AI_CORE_GROUP_MASTER_PLAN.md` = GPT가 작성한 구현 기획/권고안
- `AI_CORE_OPERATING_PLAYBOOK.md` = 실제 업무 활용에 대한 GPT 검토/운영 설계
- `AI_CORE_EVOLUTION_BRIDGE.md` = 고도화 연구 연결안
- Codex는 위 문서의 기술 가능성/기존 코드 재사용/impact를 검토
- Claude는 Codex 검토를 읽고 `GROUP-G0`, `OPS-P0`, `EVO-BRIDGE-P0`를 실제 구현

즉, **마스터 기획안을 절대명령으로 취급하지 않고 사용자 결정 + 코드 현실 + 검증 결과를 통해 구현안을 확정한다.**

## 10. 첫 협업 작업 — COLLAB-P0

Codex가 먼저 다음을 수행한다.

1. 최신 `main`의 아래 문서를 읽는다.
   - `WORK_READ_FIRST.md`
   - `docs/GROUP_OPERATING_MODEL.md`
   - `docs/AI_CORE_GROUP_MASTER_PLAN.md`
   - `docs/AI_CORE_OPERATING_PLAYBOOK.md`
   - `docs/AI_CORE_EVOLUTION_BRIDGE.md`
   - 이 문서
2. 현재 AI Core main과 관련 작업 브랜치의 실제 코드 자산을 inventory한다.
3. GPT 기획안에서 **이미 구현된 것 / 재사용 가능한 것 / 없는 것 / 충돌하는 것**을 구분한다.
4. `docs/handoffs/COLLAB-P0-CODEX-REVIEW.md` 또는 기존 동등 handoff 위치에 Technical Review를 남긴다.
5. 실제 구현은 하지 않아도 된다. 먼저 기술 검토를 완료한다.

그 다음 Claude는 Codex Technical Review를 읽고 첫 구현 범위를 정한다.

## 11. 완료 기준

이 협업 구조가 작동한다고 말하려면:

- GPT 의견이 근거/불확실성/선택지와 함께 남는다.
- Codex가 실제 코드 기준으로 반박/보완할 수 있다.
- Claude가 두 의견을 읽고 구현 선택을 명시한다.
- 사용자 확정과 AI 의견이 구분된다.
- 구현 결과가 다시 GitHub에 남아 다음 세션이 이어진다.
- 어느 AI도 자기 의견만으로 '완료/정본/채택'을 선언하지 않는다.
