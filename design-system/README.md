# AI Core Design System

AI Core의 `design-system/`은 프로젝트 UI 코드를 복제하는 저장소가 아니라 **공통 규칙·제품 프로필·검증 계약·학습 intake의 참조 허브**다.

## 읽기 순서

1. `../docs/SCREEN_DESIGN_STANDARD.md` — 접근성·기본 상호작용 baseline
2. `../docs/FREEPASS_UI_STANDARD.md` — FreePass 공통 모바일/업무화면 contract
3. `freepass-ui-standard.json` — 기계 판독용 contract
4. 대상 프로젝트의 local UI/UX SSOT — 브랜드·업무·밀도·예외

## 원칙

- 실제 제품 세부 규격의 정본은 각 프로젝트가 소유한다.
- AI Core는 여러 프로젝트에서 반복 검증된 **공통 행동 문법**만 승격한다.
- 프로젝트가 더 앞선 패턴을 발견하면 `../docs/coordination/UI_LEARNING_INTAKE.md` 형식으로 pointer와 evidence를 남긴다.
- 코드/CSS를 통째로 복제해 두 번째 SSOT를 만들지 않는다.
- COMMON_ADOPTED 전까지는 candidate/profile/HOLD를 구분한다.
