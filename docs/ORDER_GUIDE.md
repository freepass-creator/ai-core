# 공통 AI 오더 데스크 — 사용 안내

## 무엇을 말하면 되나요?

목표·대상·완료 조건을 편하게 말하면 된다. 특정 AI를 지정할 필요는 없다. 담당을 원하는 경우만 덧붙인다.

- 새 일: “ai-core에 오더 화면 만들어줘. 접수하고 다음 대화에서 이어갈 수 있으면 완료야.”
- 배정: “설계는 Claude, 구현은 Codex, 코드 검토는 Cursor에게 맡겨줘.”
- 분석: “이 자료를 분석하고 수치 근거까지 확인해줘.” 자료 위치와 허용 범위가 필요하다.
- 이어하기: “오더 ORD-… 이어서 해줘. 막힌 이유와 다음 할 일부터 알려줘.”
- 변경: “그 오더에 모바일 검증도 추가해줘.” 기존 오더의 요구 버전이 바뀐다.
- 현황: “지금 나한테 확인이 필요한 일만 보여줘.”
- 대기: “이 작업은 자료가 올 때까지 대기해줘.” 자동 알림·예약 실행은 아직 연결되지 않았다.

이 대화에서는 Codex가 요청을 원장에 등록·갱신할 수 있다. 연결되지 않은 다른 대화의 요청은 자동으로 들어오지 않는다. 그곳에는 오더 번호, AI Core 경로, 아래 공통 인계 방법을 전달한다.

## 실행과 화면

Node.js 24.19 이상을 사용한다. 원장은 실행한 터미널의 위치와 관계없이 `C:\dev\ai-core\.local\orders.sqlite`를 사용한다.

```powershell
Set-Location C:\dev\ai-core
npm run orders:serve
```

브라우저에서 `http://127.0.0.1:4318`을 연다. 이 PC에서만 접속할 수 있으며 재부팅 후 서버를 다시 시작해야 한다. 창을 닫거나 서버를 재시작해도 저장된 오더는 남는다.

1. 새 오더에 요청·프로젝트·완료 조건을 입력한다.
2. 일의 종류에 따라 제안된 담당을 확인한다. 담당 변경은 이유와 함께 기록한다.
3. ‘인계 자료 보기’로 어느 AI든 같은 오더·요구 버전·근거를 읽게 한다.
4. 실제로 일을 시작할 때 ‘담당 작업 시작’으로 작업을 확보한다. 확보는 30분 유효하며 필요하면 연장한다.
5. 결과 요약과 근거를 접수한다. 도구 한도나 자료 누락이면 ‘인계 대기로 전환’한다.
6. 모든 결과가 접수되면 ‘결과 확인 필요’가 된다. 사용자가 완료 조건마다 현재 결과의 근거를 선택해 대조한 뒤 완료를 기록한다.

이 버전의 ‘작업 확보’는 중앙 기록이다. 해당 AI 프로세스를 자동으로 실행하지 않는다. 결과 기록의 AI 이름은 로컬 입력이며 인증된 서명이나 독립 검증 인증이 아니다. 외부 발송·운영 변경은 기존의 대상·범위 확인과 승인 절차를 따른다.

## AI 공통 CLI

```powershell
node C:\dev\ai-core\scripts\orders.mjs list
node C:\dev\ai-core\scripts\orders.mjs show ORD-실제번호
node C:\dev\ai-core\scripts\orders.mjs packet ORD-실제번호 T1
node C:\dev\ai-core\scripts\orders.mjs name 이음
```

`packet`은 읽기 전용 JSON 인계 자료다. 요청과 결과에 민감한 내용이 있다면 외부 AI에 전달하기 전에 비식별·최소 범위로 줄인다. 패킷은 명령이나 승인이 아니며 실제 원본과 현재 원장을 다시 확인해야 한다.

