# AI Core Architecture v0.1

## Router
요청을 `domain / project / intent / risk / authority / freshness`로 분류한다.

## Source Resolver
AIOPS·DevCenter·프로젝트 원본에서 이번 판단의 정본 포인터를 찾는다. 정본을 Core로 복사하지 않는다.

## Context Compiler
현재 작업을 바꿀 정보만 Context Packet으로 조립한다. 오래된 요약보다 최신 원본 충돌을 우선 표시한다.

## Capability Resolver
DevCenter의 `registry / standards / capabilities / design / quality`에서 재사용 후보를 찾는다. candidate와 verified/adopted를 같은 것으로 취급하지 않는다.

## Planner
작업 범위, 변경 허용 대상, 역할, 완료 조건, 검증, 복구, 승인 필요 여부를 Work Packet으로 만든다.

## Verifier
현재 revision과 Evidence Packet을 대조한다. 필수 검토 역할이 빠지면 HOLD다.

## Outcome Collector
예상과 실제 결과를 분리한다. 성공 응답과 실제 효과도 분리한다.

## Evolution Engine
Outcome에서 개선 후보를 만든다. AIOPS/DevCenter 정본을 자동 수정하지 않고 소유 시스템의 검토 절차로 돌려보낸다.

## 상태
`INTAKE → SOURCED → PLANNED → EXECUTED? → VERIFIED → OBSERVED → LEARNING_CANDIDATE`

보조 상태: `HOLD / BLOCKED / STALE / REJECTED`.

AI Core는 AIOPS의 기존 A/B/C/D 위험 등급과 CONTROL_PLANE, DevCenter의 대상별 점검 규정을 덮어쓰지 않는다.
