# AI Core 통합 진행 점검 — GPT 검토 의견

- 작성일: 2026-09-16 (Asia/Seoul)
- provenance: `GPT_REVIEW` — Claude/Codex의 반론·재검증 대상. 사용자 확정·Council 합의·배포 승인이 아님.
- 요청: "지금 통합작업하고 있는거 같은데 잘 되고 있는지 모니터링해봐"
- 방식: 연결 GitHub의 브랜치·파일·코드·PR·Actions 결과와 로그 조회. 사용자 PC/Claude 프로세스를 직접 관찰하거나 테스트를 재실행한 것은 아님.
- 시각 비교 기준: 2026-09-16T08:23:50+09:00에 현재 시각을 확인함. 아래 registry 관측시각 점검의 기준이며 모든 API의 동시 스냅샷을 뜻하지 않음.

## 1. 종합 의견

**현황 조사·프로젝트 등록·중복 작업 보존은 실제 진행 기록이 있다. 하지만 물리 통합이나 실제 업무 왕복 실행이 완료됐다는 증거는 아직 부족하며, 최신 구현 재사용과 검증 연결에 먼저 보완할 지점이 있다.**

가장 먼저 해야 할 일은 새 조정 시스템/어댑터를 만드는 것이 아니라, 기존 PR #22의 구현과 `group/g0-result`의 등록·현황을 대조해 하나의 검토 가능한 기준선으로 연결하는 것이다. 이는 GPT 권고이며 실제 통합 방식은 현재 작업 소유자와 Council이 근거를 비교해 정한다. 전체 서비스 중단이나 작업 브랜치 강제 병합을 요청하는 문서가 아니다.

## 2. 조회한 기준선

| 대상 | 이번 조회에서 확인한 값 | 해석 경계 |
|---|---|---|
| ai-core main | `3145be6d1f253113bbb3a4cf5938d01fc444ca30` | 시작 안내와 설계 문서 중심. 조회한 트리에 런타임/scripts/registry 또는 GROUP 결과 문서가 없음 |
| group/g0-result | `ec3d3cdff572468c289cd159caf44d75d34807c9` | 최신 커밋 시각 2026-09-16 08:21:45 KST. Claude 공동작성 표기. 현재 프로세스가 계속 실행 중인지는 별개 |
| PR #22 / codex/order-control-integration | `628465d851400f58a71337452b70da649bb9b5b1` | OPEN/DRAFT, 미병합. 합성·격리 환경 구현이며 운영 활성화는 HOLD |
| aiops 원격 main | `27ed7c085fbdd427c30542370b88f9622a2b1c0c` | 원격에 다른 문서 변경이 있음. 특정 로컬 체크아웃의 push 문제 해소를 뜻하지 않음 |

`group/g0-result`를 head로 조회한 PR 목록은 비어 있었고, 해당 branch의 Actions 실행 조회도 0건이었다. 로컬 검사 부재를 뜻하지 않으며, 원격 CI 통과를 확인할 수 없다는 뜻이다.

## 3. 긍정적으로 확인한 진행

- [GROUP-G0 결과][g0]는 기존 inventory의 33개 고유 저장소·69개 체크아웃을 재사용했다고 보고한다. 이번 GPT는 사용자 PC 전체를 다시 센 것이 아니다.
- [GROUP-G1 결과][g1]와 [실제 registry][registry]에서 ai-core, aiops, devcenter, freepass-sales, freepasserp4의 5개 등록을 확인했다. 이 수를 전체 통합 진척률로 환산하지 않는다.
- Cursor/Gemini CLI의 자문 요약은 Control Tower를 본사 조정 기준으로, order UI를 intake로, AIOps를 기존 운영 실행 계층으로 두자는 방향이다. 기록된 자문 요약은 확인했으나 원래 CLI 출력·run ID·정확한 검토 digest까지 독립 대조하지는 않았다.
- 영업앱을 단순 중복으로 보고 정리하려던 초안을 수정하고, 21개 미병합 커밋이 있다는 점을 보존 대상으로 기록했다. 최신 커밋은 테스트 실패가 기존 간헐적 focus race라는 bisect 결과를 반영했다. 이는 작성자의 조사 보고이며 이 감사에서 bisect를 재실행한 것은 아니다.
- [G0][g0]는 폴더 골격만 만들었고 저장소 이동·삭제는 하지 않았다고 명시한다. 현재 범위에서 무리한 물리 이동을 했다고 볼 근거는 없다.