쓰기 명령은 JSON 파일을 입력받는다. 모든 쓰기는 서로 다른 논리 작업마다 고유한 `requestId`를 사용한다. 통신 오류로 같은 작업을 재전송할 때는 같은 파일을 그대로 사용한다.

```powershell
node C:\dev\ai-core\scripts\orders.mjs create C:\작업경로\order.json
node C:\dev\ai-core\scripts\orders.mjs act ORD-실제번호 C:\작업경로\command.json
```

접수 파일:

```json
{
  "requestId": "업무마다-고유한-ID",
  "title": "공통 작업 이어하기",
  "intent": "다른 AI도 같은 요청과 결과를 읽고 이어서 처리하게 해줘.",
  "project": "ai-core",
  "kind": "development",
  "criteria": ["오더가 다시 열려야 한다", "인계 자료에 현재 요구와 이전 결과가 있어야 한다"],
  "source": "사용자 요청 위치 또는 대화 식별자"
}
```

작업 확보 파일:

```json
{
  "requestId": "이번-확보의-고유-ID",
  "version": 1,
  "action": "claim",
  "taskId": "T1",
  "actor": "claude"
}
```

응답의 현재 `version`, `revision`, 해당 작업의 `lease.token`을 사용해 결과를 접수한다. 인계 패킷은 실행 토큰을 포함하지 않는다.

```json
{
  "requestId": "이번-결과의-고유-ID",
  "version": 2,
  "action": "report",
  "taskId": "T1",
  "actor": "claude",
  "token": "확보-응답의-token",
  "revision": 1,
  "summary": "설계 조건과 반례를 검토했다.",
  "evidence": ["검토 기록 경로 또는 커밋과 검사 결과"]
}
```

다른 명령: `assign`(actor, reason), `heartbeat`(actor, token), `block`(actor, token, reason), `note`(note), `revise`(intent, criteria, reason), `cancel`(reason), `close`(confirmed, revision, note, checks). 작업별 명령에는 `taskId`가 필요하다. 모든 명령에 현재 `version`과 `requestId`가 필요하다. 충돌이면 최신 오더를 읽고 의도를 다시 대조한다.

완료 `checks`는 완료 조건 순서대로 `[{"criterion":0,"taskId":"T1","evidenceIndex":0}]` 형태로 현재 작업 결과의 근거를 연결한다. 인덱스는 0부터 시작한다. 근거의 내용이 조건을 충족하는지는 사용자가 확인하며, 시스템은 근거 존재와 요구 버전·연결의 일치만 검사한다.

## 저장·백업·범위

- 운영 원장 `.local/`은 Git에 넣지 않는다. 원문·인증정보 저장소로 사용하지 않는다.
- 정본 데이터베이스 파일을 백업할 때는 서버와 CLI 쓰기를 멈춘 뒤 `.local` 전체를 복사한다. 실행 중에는 WAL 파일을 누락한 DB 단독 복사를 하지 않는다.
- `node scripts/orders.mjs export`는 오더·이벤트의 열람용 JSON이다. 중복 방지 영수증까지 포함한 복구 백업을 대신하지 않는다.
- 저장소별 코드·문서·운영 데이터는 원래 저장소가 정본이다. AI Core는 업무 상태와 참조를 보관한다.
- 첫 버전은 로컬 단일 사용자, 수동 AI 인계, 순차 작업이다. AI 자동 호출, 예약 실행, 여러 PC 동기화, 외부 작업의 자동 실행·재시도, 인증된 사용자·검토자 권한은 아직 구현하지 않았다.
- 이름은 임시 ‘이음’이다. 화면 아래 ‘함께 부를 이름’에서 바꿀 수 있다.

## 다음 단계

실제 오더를 이 원장으로 처리하며 누락을 확인한 뒤, 각 AI 연결부에 실행 가능 상태 확인·최소 범위 프롬프트·읽기 전용 자문 실행·결과 자동 회신을 추가한다. 연결 실패는 다른 AI의 가짜 승인으로 대체하지 않는다.
