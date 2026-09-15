# AI Core Multi-AI Council — 다중 AI 합의·조정 운영 규칙

- 문서 버전: 1.0
- 작성일: 2026-09-16 (Asia/Seoul)
- 상태: `USER-DIRECTED OPERATING PRINCIPLE`

## 0. 목적

AI Core는 이름 그대로 하나의 AI가 독단적으로 판단하는 시스템이 아니라, 가능한 여러 AI/CLI 실행자에게 동일한 문제를 검토시키고 서로의 근거·반론·제약을 비교해 **합의된 의견 또는 조정된 의견**을 만든 뒤 실제 업무와 개발에 반영하는 본사 의사결정 계층이다.

절대적인 정답 AI는 가정하지 않는다. 모델별 강점·한도·가용성·세션 상태·도구 접근권한은 달라질 수 있고 언제든 변할 수 있다. 따라서 특정 모델 이름, 요금제, 토큰 한도, CLI 가용성을 영구 전제로 설계하지 않는다.

핵심 흐름:

`사용자 목적 → 문제 구조화 → 관련 정본 고정 → 복수 AI/CLI 검토 → 의견 비교 → 충돌 조정 → 합의/조정안 → 실행자 선택 → 구현/실행 → 검증 → 결과 환류`

## 1. Council 원칙

1. 한 AI의 의견은 `REVIEW`이지 자동 정본이 아니다.
2. 가능한 경우 중요한 구조·통합·공통화·복구·대규모 구현은 2개 이상 독립 관점으로 검토한다.
3. AI 이름보다 실제 capability, 현재 도구 접근, subject revision 이해도, 검증 가능성을 우선한다.
4. 모든 AI가 같은 의견을 내는 것을 목표로 하지 않는다. **불일치의 이유를 드러내고 조정된 최종안**을 만드는 것이 목적이다.
5. 의견 수가 많은 쪽을 자동 채택하지 않는다. 근거의 질, 최신성, 실제 코드/데이터와의 일치, 검증 증거를 본다.
6. 사용자의 최신 명시적 결정과 프로젝트 정본은 AI 합의보다 우선한다.
7. 합의가 안 되면 `HOLD` 또는 사용자 결정 필요 상태를 명확히 남긴다.

## 2. 참여자

Council 참여자는 고정하지 않는다.

가능한 역할 예:
- ChatGPT/GPT: 사용자 목적·맥락·업무 구조·대안 검토
- Codex: 실제 코드/저장소/테스트/재사용·영향 분석
- Claude CLI/Claude Code: 대규모 구조 통합·리팩터링·멀티파일 구현 검토
- Gemini CLI: 별도 기술 검토·독립 의견·교차 확인
- 기타 CLI/agent: 현재 연결되고 검증 가능한 capability가 있으면 참여 가능

`model_name`보다 아래 메타데이터를 남긴다.

```yaml
reviewer_id: <현재 실행자 식별>
capabilities: []
source_revision_seen: <commit/revision>
tools_used: []
independent_from: []
limitations: []
```

## 3. Council Packet

중요 작업은 복수 AI에게 같은 핵심 Packet을 준다.

```yaml
council_id: COUNCIL-<domain>-<number>
user_goal: <사용자 목적>
subject: <검토 대상>
authoritative_sources:
  - pointer: ...
    revision: ...
constraints: []
non_goals: []
questions:
  - <무엇을 판단할 것인지>
required_output:
  - observations
  - risks
  - options
  - recommendation
  - uncertainties
  - tests_needed
```

대화 전체를 그대로 전달하지 않고 의사결정에 필요한 정본과 맥락만 전달한다.

## 4. 의견 수집 형식

각 AI/CLI는 최소 다음을 반환한다.

```markdown
## Council Review

### 확인한 사실
- ...

### 해석/검토 의견
- ...

### 동의하는 기존 의견
- ...

### 반대/수정 의견
- ...

### 선택지
A. ...
B. ...

### 권고
- ...

### 근거
- source/revision/test

### 불확실성/한계
- ...

### 실행 전 필요한 검사
- ...
```

## 5. 합의와 조정

Council 결과는 세 가지 중 하나다.

### `CONSENSUS`
독립 검토자들이 핵심 구현/운영 방향에 동의하고 근거도 일치한다.

### `ADJUSTED_CONSENSUS`
의견이 달랐지만 실제 정본·검증·조건을 기준으로 절충/보완안이 만들어졌다. 어떤 의견을 왜 버렸는지 기록한다.