## 4. 우선 확인할 지점

### F01 — 새 어댑터 설계 전에 기존 PR #22와 재사용 대조가 필요

**직접 확인:** 그룹 [HANDOFF][handoff]에는 order-control-v1 어댑터가 "설계만 있고 미착수", 다음 작업은 "어댑터화 설계 시작"이라고 적혀 있다. 그러나 PR #22에는 [order-work-adapter 코드][adapter]와 [합성 통합 현황][integration]이 있다. `createOrderWorkAdapter`, `readWorkProjection`, `linkOrder`, `prepareWorkCommand`를 코드에서 확인했다.

**한계:** 이것은 운영 연결 완료가 아니다. 코드 스스로 읽기/명령 준비 경계를 유지하며 실제 전송·권한·완료를 허용하지 않는다. 운영 인증·권한 연결과 별도 검토가 남아 있다.

**GPT 권고:** "미구현"을 `격리 환경 구현됨 / 운영 연결 미완료 / 독립 검토 미완료`로 세분하고 PR #22와 그룹 브랜치의 파일별 `재사용 / 수정 / 제외 / 보류`를 먼저 정리한다. 두 브랜치 전체를 무검토 병합하지 않는다.

### F02 — 그룹 기반 코드가 PR #22의 안전 보완을 포함하지 않음

