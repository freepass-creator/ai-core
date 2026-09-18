# AI Core Capability Engine v1

## 목적

AI Core의 기존 오더·Work·Control Tower·Direction·Evidence 구조를 실제 기능 실행과 연결하는 공통 실행층이다. 새 업무 SSOT를 만들지 않는다.

핵심 흐름:

`자연어 → Project Resolve → Capability Route → Plan → Adapter → 기존 Engine/Project → Work Result`

## 정본

- 프로젝트: `registry/projects.json`
- capability: `registry/capabilities.json`
- capability schema: `contracts/capability-registry.schema.json`
- router: `src/engine/capability-router.mjs`
- execution engine: `src/engine/capability-engine.mjs`
- project runtime: `src/engine/project-runtime.mjs`
- adapter contract: `src/engine/adapter-contract.mjs`
- result contract: `ai-core-work-result/v1` via `src/engine/result-envelope.mjs`

## 실행 모드

### READ_ONLY
정본을 읽거나 계산만 한다. capability에 연결된 adapter가 바로 실행될 수 있다.

### LOCAL_MUTATION
테스트·빌드·관측 사본처럼 로컬 파일을 만들 수 있으나 외부 운영 상태를 바꾸지 않는 작업이다. 기본은 PREPARED이며 `perform=true`일 때만 실행한다.

실행 직전 `project.local_path`의 Git HEAD가 registry의 `head_revision`과 정확히 같은지 다시 확인한다. 다르면 `PROJECT_REVISION_STALE`로 HOLD한다.

### EXTERNAL_MUTATION
Drive/Sheet/운영 데이터 등 외부 효과가 생길 수 있는 작업이다. 다음을 모두 만족해야 실행한다.

1. `perform=true`
2. authority receipt가 capability/project/work/subject revision과 일치
3. receipt scope가 capability의 `required_scopes` 전체 포함
4. 신뢰 배선으로 주입된 `verifyAuthority`가 true를 반환

운영 factory는 caller가 receipt를 직접 조립하게 하지 않는다. 동일한 trusted work context에서 Control Tower가 현재 execute READY인 경우에만 `ai-core-authority-receipt/v1`을 발급하고, 실행 직전에 같은 원장 head와 scope를 다시 검증한다.

capability adapter나 프로젝트 코드가 스스로 실행 권한을 만들 수 없다. adapter 결과에 `execution_authorized:true`가 있으면 계약 위반으로 거절한다.

## Adapter 종류

- `BUILTIN`: AI Core 내부의 검증된 순수/읽기 기능
- `PROJECT_REGISTRY_COMMAND`: 프로젝트 registry의 install/test/build 명령
- `PROJECT_COMMAND`: capability에 고정된 argv 명령
- `PROJECT_MODULE`: 자회사 저장소의 특정 module/export를 revision 확인 뒤 호출

shell 메타문자(`&& | > < ;`)가 포함된 registry command는 실행하지 않는다. command는 shell을 통하지 않고 argv로 실행한다.

## 현재 연결

| capability | project | mode | 실제 연결 |
|---|---|---|---|
| core.brief | ai-core | READ_ONLY | 기존 `core-brief` 판정 함수 |
| work.projection | ai-core | READ_ONLY | 기존 order/work projection provider 주입 |
| project.verify | active project | LOCAL_MUTATION | registry `commands.test` |
| project.build | active project | LOCAL_MUTATION | registry `commands.build` |
| operations.watch | ai-core | LOCAL_MUTATION | `scripts/ops-watch.mjs` |
| work.observe | ai-core | LOCAL_MUTATION | `scripts/work-observe.mjs` |
| operations.penalty.audit | aiops | READ_ONLY | `lib/gwataeryo-ai-core-adapter.mjs` |
| operations.penalty.prepare | aiops | EXTERNAL_MUTATION | `wonja/gwataeryo-engine.mjs --한다` |

과태료의 벽은 `관청발송`, `문서24업로드`다. capability engine은 이 벽을 없애지 않는다.

## 운영 배선

`openOperatingCapabilityEngine()`이 capability/project registry, work projection, Control Tower authority issue/verify를 한 번에 묶는다. projection과 authority는 `createWorkSourceContextProvider()`라는 같은 trusted source reader를 사용하므로 서로 다른 registry/snapshot/ledger를 보지 않는다. workSources가 없으면 routing만 살아 있고 projection/외부 실행은 fail-closed다.

## 명령

```bash
npm run capability:validate
npm run core:route -- "과태료 처리해"
npm run core:route -- "freepasserp4 테스트 돌려"
npm run core:capability -- plan "freepasserp4 테스트 돌려"
npm run core:capability -- run "freepasserp4 테스트 돌려" --perform
```

외부 변경 capability는 CLI에 authority verifier를 배선하지 않았으므로 `--perform`을 붙여도 HOLD가 정상이다. 실제 운영 실행은 Control Tower 검증 배선이 있는 호스트에서만 가능하다.

## Work Result

모든 실행은 `ai-core-work-result/v1`으로 돌아온다.

- project / capability / subject revision
- 수행 여부
- artifact/evidence/check
- 외부 효과 여부
- blocker
- 다음 행동
- 제품별 wall

따라서 코드 생성, 검증, 외부 실행, 현실 결과를 하나의 DONE으로 섞지 않는다.

## 외부 실행 결과 확정

`EXTERNAL_MUTATION + PROJECT_COMMAND`는 프로세스 종료코드만으로 성공을 선언할 수 없다. capability registry에 `NEW_JSON_TERMINAL_RECEIPT` 계약을 두고 실행 전후 파일 집합을 비교한 뒤 새 receipt를 다시 읽는다. schema와 terminal state가 맞아야 하며, receipt가 없거나 모호하거나 non-terminal이면 HOLD다. 현재 AIOps 과태료는 기존 `gwataeryo-run-manifest/v1`을 그대로 사용한다.