### `HOLD`
핵심 사실, 권한, source revision, 테스트 결과 또는 사용자 가치판단이 부족해 지금 결정하면 위험하다.

다수결은 보조 정보일 뿐 최종 규칙이 아니다.

## 6. 조정 우선순위

충돌 시 다음 순서로 본다.

1. 최신 사용자 확정
2. 실제 코드/데이터/배포/업무 정본
3. revision-bound 실행·검증 evidence
4. 해당 도메인의 승인·운영 규칙
5. Council 참여 AI의 검토 의견
6. 일반 연구·과거 메모

## 7. 비용/속도 적응형 운영

모든 작은 작업에 무조건 많은 AI를 호출하지 않는다. 중요한 것은 다중 AI 사용 자체가 아니라 의사결정 품질이다.

### Fast Path
- 작은 문서 수정
- 영향이 국소적이고 검증이 쉬운 코드 수정
- 기존 패턴 반복

한 실행자 + 자동 검사로 충분할 수 있다.

### Council Path
- AI Core 구조/통합
- 폴더/저장소 물리 재편
- 공통 기능 승격
- 대규모 리팩터링
- 데이터/배포/권한 경계 변경 가능성
- 여러 프로젝트에 영향을 주는 표준 변경
- 복구/비상 절차

2개 이상 관점 또는 독립 검토를 기본으로 한다.

현재 이용 가능한 AI/CLI 수, 한도, 속도는 동적으로 판단한다. 어떤 도구가 unavailable이면 전체 작업을 멈추기보다 가능한 검토 범위와 독립성 수준을 명시한다.

## 8. 물리 통합 판단과 Council

흩어진 폴더·저장소를 정리할 때 Council은 각 대상을 아래 네 가지로 분류한다.

### `MERGE_PHYSICAL`
같은 생명주기·같은 SSOT·같은 배포 경계이고 분리 유지의 가치가 없는 중복/파편. 실제 파일/폴더를 합칠 후보.

### `COLOCATE_ONLY`
로컬 `AI-CORE-GROUP` 아래 함께 두되 Git 이력·SSOT·배포는 독립 유지.

### `EXTRACT_SHARED`
프로젝트는 독립 유지하고 실제 반복되는 공통 capability만 본사/DevCenter/shared-services로 추출.

### `KEEP_SEPARATE`
업무 의미·데이터·브랜드·배포·권한 경계가 독립적이므로 별도 프로젝트로 관리.

판정 전에 반드시 확인:
- 원격 Git/현재 HEAD
- 로컬 미커밋/미추적 작업 존재
- 실제 배포 경로
- 데이터/환경변수/스케줄러 의존성
- SSOT 중복 여부
- 동일 코드가 실제 중복인지 의미가 다른지
- 롤백 가능성

## 9. AI Core 합병·통합의 최우선 목표

현재 최우선 목표는 다음이다.

> **물리적으로 흩어진 AI/개발/업무 자산을 inventory하고, 합칠 것은 안전하게 합치고, 별도 관리가 맞는 것은 그룹 작업공간에서 독립 프로젝트로 정리하여, AI Core를 가능한 빨리 실제 업무의 기본 진입점으로 사용한다.**

우선순위:
1. 실제 자산 inventory
2. 물리 통합/공존/공통추출/독립유지 판정
3. 본사 공통 기능 연결
4. 실제 업무 Work Router 연결
5. 한 프로젝트/한 업무 end-to-end 검증
6. 점진적 확대

완벽한 미래 구조를 먼저 만드는 것보다 **현재 흩어진 자산을 안전하게 정리해 바로 쓸 수 있는 상태**를 앞세운다.

## 10. 첫 실행 — COUNCIL-GROUP-P0

Claude/Codex 등은 실제 로컬/GitHub inventory를 읽고 다음을 만든다.

1. 현재 모든 관련 폴더/저장소 목록
2. 각 대상의 실제 역할/정본/배포/데이터 경계
3. `MERGE_PHYSICAL / COLOCATE_ONLY / EXTRACT_SHARED / KEEP_SEPARATE` 초안
4. 서로 다른 AI/CLI 최소 2개 관점의 검토
5. 충돌표와 조정안
6. 우선 통합 대상 1~3개
7. 운영 중단 없이 실행할 물리 통합 순서
8. rollback 계획

첫 결과 권장 위치:
`docs/handoffs/COUNCIL-GROUP-P0-RESULT.md`

이 단계에서는 대량 이동/삭제/운영 전환을 자동 실행하지 않는다. 먼저 실제 inventory와 조정안을 확정한다.
