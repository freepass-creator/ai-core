# 지도점검 관제실 구현·검증 기록

## 범위

개발센터가 프로젝트의 개발 절차, 규격 연결, 시정 작업과 재검사를 관장한다는 사용자 지시를 v1 구조로 구현했다. 프로젝트 업무 원본은 제자리에 두며, 읽기 전용 점검 결과가 자동 수정 권한을 만들지 않는다.

## 구현

- `operations/inspection/POLICY.md`: 관제 권한, 6단계 흐름, 판정과 수정 경계.
- `scripts/inspect-project.mjs`: 임의의 로컬 프로젝트 경로를 대상으로 Git 버전, 작업 트리, index 잠금, 추적 중인 민감 파일명, 작업 규칙, 검사 명령, 인수 증거와 SSOT 게이트를 읽기 전용 점검한다.
- `portal/app/inspection.tsx`: 점검 집계·근거·시정 방법·재검사 방법을 표시하고 전체 또는 항목별 시정 작업 지시서를 복사한다.
- 정적 빌드는 개발센터 자체 점검 결과를 `catalog/inspection.json`에 생성한다. FAIL/HOLD는 화면에 그대로 표시하며 빌드 성공으로 숨기지 않는다.

## 현재 자기점검

- 총 9개: PASS 5, NOTICE 2, HOLD 2, FAIL 0.
- HOLD: `.git/index.lock` 존재, 개발센터 전체 독립 검토 게이트 HOLD.
- NOTICE: 기존 작업 트리 변경 분리 필요, 루트 아래 패키지들에 공통 `test` 명령 없음.
- PASS: 저장소·HEAD 식별, 민감 파일명 Git 추적 없음, AGENTS 진입점, 고정 인수 보고서 41/50, SSOT 엔진 검토 해시와 4 OK 일치.

## 검증

- `node scripts/verify-inspection.mjs`: 임시 Git 저장소에서 추적된 `.env` 파일명과 index 잠금을 잡고, 비밀 값은 보고서에 포함하지 않는지 확인했다. 현재 개발센터의 9개 점검도 생성했다.
- `node scripts/verify-typecheck-gate.mjs`: 새 화면을 포함한 타입·구문 관문과 빌드 중단 회귀 통과.
- `node scripts/verify-browser.cjs`: 관제 화면, HOLD 표시, 전체 시정 지시서 JSON, 잘못된 점검 JSON 거부와 재시도 복구, uncaught runtime error 0을 실제 Chromium에서 확인했다.
- 전체 기존 회귀와 빌드 후 고정 인수율은 41/50, 82%를 유지한다. 지도점검 확장은 고정 50개 분자에 억지로 더하지 않았다.

## 제한

현재 공통 검사는 구조와 증거 경계를 확인한다. 각 프로젝트의 업무 의미, 실제 UI, API, DB, 배포 상태를 검사하거나 자동 수정하려면 대상별 어댑터와 검증된 수정기가 필요하다. 시정 지시서의 `approval`과 `completion` 필드는 수정 권한과 새 해시 재검사가 별도임을 명시한다.

## 독립 반례 검토

독립 정적 검토에서 `.env.local` 누락, linked worktree의 index 잠금 경로, Git 판독 실패의 거짓 PASS, 조작된 인수 보고서와 모순된 브라우저 전체 판정, 불가능한 basic/deep 수치가 발견됐다. `.env.*` 예외 규칙, `git rev-parse --git-path`, Git 실패 HOLD, 영역·ID·상태·소속별 수치 대조, 브라우저 전체 판정 재계산을 추가했다. 각 반례를 검사에 넣은 최종 수정본에 대해 검토자는 명시적 OK를 회신했다. 이 OK는 지도점검 신규 범위의 정적 검토이며 Cursor/Gemini 역할이나 전체 프로젝트 의미 검증을 대체하지 않는다.
