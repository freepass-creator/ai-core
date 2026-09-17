# GROUP-G1 — 본사 최소 골격

## 기준

- base revision: `freepass-creator/ai-core@3145be6`(origin/main) + 로컬 `group/g0-result@887a7a2`
- 이 브랜치(`group/g0-result`)에서 계속 진행. main 직접 작업 안 함.

## 실제 수행

Multi-AI Council(Cursor+Gemini, GROUP-G0-RESULT.md 하단 기록)이 합의한 대로 **Control Tower를 본사 표준으로 채택**하고, 이미 구현·테스트된 `contracts/project-registry.schema.json` + `scripts/validate-project-registry.mjs`를 그대로 재사용해 실제 프로젝트 5개를 등록했다. 새 스키마·새 검증기를 만들지 않았다.

등록: `registry/projects.json` — ai-core, aiops, devcenter, freepass-sales, freepasserp4. 이번 세션에서 직접 조사·검증한 것만 실었고, 나머지 28개 저장소는 `docs/inventory/C-DEV-2026-09-15.json`과 `aiops/docs/저장소지도.md`에 남겨두고 다시 등록하지 않았다.

## 검증

```
node scripts/validate-project-registry.mjs registry/projects.json
→ status: INVALID
  - ACTIVE_PROJECT_CHECKS_INCOMPLETE  projects/1 (aiops)       — build 명령 없음
  - ACTIVE_PROJECT_CHECKS_INCOMPLETE  projects/4 (freepasserp4) — test 명령 없음
```

**이 INVALID를 숨기거나 임의로 가짜 명령을 넣어 통과시키지 않았다.** 둘 다 실제로 확인된 사실이다:

- `aiops`는 컴파일/번들 단계가 없는 스크립트 모음이라 `build`가 원래 없다 — 스키마가 "ACTIVE면 test+build 둘 다 있어야 한다"고 강제하는 게 이런 저장소 형태와 안 맞는다. 스키마를 고칠지, 이런 유형에 예외 상태를 둘지는 사용자/Council 판단이 필요하다.
- `freepasserp4`는 `package.json`에 `test` 스크립트가 진짜 없다 — 이건 스키마 문제가 아니라 실제 테스트 부재이며, 별도로 고쳐야 할 진짜 결함이다.

## 보존 확인

- 어떤 프로젝트의 코드·데이터·배포도 변경하지 않았다. registry는 순수 포인터 메타데이터다.
- `aiops-daily` 등 스케줄 작업은 여전히 Disabled 상태로 둠(known_blockers에 기록만).

## 미확인 / 위험

1. **project-registry.schema.json의 ACTIVE 요건이 너무 엄격할 수 있음** — 컴파일 단계 없는 저장소(aiops류)를 어떻게 표현할지 결정 필요.
2. `devcenter`는 `package.json` 자체가 없어 `HOLD`로 등록했다 — DevCenter가 본사 조직인데 정작 자기 자신은 검증 가능한 실행 명령이 없다는 모순이 남는다.
3. 나머지 28개 저장소는 아직 이 registry에 없다 — 필요할 때마다 실제 조사 후 추가(추측으로 미리 채우지 않음).

## 다음 한 작업

사용자 확인 필요: (1) aiops류 "빌드 없는 저장소"를 스키마에서 어떻게 다룰지, (2) freepasserp4 테스트 부재를 별도 과제로 등록할지.
