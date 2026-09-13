# AI Core

AIOPS의 업무 기억·운영 제어와 DevCenter의 개발 규격·검증 능력을 복제하지 않고, 필요한 순간에 찾아 조합하는 상위 오케스트레이터.

## 원칙
- AI Core는 정본을 소유하지 않는다. 정본을 찾고 revision을 고정한다.
- AI Core는 모든 기능을 새로 만들지 않는다. DevCenter의 검증 자산을 우선 재사용한다.
- AI 합의보다 사용자 최신 지시·승인 원본·재현·실행 증거를 우선한다.
- 작성·검증·승인·실행·성과를 분리한다.
- 개발은 Cloud First. GitHub를 AI 간 개발 SSOT로 쓰고, 실제 repo 실행환경이 필요할 때 Work/Codex를 사용한다. 로컬은 예외다.
- AI Core 자체가 운영 실행 권한을 만들지 않는다. AIOPS/DevCenter/프로젝트의 기존 승인 게이트를 보존한다.

## v0.1 구현 범위
실행 가능한 순수 함수 기반 오케스트레이션 코어를 제공한다.

`Task → Intent Router → Source Plan → Capability Plan → Execution Route → Work Packet`

현재 GitHub API·Google·배포를 직접 호출하지 않는다. 어댑터는 포인터와 계획만 만든다. 이 제한은 의도적이다.

## 빠른 실행
```bash
node src/cli.mjs examples/freepass-product-detail.json
node --test
```

## 저장소 관계
- `freepass-creator/aiops`: 업무 의미, 운영 실패, 권한·승인, 회사 SSOT 포인터
- `freepass-creator/devcenter`: 개발 기준, registry, 공통 부품, 점검·시정·재검사
- 대상 프로젝트: 실제 코드와 현실 결과
- `ai-core`: 위 세 계층을 연결하는 판단·계획·학습 계층

자세한 규칙은 `AGENTS.md`, 계약은 `contracts/`, 구현은 `src/`, 테스트는 `test/`를 본다.