**직접 확인:** [그룹 run-control-tower][group-run]는 `if (ledgerWork.subject_revision && ...)`로 비교하므로 null/빈 subject_revision에서는 그 비교가 건너뛰어진다. [PR #22 같은 파일][integrated-run]에는 `WORK_REVISION_REQUIRED`와 `WORK_OBSERVED_AFTER_AS_OF` 검사가 추가돼 있다. 그룹 파일에는 이 두 코드가 없다.

**영향:** registry가 현재 INVALID인 동안은 상위 입력 검사에서 멈춘다. 그러나 registry를 정상화한 후에도 구형 판정기를 계속 쓰면 이미 보완한 누락/시각 조건을 다시 놓칠 위험이 있다. 두 구현 모두 `execution_authorized: false`이며, 이 발견을 실제 무단 실행 사고로 보고하지 않는다.

**GPT 권고:** 이 보완과 해당 회귀 검사를 함께 재사용 후보로 검토한다. 테스트는 정확한 통합 대상 revision에서 다시 실행한다. 단순히 파일 이름이 같다는 이유로 구형 Control Tower가 최신 안전 기준을 모두 가진 것으로 취급하지 않는다.

### F03 — PR #22의 실제 CI는 녹색이 아님

**GitHub에서 직접 조회한 실행:** [Actions run 34926231396][ci], job `104244770835`, `Main State Consistency`.

- 실행 시각: 2026-09-15 12:46 KST. 오늘 새 GROUP 실행의 결과가 아니라 해당 PR head에 연결된 과거 CI다.
- 실제 테스트 체크아웃: merge commit `28dc1ca191465e743c8d46632187a511cf0dc207` (`628465d...`를 당시 main `45457bf...`에 합친 검증 트리).
- `npm test`: **총 300, PASS 298 / FAIL 1 / SKIP 1**.
- 실제 실패: `test/verify-main-state.test.mjs:26:1`, `successor episode changed files do not match repository diff`.
- 뒤의 독립 `node scripts/verify-main-state.mjs` 단계는 SKIPPED.
- 로그 중 `test/fail.test.mjs`의 의도된 자식 fixture 실패를 최종 CI 실패로 잘못 세지 않았다. 최종 실패는 위 일관성 검사다.

PR 본문에 있는 로컬 299 PASS 보고와 CI merge-tree 결과를 섞으면 안 된다. 현재 group branch의 CI 0건과도 별개다.

**GPT 권고:** 실제 base/head/merge-tree의 변경 파일 목록과 episode 증거 범위를 대조해 수정하고 CI를 재실행한다. 검사 삭제, 가짜 PASS 또는 목록을 무조건 늘리는 방식으로 숨기지 않는다. 기존 독립 고위험 소스 검토의 미충족도 CI와 별도 상태로 유지한다.

### F04 — 등록부 검사 기준과 실제 실행 준비 상태가 섞임

**직접 확인:** [registry][registry]에서 aiops의 build와 freepasserp4의 test가 null이다. [검증 코드][validator]는 ACTIVE 프로젝트에 test+build를 일괄 요구하므로 G1의 두 오류 보고와 일치한다. [실행기][group-run]는 등록부 하나라도 INVALID이면 `items: []`로 반환한다. 이 감사에서 원 검증기를 재실행한 것은 아니며 소스와 입력을 대조했다.

**GPT 권고:** 등록부 구조의 유효성, 프로젝트의 현역 여부, 개별 업무의 실행 준비 여부를 구분한다. 스크립트/문서 저장소에 불필요한 build를 만들지 말고, 이유와 실제 대체 검사를 갖춘 `NOT_APPLICABLE` 표현을 검토한다. 반대로 test 항목을 임의 N/A 처리하지 않는다. `package.json`에 test가 없다는 것만으로 ERP 전체 테스트가 없다고 단정하지 말고 기존 CI·독립 검사 스크립트·대상 revision을 먼저 확인한다. ERP 구현 수정은 해당 단일 작업 소유자에게 넘긴다.

### F05 — 관측 시각과 현재 인계 상태가 실제 기준과 맞지 않음

**직접 확인:** registry 최상위 및 5개 source의 `observed_at`가 모두 `2026-09-16T00:00:00Z`(KST 09:00)이다. 기준 시각 08:23:50 KST보다 미래다. 실제 조사 시간인지 기본값인지 이번 감사로 단정하지 않는다. 검증기는 source 시각을 registry 시각과 비교하지만 registry 자체를 평가 시각과 비교하지 않는다.

또한 GROUP-G1은 등록부 INVALID를 남기는데 HANDOFF의 Blocker는 "없음"이다. MERGE-P0의 "G1 착수 승인 필요"와 GROUP-G1의 "실제 수행"도 현재 상태 문서에서 정리가 필요하다. 승인 위반이 있었다고 단정하는 것이 아니라 승인/진행 근거 연결이 부족하다는 발견이다.

**GPT 권고:** 실제 관측 시각을 재수집하고 모르면 UNKNOWN으로 남긴다. 문서 작업은 계속 가능하더라도 `문서 편집 blocker 없음 / 운영 준비 blocker 있음`을 구분한다. 과거 결과 문서는 보존하고 현재 HANDOFF 한 곳에서 정정·승인 참조·다음 행동을 연결한다.

### F06 — AIOps의 로컬/원격 차이가 인계 단절 위험

[G0][g0]와 [registry][registry]는 특정 로컬 aiops 이력이 원격보다 189커밋 앞서고 큰 파일 이력 때문에 push가 막혔다고 보고한다. 실제 운영 수정과 로컬 테스트도 보고되지만 해당 로컬 패치·테스트 원문은 이번 연결에서 독립 확인하지 못했다. 원격 main이 다른 문서 변경으로 전진한 사실은 그 로컬 이력의 업로드 증거가 아니다.

**GPT 권고:** 원문/개인정보 포함 여부를 먼저 검사하고, 로컬/원격 commit·ahead/behind·안전한 백업 참조·전송 가능한 코드/문서 범위를 대조한다. 이력 재작성·force push·운영 원장 Git 업로드를 자동 실행하지 않는다. 재개할 스케줄 작업은 대상별 실제 상태/승인/한 번의 검증 결과를 확인한다. "GitHub를 읽으면 모든 최신 업무를 안다"고 아직 보장하지 않는다.

## 5. 다음 한 작업 — Claude/Council 검토 요청

**권고 작업: 기존 PR #22와 그룹 등록 브랜치의 통합 기준선 대조.**

1. 이번에 고정한 main / group / PR #22를 현재 원격과 다시 비교한다.
2. 기존 adapter·intake·durability·run-control 안전 수정과 그룹 registry·HANDOFF의 재사용/수정/제외 표를 만든다.
3. 적합한 별도 AI/CLI에 같은 revision과 쟁점(F01~F06)을 보내 근거·반론·조정 결과를 남긴다. 구조 방향의 Cursor/Gemini 자문이 PR #22의 고위험 구현 소스 검토를 대신했다고 처리하지 않는다.
4. 현재 작업 소유권을 유지한 별도 검증 환경에서 필요한 최소 변경과 회귀 검사를 수행한다. GPT는 이 감사에서 구현 브랜치·운영 시스템을 고치지 않았다.
5. 결과는 이 검토 PR의 댓글 또는 기존 HANDOFF에 항목별 `동의 / 수정 / 반박 / 미확인`과 근거로 반환한다. 새로운 병렬 업무원장/프레임워크를 만들지 않는다.

그 이후 실제 업무 한 건(읽기 전용 또는 검증된 비운영 범위)을 `자연어 요청 → 정본 → 처리 → 검증 → 결과/다음 일`까지 연결해 보여주는 것을 목표로 한다. 폴더 수·등록 수·테스트 수만으로 업무 활용 완료를 선언하지 않는다.

## 6. 이 감사의 수행/미수행

수행: GitHub 원격 refs/trees, G0/G1/MERGE-P0/HANDOFF/registry, 두 브랜치의 관련 코드, PR #22 상태, 특정 CI run/job/원문 로그 대조. 본 Markdown 검토 의견 게시.

미수행: 사용자 PC/스케줄러 직접 조회, 전체 코드 테스트 재실행, bisect 재실행, CLI Council 독립 호출, 원문 데이터 조회, 코드 수정, 운영 전환·배포·이력 재작성, 다른 작업 브랜치 병합. 이 문서 게시와 Claude 실제 수신/조치 완료는 별개다. 정기 자동 모니터링을 설정했다는 뜻도 아니다.

[g0]: https://github.com/freepass-creator/ai-core/blob/ec3d3cdff572468c289cd159caf44d75d34807c9/docs/handoffs/GROUP-G0-RESULT.md
[g1]: https://github.com/freepass-creator/ai-core/blob/ec3d3cdff572468c289cd159caf44d75d34807c9/docs/handoffs/GROUP-G1-RESULT.md
[handoff]: https://github.com/freepass-creator/ai-core/blob/ec3d3cdff572468c289cd159caf44d75d34807c9/docs/HANDOFF.md
[registry]: https://github.com/freepass-creator/ai-core/blob/ec3d3cdff572468c289cd159caf44d75d34807c9/registry/projects.json
[validator]: https://github.com/freepass-creator/ai-core/blob/ec3d3cdff572468c289cd159caf44d75d34807c9/scripts/validate-project-registry.mjs
[group-run]: https://github.com/freepass-creator/ai-core/blob/ec3d3cdff572468c289cd159caf44d75d34807c9/scripts/run-control-tower.mjs
[integrated-run]: https://github.com/freepass-creator/ai-core/blob/628465d851400f58a71337452b70da649bb9b5b1/scripts/run-control-tower.mjs
[adapter]: https://github.com/freepass-creator/ai-core/blob/628465d851400f58a71337452b70da649bb9b5b1/src/integration/order-work-adapter.mjs
[integration]: https://github.com/freepass-creator/ai-core/blob/628465d851400f58a71337452b70da649bb9b5b1/docs/integration/INTEGRATION_STATUS.md
[ci]: https://github.com/freepass-creator/ai-core/actions/runs/34926231396/job/104244770835
