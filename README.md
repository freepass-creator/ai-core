# AI Core

AIOPS의 업무 기억·운영 제어와 DevCenter의 개발 규격·검증 능력을 복제하지 않고 조합하며, 실제 결과를 다시 두 기관과 자기 자신의 개선으로 환류하는 최상위 진화 오케스트레이터.

## 원칙

- AI Core는 정본을 소유하지 않는다. 정본을 찾고 revision을 고정한다.
- AI Core는 모든 기능을 새로 만들지 않는다. DevCenter의 검증 자산을 우선 재사용한다.
- AI 합의보다 사용자 최신 지시·승인 원본·재현·실행 증거를 우선한다.
- AI가 추정한 의도와 사용자가 확인한 의도를 섞지 않는다.
- 철회·대체·만료·범위 밖 기억을 현재 판단에 적용하지 않는다.
- 작성·검증·승인·실행·성과를 분리한다.
- 개발은 Cloud First다. 실제 저장소 실행환경이 필요할 때 Work/Codex를 사용한다.
- AI Core 자체가 운영 실행 권한을 만들지 않는다. 기존 승인 게이트를 보존한다.

## v0.5 candidate

현재 후보는 여섯 구성으로 작동한다.

1. **오프라인 계획**: 필요한 정본과 capability를 계산한다. 실제 SHA가 없으므로 `HOLD`가 정상이다.
2. **Live Context Bootstrap**: 읽기 전용 GitHub API로 프로젝트·AIOPS·DevCenter 원본과 capability를 가져와 SHA를 고정한 뒤 Work Packet을 만든다.
3. **Evolution Kernel**: 실제 실패·낭비·결손을 AI Core/AIOPS/DevCenter 개선 후보로 분류하고, 작업 의미·대상/source/capability/policy revision digest에 묶어 Transfer Gate에 올린다.
4. **Conversation Learning**: 비식별 대화 관찰을 패턴·원칙·시스템 후보로 승격하되 원문을 저장하거나 자동 채택하지 않는다.
5. **Domain Proof Gate**: 개발·법률·사업·문서·커뮤니케이션별 증명 의무와 요구사항 영수증을 같은 revision에 묶는다. 혼합 업무는 한 도메인으로 축소하지 않고 모든 해당 도메인의 정본·capability·검토·증명 의무를 합성한다.
6. **Human Orchestration**: 명시된 목적과 잠정 의도, 적용 가능한 기억과 철회된 기억, 안전한 준비와 승인 필요한 행동을 분리한다.

```text
Task
  → Intent Router
  → Source Requirements
  → Live Context Bootstrap
  → Context Compiler
  → Capability Resolver
  → Human Intent / Memory / Action Gate
  → Execution Router
  → Work Packet
  → Domain Proof Contract
  → Result Observation
  → Conversation Learning
  → Evolution Candidate
  → Transfer Gate
```

Live 모드는 대상 프로젝트의 branch/tag를 먼저 commit SHA로 고정하고, 같은 revision의 프로젝트 지침을 읽는다. 읽은 원문은 결과나 Work Packet에 복사하지 않는다. 위치·SHA·scope와 성공/실패 증거만 남긴다. 접근 실패, 잘못된 registry, 후보뿐인 capability, SHA 없는 자산은 통과시키지 않는다.

## 실행

```bash
node src/cli.mjs examples/freepass-product-detail.json
node src/cli.mjs examples/human-agency.json
node src/demo-page.mjs
node --test
```

권한이 있는 읽기 전용 토큰으로 실제 정본을 조회할 때만 Live 모드를 사용한다.

```bash
AI_CORE_GITHUB_TOKEN=<read-only-token> node src/cli.mjs --live examples/freepass-product-detail.json
```

Live 조회 성공은 실행 승인이 아니다. 모든 출력의 `execution_authorized`는 `false`이며, C등급은 Claude DESIGN, D등급·라이브 외부 변경은 Claude DESIGN/FINAL과 사용자 직전 승인을 요구한다. 준비는 `work_packet.preparation_gate`, 실행은 `work_packet.execution_gate`의 합성 결과만 따른다. 손상되거나 같은 ID로 충돌하는 evolution 입력은 격리하고 Transfer·실행을 HOLD하며, 그 입력과 무관한 가역적 로컬 준비만 별도 허용할 수 있다.

CLI는 단순 Task JSON과 `{ "task": ..., "human_context": ... }` 개발용 envelope를 모두 받는다. 후자의 confirmation/research 영수증은 production에서 사용자 payload로 직접 받지 말고 인증된 Chat/AIOPS adapter가 구성해야 한다. `human_context`는 기억·철회·확인·조사 결과만 허용하며, source/proof/capability나 클라이언트 시각을 통한 권위 우회는 거부한다.

AI Core의 최상위 역할과 두 축을 고도화하는 순환 구조는 [`docs/CIVILIZATION_KERNEL.md`](docs/CIVILIZATION_KERNEL.md)에 정의한다. 대화 학습·도메인별 증명·상태 분리 규칙은 [`docs/CONTINUOUS_LEARNING.md`](docs/CONTINUOUS_LEARNING.md), 사용자 의도·기억·행동 경계는 [`docs/HUMAN_ORCHESTRATION.md`](docs/HUMAN_ORCHESTRATION.md)에 정의한다.

개발 Work Packet에는 보안·데이터 무결성·성능·접근성·배포·롤백·관찰 가능성 등 사용자가 일일이 요청하지 않은 선제 검토 관점을 자동으로 포함한다. 법률은 FACT/EVIDENCE/상대 주장/INFERENCE/AUTHORITY/UNCERTAINTY, 최신 공식 근거, 절차 기한, 책임 있는 인간 검토가 없으면 통과하지 않는다. 법률 기능 개발처럼 도메인이 겹치면 법률 최소 C등급과 개발 검증을 동시에 적용한다. 현재 도메인 자동 판별은 보수적인 한·영 키워드 휴리스틱이므로 완전한 법률 분류기가 아니며, 운영 전에는 인증된 의미 분류 adapter가 필요하다. 사업·문서·커뮤니케이션도 각자의 현실 실패 방식에 맞는 별도 증명 의무를 갖는다.

“완벽”을 상태로 선언하지 않는다. PASS는 선언한 범위·입력·정책·revision에 묶이며 하나라도 바뀌면 STALE이다. 알려지지 않은 항목은 UNKNOWN/HOLD로 보존하고 다음 개선 루프의 입력으로 사용한다.

## 저장소 관계

- `freepass-creator/aiops`: 업무 의미, 운영 실패, 권한·승인, 회사 SSOT 포인터
- `freepass-creator/devcenter`: 개발 기준, registry, 공통 부품, 점검·시정·재검사
- 대상 프로젝트: 실제 코드와 현실 결과
- `ai-core`: 위 세 계층을 연결하는 판단·계획·학습 계층

## 검증 범위

CI는 네트워크와 비밀값 없이 순수 함수, 실패 차단, 가짜 읽기 어댑터, CLI와 데모 생성을 검증한다. 실제 비공개 저장소 접근은 토큰의 범위에 따라 별도로 확인하며, CI 통과를 운영 채택이나 독립 검수 완료로 표시하지 않는다. `contracts/human-context.schema.json`의 환경 입력은 신뢰된 adapter 경계용이며 일반 사용자의 Task 입력과 같은 권위로 취급하지 않는다.

자세한 규칙은 `AGENTS.md`, 입력 계약은 `contracts/`, 구현은 `src/`, 테스트는 `test/`를 본다.
