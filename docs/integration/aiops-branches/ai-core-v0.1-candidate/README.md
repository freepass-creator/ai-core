# AI Core v0.1

AI Core는 AIOPS의 기억과 DevCenter의 검증된 개발 능력을 **복사하지 않고 조합**하는 상위 오케스트레이션 규격이다.

> AI Core는 정본을 소유하지 않는다. 정본을 찾는다.
> AI Core는 모든 능력을 구현하지 않는다. 검증된 능력을 조합한다.
> AI Core는 AI 합의를 진실로 취급하지 않는다. 원본·재현·실행 결과를 우선한다.

## 상태

**DESIGN CANDIDATE / SAFE SCAFFOLD**

- 운영 데이터 변경 없음
- 외부 배포 없음
- AIOPS/DevCenter 기존 규칙 변경 없음
- 자동 실행 없음
- 존재 자체가 운영 채택·검증 완료·모든 AI 자동 적용을 뜻하지 않음

## 책임

- **AIOPS**: 회사 업무 지식, 운영 도구, 사고·학습, 업무 SSOT 포인터
- **DevCenter**: 개발 규격, 재사용 자산, 점검·시정·재검사
- **AI Core**: 목표 해석, 정본 라우팅, 컨텍스트 조립, 능력 선택, 계획, 검증 요청, 결과 환류
- **Projects**: 실제 구현과 현실 결과
- **Gmail**: 연구 역사·백업·세대 기록

## 기본 흐름

`요청 → Task Envelope → Source Pointer → Context Packet → Capability Reference → Work Packet → Evidence Packet → Outcome → Learning Candidate`

1. 요청을 업무 영역·프로젝트·위험·권한으로 분류한다.
2. 필요한 정본 포인터만 찾는다. 모르면 추측하지 않고 HOLD한다.
3. DevCenter의 검증된 자산을 우선 찾고, 신규 제작이면 이유를 남긴다.
4. 작업 범위와 완료 조건을 고정한다.
5. 위험 작업은 기존 AIOPS/DevCenter 승인 게이트를 그대로 따른다.
6. 결과는 현재 revision과 증거에 묶어 검증한다.
7. 실제 결과가 확인된 뒤에만 재사용 지식/능력 후보로 승격한다.

## 문서

- `CONSTITUTION.md` — 불변 원칙
- `ARCHITECTURE.md` — Router/Resolver/Compiler/Planner/Verifier/Evolution
- `CONTRACTS.md` — 시스템 간 최소 데이터 계약
- `ADOPTION.md` — 읽기 전용 파일럿부터의 채택 절차
- `EVOLUTION.md` — 실패 모드 중심 진화 규칙

AI Core는 AIOPS의 `AGENTS.md`, `AI_GUIDE.md`, `docs/CONTROL_PLANE.md`와 DevCenter의 `AGENTS.md`, `operations/inspection/POLICY.md`, `docs/BASELINE.md`를 대체하지 않는다. 해당 업무에서 필요한 원문을 직접 읽는다.
