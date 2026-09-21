# 공통 AI 시작·읽기 패킷 — 준비 단계

> **2026-09-21 적용 범위 변경:** 일반 AI 업무의 시작 규격은 [AI Working Standard](../AI_WORKING_STANDARD.md)다. 아래 중앙 packet/claim/HOLD 계약은 기존 중앙 오더 경로를 실제로 사용하는 업무에 한정한다.

현재 공용 진입점은 [AI_CONTINUATION.md](AI_CONTINUATION.md)다. 저장소 접근 AI와 private 저장소 접근이 없는 무료 채팅 경로를 그 문서에서 분리하며, 이 문서의 중앙 packet/claim/HOLD 계약을 그대로 재사용한다.

## 전용 통합 브랜치 반영 — 2026-09-15

`0dad6ac4ffc247afa156a16fb41262f4285f7eee`를 통합하고 WORK_READ_FIRST에 공통 진입 링크를 추가했다. 프로젝트 루트의 CLAUDE.md와 GEMINI.md는 같은 두 공통 문서를 가리키는 최소 포인터다. 기존 공통 문서나 정본 업무 상태를 복제하지 않는다.

공식 로딩 지원을 확인한 범위: [Claude 프로젝트 CLAUDE.md](https://code.claude.com/docs/en/memory), [Gemini GEMINI.md](https://geminicli.com/docs/cli/gemini-md/), [Cursor CLI의 프로젝트 CLAUDE.md/AGENTS.md](https://docs.cursor.com/en/cli/using). Cursor는 CLAUDE.md를 공유하므로 별도 .cursor 규칙 복제본을 만들지 않았다. 공식 지원과 이 PC에서 현재 프로세스에 로딩된 사실은 별도 검증이다.

원본 RemoteOrderClient→격리 HTTP 서버→인메모리 OrderStore 경로로 추가 검사했다: 올바른 pinned ID의 두 GET, 잘못된 원장 ID 거절, 조회 전후 이벤트·lease 불변, 항상 HOLD/claim_acquired=false. 6개 패킷 검사 PASS. 이 읽기 모듈에는 claim 호출이나 자동 실행 소비자가 여전히 없다.

실제 Gemini 시작 확인은 untrusted directory로 중단됐다. --skip-trust, 환경 신뢰 우회 또는 전역 설정 변경을 하지 않았다. Claude는 이 작업의 앞선 실제 호출에서 주간 한도가 확인돼 현재 로딩을 PASS로 계산하지 않는다. 아래 소유자 조사·미반영 제안은 반영 전 역사이며, 최종 시작 확인과 남은 범위는 통합 상태 문서에 기록한다.

Cursor 실제 비대화형 ask 시작 검사에서는 추가 파일/명령 도구를 사용하지 않고 이미 받은 프로젝트 지침의 두 포인터 경로를 정확히 반환했다. 합성 HOLD/권한 false/claim false 패킷은 실행을 허용하지 않는다고 답했다. 본문을 읽지 않은 포인터 인지 결과임을 명시했으므로 공통 문서 전체 독해나 실업무 실행의 증거로 확대하지 않는다.

**상태: 문서와 DI 읽기 검증만 구현. 중앙 실행 연결·자동 시작 지침 적용·중복 실행 강제 차단은 미완료.** Claude/Cursor/Gemini 실행, GUI 제어, 운영 원장 쓰기, 새 lease/scheduler/인증, 전역 설정 변경은 하지 않았다.

## 대조한 정본과 실제 시작 위치

- PR20 `fe9315535e31a6edb723562b2b3515fcdf01107e`의 work-ledger 계약과 PR21 `21b1e16d2ab5b1b658e03275da5a5ad5515c8931`의 `src/orders/client.mjs`, `store.mjs`, `server.mjs`, `docs/ORDER_CONTROL_INTEGRATION.md`를 git show로 대조했다. PR20은 원장/실행 평가를, PR21은 접수/인계를 소유한다. 상태 이름을 일대일 변환하지 않는다.
- 현재 `C:/dev/ai-core/WORK_READ_FIRST.md`는 실제 존재하며 MEMORY → CURRENT → 현재 Work Packet/프로젝트 지침 순서와 SHARED_ORDER_EXECUTION 중앙 연결을 안내한다. 공유 폴더 파일은 읽기만 했다.
- 점검한 `C:/dev`, `C:/dev/ai-core`, 이번 전용 worktree의 AGENTS.md/CLAUDE.md/GEMINI.md 경로에는 파일이 관찰되지 않았다. `C:/dev/ai-core/.cursor/rules`도 관찰되지 않았다. 사용자 메시지로 제공된 AGENTS 지침은 현재 세션에 적용되지만 세 CLI가 자동 로딩하는 로컬 파일의 존재 증거가 아니다.
- `Get-Command`로 claude.exe, agent.ps1, gemini.ps1 실행 경로는 확인했다. 이 작업에서 실행/버전/로그인/한도/파일 자동 로딩/앱 권한은 검사하지 않았다. 이름만으로 특정 문서·코드·Google 앱 작업이 가능하다고 확정하지 않는다. 기존 aiops `docs/aiknowhow/AI-CLI연동.md`도 설치·PATH·인증·신뢰·권한·한도를 구분하며 과거 관찰로 표시한다.

## 모든 도구에 공통인 시작 순서

1. 총괄이 기존 오더/담당/진행 상태를 조회하고 선행 의존, 중복 배정, 요구 버전, 실행 위치, 소유 파일을 확인한다. 사용자는 총괄에게 말하며 CLI 명령/JSON을 작성할 필요가 없다.
2. 호스트는 해당 도구에 이 문서와 WORK_READ_FIRST, 범위가 제한된 현재 패킷을 **명시적으로** 제공한다. 도구가 읽었다는 결과를 확인한다. 자동 탐색 파일 이름을 써 놓았다는 이유로 적용 완료로 간주하지 않는다.
3. 조회는 claim이 아니다. 실제 중앙 원자적 claim 성공 및 정본 실행 조건 확인 전에는 구현/외부 작업을 시작하지 않는다. PR21의 UI claim 자체도 PR20의 권한/자원 평가를 대신하지 못한다. 실제 연결 부재면 HOLD다.
4. 실행은 각자의 확인된 worktree와 지정 소유 파일 안에서만 한다. 다른 세션의 작업을 같은 역할명이라는 이유로 이어받거나 lease 토큰을 인계 패킷에 복사하지 않는다. ACTIVE면 중복 실행 금지, EXPIRED도 자동 탈취/재실행 금지다.
5. 결과에는 동일 order/work 연결, 요구 revision, 대상 commit, 정확한 파일, 검증/미검증, 근거 참조를 남긴다. 중앙 정본 결과를 재조회한 총괄이 다음 담당을 배정한다. report 수신은 독립 검증/완료가 아니다.

## 도구별 최소 시작 지침

| 도구 | 호스트가 명시 제공할 시작 지침 | 이번 확인/미확인 |
|---|---|---|
| Claude Code | 공통 문서·현재 패킷·허용 worktree/파일을 읽고 누락/충돌부터 보고. 이 배정에서 허용된 실제 작업만 수행. | 실행 경로 존재. 프로젝트 지침 자동 로딩·현재 세션 권한·실행 가능 여부 미확인. |
| Cursor Agent | 같은 패킷과 실제 checkout/소유 파일을 대조. IDE의 현재 열린 폴더를 중앙 배정으로 간주하지 않음. | Agent 래퍼 경로 존재. IDE 상태·설정·로그인·자동 규칙 적용 미확인. |
| Gemini CLI | 같은 패킷과 범위 제한 자료 참조를 확인. Google 파일은 별도 승인된 연결로만 읽으며 로그인만으로 접근 추정 금지. | 래퍼 경로 존재. 현 작업의 앱 연결/자료 접근·자동 지침 로딩 미확인. |

어떤 도구든 불가한 기능은 이유와 미확인 범위를 보고한다. 자동승인/신뢰 해제/인증 재설정으로 우회하지 않는다. 이번 준비 단계는 실제 외부 AI를 실행하지 않으므로 역할 간 실사용 검증은 아직 없다.

## 기존 함수 재사용과 읽기 검증

`scripts/read-ai-work-packet.mjs`는 import용 모듈이다. 독립 CLI 접속/로컬 DB 탐색은 제공하지 않는다. 통합 호스트가 **기존** `RemoteOrderClient` 인스턴스를 `readAiWorkPacket({ client, orderId, taskId })`에 주입한다. 클라이언트의 실제 `packet(id, taskId)` 다음 `checkContext(id, taskId)`만 호출한다. 존재하지 않는 API, 자체 fetch, 새 연결 옵션, 쓰기 재시도는 없다.

기존 RemoteOrderClient는 loopback SSH 전송과 지정 ledger ID 응답을 검사한다. 호스트가 올바른 중앙 정책/클라이언트를 주입해야 하며, 임의 client 객체가 정본이라는 사실을 이 모듈이 인증하지는 않는다. DI fixture 통과가 실제 중앙 연결의 증거는 아니다.

| 공통 패킷 정보 | 현재 읽기 투영 | 총괄 통합에 필요한 정보 |
|---|---|---|
| order_id/task_id/요구 revision/order version | 기존 PR21 값과 요청/재조회 일치 검사 | 계속 같은 중앙 업무를 사용 |
| work_id/대상 commit | null, UNLINKED_WORK | 정본 order→work 매핑과 subject_revision. UUID order ID나 요구 버전을 commit으로 대입 금지 |
| 실행 위치/소유 파일 | null, EXECUTION_SCOPE_UNAVAILABLE | 실제 호스트/worktree/branch 및 경계 확인. project 문자열로 추정 금지 |
| 담당 | 기존 assigned allowlist 값 | 중앙 담당 확인. 같은 AI 이름이 같은 실행 세션/claim이라는 뜻 아님 |
| 선행 작업/차단 이유/근거 링크 | null, DEPENDENCY_EVIDENCE_UNAVAILABLE; 원래 blockedReason이 있으면 범위 제한 재조회 필요 코드 | 정본 의존 상태, 비밀 없는 차단 사유 참조/근거 링크를 제공할 실제 adapter 연결 필요 |
| 관찰/유효 시각/lease | 시각 null, FRESHNESS_UNAVAILABLE; NONE/ACTIVE/EXPIRED 관찰 | 서버 기준 관찰·만료·claim 소유 확인. 로컬 시각을 서버 유효기한으로 만들지 않음 |

패킷·후속 context의 요구/version/담당/task 상태/order 상태가 바뀌면 CONTEXT_CHANGED다. 두 GET은 원자적 snapshot이 아니며 같아도 이후 변경 가능성을 제거하지 못한다. 실행 직전 정본 재조회와 실제 중앙 claim이 필요하다. 현재는 정보가 맞아도 항상 HOLD, execution_authorized=false, claim_acquired=false다. 새로운 adapter 데이터 규격/원장 필드는 만들지 않았다.

원본 title/intent/criteria/instructions/events/previousResults/blockedReason와 임의 추가 필드는 반환하지 않는다. 서버 오류도 원문 대신 READ_FAILED를 반환한다. 근거 링크는 민감 내용이나 query token을 포함할 수 있어 기존 임의 문자열에서 자동 추출하지 않고 null로 둔다. ID/담당조차 외부 공개용 익명화는 아니며, 출력은 승인된 내부 작업 범위에서만 사용한다.

## 최소 적용 diff 제안 — 개발통합 담당 소유, 미반영

실제 존재하는 `WORK_READ_FIRST.md`의 기본 진입점 앞에 다음만 추가하는 안이다:

```diff
+공통 AI 작업은 docs/coordination/CROSS_AI_ENTRYPOINT.md를 먼저 읽는다. 총괄은 기존 중앙 작업/담당을 조회하고 현재 패킷·실행 위치·소유 파일을 제공한다. 조회 결과는 claim/실행 승인이 아니다. 중앙 연결과 실제 claim이 없으면 HOLD로 보고한다.
```

AGENTS.md/CLAUDE.md/GEMINI.md/.cursor/rules는 현재 존재/로더 동작이 확인되지 않아 **기존 파일 수정 diff는 제시할 수 없다**. 임의로 전부 생성하지 않는다. 통합 담당이 설치된 각 도구의 실제 프로젝트 지침 로딩 지원을 확인한 후, 해당 도구가 읽는 파일 하나에 다음 포인터만 넣는 최소 안을 선택한다. 원본 공통 문서를 복제하지 않는다:

> 이 프로젝트의 공통 시작 지침은 WORK_READ_FIRST.md와 docs/coordination/CROSS_AI_ENTRYPOINT.md다. 현재 중앙 배정 패킷을 읽고, 정본 claim/실행 조건 확인 전에는 실행하지 않는다.

로더 확인 전 대안은 총괄/호스트가 시작 프롬프트에서 위 두 문서와 현재 패킷을 명시 지정하는 것이다. 실제 자동 프롬프트 배선도 이번 구현에 없다.

## 수락 검사와 남은 완료 조건

`node --test test/read-ai-work-packet.test.mjs`는 DI fixture로 조회 메서드만 호출, 읽기 사이 버전/담당 변경, ACTIVE/EXPIRED lease, 완료 task, 민감 원문/오류 제거, 위조 binding 무시, 연결 부재를 검증한다. 실제 원장·앱·AI CLI를 호출하지 않는다.

통합 후 필요한 별도 검증: 중앙 작업 목록→올바른 담당 배정→동시 claim 한 쪽만 성공→분리 worktree 실행→버전 변경/만료 차단→근거 report→다음 담당 연결. 문서가 읽혔다는 사실이나 이 테스트만으로 중복 실행 강제 차단을 주장하지 않는다. 정본 adapter와 실제 도구 시작/소비 경로가 아직 선행 의존이다.
