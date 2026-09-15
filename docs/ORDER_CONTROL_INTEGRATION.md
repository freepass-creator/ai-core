# PR #20 / #21 통합 경계

2026-09-15 통합 조정 반영. 대조 기준: PR #20 `fe9315535e31a6edb723562b2b3515fcdf01107e`, PR #21 `a0ac4bb1234e4c1759769f6e272959cda8f55d1e`. 아래는 통합 계약 초안이며 어댑터는 아직 구현되지 않았다.

## 책임

- PR #20: revision-bound project registry, 공통 work ledger, 실행·완료 조건 평가, 근거·권한 결합을 소유한다. `contracts/control-tower.schema.json`, `scripts/work-ledger.mjs`, `scripts/run-control-tower.mjs`를 그대로 사용한다.
- PR #21: 자연어 접수, 사용자에게 보여주는 오더, 인계 자료, 작업 확보 UI와 전송 계층을 소유한다. OrderStore는 접수·상호작용 기록이며 최종 공통 업무 상태의 별도 SSOT로 확대하지 않는다.
- 사용자는 말로만 요청한다. Codex가 접수·식별자 연결·실행 장소 선택·상태 조회를 수행한다. 명령어와 JSON 입력은 사용자 필수 절차가 아니다.

현재 #21의 SQLite 상태·close는 독립 시제품의 기록이다. 통합된 업무 완료나 실행 권한으로 사용하면 안 된다. 연결이 없는 오더는 UNLINKED로 보여주고 최종 실행·완료를 막는 어댑터가 필요하다. 아직 런타임에 이 연결 게이트가 구현됐다고 주장하지 않는다.

## 겹침과 필요한 어댑터

| 겹치는 부분 | 통합 규칙 |
|---|---|
| order_id와 work_id | 고유한 영속 매핑을 중앙에서 생성한다. UUID 형식 order_id는 #20의 work_id 패턴과 달라 그대로 대입할 수 없다. 여러 하위 업무는 별도 관계로 명시한다. |
| project 문자열과 저장소 매핑 | #20의 검증된 project_id/registry를 사용한다. #21 projectRepositories는 시제품용이며 별도 최종 registry로 키우지 않는다. |
| 요구 revision, 레코드 version, subject_revision | 각각 요구사항 버전, 낙관적 갱신 버전, 대상 Git 커밋이다. 서로 치환하지 않고 연결에 각각 고정한다. |
| claim/lease와 commitment/allocations | UI 확보는 작업 수락이나 자원 예약·실행 승인이 아니다. #20의 수락·기한·의존성·자원 검증을 통과한 실행만 연결한다. |
| 결과·GitHub 검사 메모와 evidence_receipts | 메모는 후보 근거다. 종류·대상 커밋·범위·출처를 검증한 뒤 #20 규격으로 연결한다. |
| REVIEW/CLOSED와 work 상태 | 이름으로 일대일 변환하지 않는다. UI close는 확인 의사로 전달하고, 정본 상태와 평가 결과를 다시 읽어 표시한다. |

어댑터가 제공할 기능: `linkOrder`, `readWorkProjection`, `submitWorkCommand`, `refreshControlResult`. 명칭은 설계 초안이다. 실제 쓰기는 #20의 appendLedgerEvent와 expectedHead를 사용하고 해시 체인·상태 전이·평가기를 복제하지 않는다. runControlTower의 READY도 `execution_authorized: false`라는 경계를 유지한다.

SQLite와 work ledger 두 저장소 사이에 원자적 트랜잭션이 있다고 가정하지 않는다. 고정 command_id/event_id와 outbox를 사용하고, 응답 유실 시 정본에서 동일 ID와 페이로드를 재조회한다. #20은 중복 event_id를 오류로 처리하므로 무조건 append 재시도하지 않는다. head 충돌이면 최신 정본을 읽고 명령을 재평가한다. 성공한 정본 기록을 UI에 반영하지 못하면 projection 대기로 남긴다. 반대로 UI 상태만으로 성공을 표시하지 않는다.

## 브랜치 통합 순서

1. #20의 공통 계약과 원장 변경을 먼저 검토·고정한다. 위 커밋 이후 변경됐다면 다시 대조한다.
2. 별도 통합 브랜치에서 #20을 기반으로 #21 UI/전송 계층을 합친다. package.json, main-state workflow/verifier, README, episode 문서는 양쪽 의미를 대조해 합치며 전체 파일 덮어쓰기로 해결하지 않는다.
3. 위 매핑·정본 조회·명령 어댑터를 구현하고 #21의 완료/실행 경로가 #20을 우회하지 않도록 연결한다.
4. 분리된 테스트 원장으로 ID 중복, 요구/커밋 변경, 만료 lease, head 충돌, 응답 유실, 부분 쓰기, 권한 부재, 두 클라이언트 이어하기를 검증한다. 기존 테스트 통과만으로 통합 완료를 선언하지 않는다.
5. 실제 오더의 기존 이력은 보존하고 연결 계획과 대조 결과를 검토한다. 실제 원장 이전·서버 배포는 현재 수행하지 않는다.

현재 상태: 계약 경계와 통합 순서만 기록. 자동 AI 실행, work_id 매핑, 통합 게이트 및 실제 서버 실행은 미구현/미검증이다.
