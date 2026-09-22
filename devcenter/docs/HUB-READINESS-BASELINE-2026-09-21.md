# Hub Readiness Baseline — 2026-09-21

평가 기준: `hubs/readiness.json`  
목표: 모든 Hub 90% 이상 + critical axis(contract/source/runtime/validation) 전부 VERIFIED

| 순위 | Hub | Readiness | 상태 | 가장 큰 현재 gap |
|---:|---|---:|---|---|
| 1 | Design Hub | 56.25% | PARTIAL | Hub-owned compile/render/visual receipt loop |
| 2 | Data Hub | 56.25% | PARTIAL | generic Data Hub runtime + backup/restore verification |
| 3 | Quality Hub | 50.00% | PARTIAL | semantic adapters + canonical quality receipt |
| 4 | Engineering Hub | 37.50% | HOLD | machine shared-asset contract + conformance validator |
| 5 | Integration Hub | 37.50% | HOLD | adapter contract + retry/timeout/idempotency conformance |
| 6 | Document Hub | 31.25% | HOLD | document contract + validator + consumer registry |
| 7 | Delivery Hub | 18.75% | HOLD | central release runtime + release gate + runtime receipt |

> 이 표는 제품 품질·운영 안정성 점수가 아니다. Development Center가 해당 영역을 공통 Hub로 실행·검증·재사용할 준비도를 나타낸다.

## 우선순위 원칙

단순히 점수가 낮은 것만 먼저 하지 않는다.

1. 다른 Hub의 완료 증거를 막는 **Quality Hub**를 먼저 강화한다.
2. 실제 사용자 체감과 프로젝트 통일에 직결되는 **Design Hub / Data Hub / Document Hub**를 병행 강화한다.
3. 재사용 구현을 받치는 **Engineering / Integration Hub**를 machine contract화한다.
4. 마지막 완료 증거와 운영 전환을 담당하는 **Delivery Hub**는 Quality gate와 함께 구축한다.

따라서 첫 고도화 묶음은:

```text
Quality receipt contract/runtime
        ↓
Design conformance receipt
Data conformance/recovery receipt
Document validator/receipt
        ↓
Engineering + Integration contracts
        ↓
Delivery release gate/runtime receipt
```

## 점수 승격 규칙

- 문서 추가만으로 VERIFIED 승격 금지
- 외부 프로젝트 코드가 존재한다는 이유만으로 Hub runtime VERIFIED 금지
- exact revision + 실행 진입점 + 검증/receipt가 연결돼야 VERIFIED
- evidence가 오래되면 새 revision에서 재검증
- 90% 이상이어도 critical axis 하나가 PARTIAL이면 READY 금지
