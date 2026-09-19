# UI Learning Intake

상태: **NORMATIVE INTAKE CONTRACT**  
기준일: 2026-09-19

각 프로젝트가 AI Core 공통 UI 규격보다 먼저 좋은 패턴을 구현·검증했을 때 이 형식으로 남긴다.

## 원칙

- 프로젝트가 실제 구현의 원천이다.
- AI Core로 프로젝트 CSS/컴포넌트를 통째로 복사하지 않는다.
- 한 프로젝트에서 잘됐다는 이유만으로 COMMON으로 자동 승격하지 않는다.
- 디자인 변경과 기능 변경을 분리해 증거를 남긴다.
- 사용자 최신 결정이 항상 우선한다.

## 최소 패킷

```yaml
learning_id: UI-LEARN-<PROJECT>-<NNN>
source_project: <owner/repo>
source_revision: <commit SHA>
source_files:
  - <path>
status: CANDIDATE

problem_before:
  <기존에 무엇이 어긋났는가>

pattern:
  <무엇을 바꿨는가>

evidence:
  static_checks: []
  rendered_checks: []
  user_confirmation: <YES|NO|UNKNOWN>

counterexamples:
  - <깨뜨렸을 때 gate가 실제 실패하는가>

applies_when:
  - <적용 조건>

does_not_apply_when:
  - <비적용 조건>

product_owned:
  - <브랜드/업무/밀도 등 local 요소>

common_candidate:
  - <다른 프로젝트에도 옮길 원칙>

unknowns:
  - <아직 검증 안 된 것>
```

## AI Core 판정

- `COMMON_CANDIDATE`: 두 프로젝트 이상에 공통 적용 가능성이 있고 의미가 동일함.
- `PRODUCT_PROFILE`: 좋은 패턴이지만 제품 업무/밀도/브랜드 특성에 묶임.
- `HOLD`: 검증 부족, 충돌, 적용 조건 불명확.
- `COMMON_ADOPTED`: 교차 프로젝트 render/interaction 검증 후 공통 규격에 반영.

## 승격 조건

1. 원천 revision이 고정되어야 한다.
2. before/after가 실제 화면/검사로 확인되어야 한다.
3. rule ID와 검사 연결이 있어야 한다.
4. 최소 두 실제 프로젝트에서 같은 의미로 검증되어야 한다.
5. 제품 고유 요소가 공통 rule로 새지 않아야 한다.
6. 반례에서 gate가 실패해야 한다.
7. USER_APPROVED와 자동 검사 PASS를 구분해야 한다.

## 반환 위치

프로젝트 local MD를 유지하고 AI Core에는 **요약 + pointer**를 남긴다.
프로젝트 원문을 두 번째 SSOT로 복제하지 않는다.
