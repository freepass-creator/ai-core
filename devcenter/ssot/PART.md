# DevCenter SSOT 검증 기능 — 현재 경계

상태: **LEGACY PART RECORD / CURRENT POINTER**

2026-09-09의 조직·담당 기록은 역사적 배경으로 보존하되 현재 AI 역할이나 정족수를 정의하지 않는다. 현재 협업 정책은 루트 `../../AGENTS.md`, 정본·증거·HOLD 원칙은 `../../docs/AI_WORKING_STANDARD.md`가 소유한다.

DevCenter의 SSOT 검증 기능은 다음만 담당한다.

- 대상 프로젝트의 현재 revision과 authoritative source를 고정한다.
- 중복 정본, 사본 드리프트, 소비 경로 불일치를 찾는다.
- 원본·재현 테스트·실행 증거 순으로 판정한다.
- 프로젝트 고유 업무 데이터나 규칙을 이 디렉터리로 복제하지 않는다.
- 접근 불가·의미 충돌·parity 부족은 HOLD한다.

과거 독립 DevCenter의 로컬 SSOT 경로와 reviews 기록은 현재 실행 진입점이 아니다. 현재 검증 도구와 등록부는 AI Core 루트 `contracts/`, `registry/`, `scripts/`, `test/`에서 찾는다.
