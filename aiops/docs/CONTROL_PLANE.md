# aiops 운영 헌장

2026-08-20 대표가 확정하고 Claude Code가 구조 검토한 운영 방식이다. **Claude는 구조를 설계·승인하고, Codex는 승인된 범위의 업무를 실행·검증한다.** 이 문서와 여기서 가리키는 제어 규격은 구조의 정본이다.

## 역할

| 담당 | 책임 | 하지 않는 일 |
|---|---|---|
| Claude Code | 구조·표준·판정 기준 설계, 구조 변경의 DESIGN 검토, 라이브 작업의 FINAL 독립 검토와 중지 판단 | 반복 실행·대량 구현·Sheet/Drive/데이터센터 직접 변경 |
| Codex | 중앙 운영: 작업 등록·배정·통합·테스트·검증·보고, 승인된 라이브 변경 실행 | Claude 승인 없이 구조·권한·새 업무 경로를 바꾸거나 사용자 승인 없이 라이브 변경 |
| Cursor | 전용 branch/worktree의 코드·UI 구현과 정적 검토 | 통합 worktree 수정·운영 데이터 접근·실행·정책 결정 |
| Gemini | 직원 안내, Codex가 전달한 최소 범위의 읽기 분석·초안 | 실행·상태 변경·작업 자동 생성·원문 반출·정책 결정 |

직원은 **Codex와 Gemini만** 접점으로 사용한다. Claude와 Cursor는 직원 요청을 직접 실행하지 않는다.

## 구조와 업무의 경계

다음은 **보호 구조**다. Codex는 먼저 Claude의 `DESIGN / APPROVE`를 받아야 바꿀 수 있다.

- 이 헌장과 등급·트리거를 정의하는 문서: `docs/CONTROL_PLANE.md`, `docs/BOUNDARY.md`, `docs/TRIGGERS.md`, `docs/ONE_LINE.md`, `docs/ROLES.md`, `AGENTS.md`, `AI_GUIDE.md`, `CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `.cursor/rules/`
- 제어 코드와 데이터 계약: `lib/lease.mjs`, `lib/task-board.mjs`, `lib/goog.mjs`, `scripts/with-lease.mjs`, ID·스키마·권한 규격, runbook 템플릿
- 새 자동화 경로, 권한/리소스 범위 확대, Sheet 탭·열 구조, 판정 기준의 정의

기존 승인 SOP 안의 세부 순서·체크리스트·문구·국소 판정 조건은 Codex가 개선할 수 있다. 단, 트리거·권한·리소스·라이브 쓰기 범위를 바꾸거나 새 SOP를 만들면 보호 구조로 승격한다. 애매하면 `DRAFT`로 올린다.

## 작업 등급과 승인

| 등급 | 범위 | Codex가 단독으로 할 수 있는 일 | 필요한 승인 |
|---|---|---|---|
| A | 읽기 전용, 로컬·가역적 편집, 테스트 | 실행·검증·보고 | 없음 |
| B | 이미 Claude가 승인한 SOP 내부의 분석·시뮬레이션·DRY RUN | 실행·검증·보고 | 없음. B를 Codex가 D로 승격할 수 없음 |
| C | 새 업무 흐름, 보호 구조, 권한·범위 확대 | Claude DESIGN 뒤 구현·테스트·결과 제출 | Claude `DESIGN / APPROVE` |
| D | Sheet·Drive·데이터센터 등 외부 시스템의 실제 쓰기·이동·삭제·권한·스키마 변경 | Claude·사용자 승인 뒤 Codex만 실행 | Claude `DESIGN / APPROVE` + `FINAL / APPROVE` + 사용자 **직전 실행 승인** |

- 검토는 현재 작업 revision, 선언 리소스, 허용 명령/스크립트 hash, 범위와 만료 시각에 묶는다. 기본 만료는 **24시간**이다.
- 리소스·범위·허용 명령·코드 revision이 바뀌거나 재큐잉하면 기존 승인은 무효다.
- D는 `REVIEW → APPROVAL_PENDING → APPLIED → VERIFIED → CLOSED` 외의 경로로 종료할 수 없다. `REVIEW → VERIFIED`는 A/B/C의 비라이브 작업에만 쓴다.
- Claude의 설계·최종 검토는 사용자의 실제 외부 변경 승인을 대체하지 않는다.

## ★★행위 문턱 — 다중 검증 대체 구조 (OPS-20260831-110 · 2026-08-31)

대표(2026-08-31): 「과태료 발송전 PDF 생성의 승인 구조를 **Claude 단일 필수**에서
**다중 검증 대체** 구조로 바꿔 주세요」

### 왜 바꿨나

D등급이 「Claude DESIGN + FINAL + 대표 승인」 이었다. ★**Claude 가 한도를 넘거나 로그인이 풀리면
아무것도 못 나간다.** 2026-08-20 에 Codex lease 만료로 일이 멈춘 것과 같은 단일 지점이다.

그리고 등급이 「Drive 를 건드리나」 하나로 갈려 **«새 파일 하나 얹는 것»과 «정본을 지우는 것»이
같은 문턱**을 넘어야 했다. 위험이 다른데 문턱이 같으면 사람은 낮은 쪽에 맞춰 문턱을 낮춘다.

### 행위로 가른다 — `lib/seungin.mjs`

| 행위등급 | 무엇 | 검토자 | 대표 승인 | 긴급 우회 |
|---|---|---|---|---|
| `local` | 로컬 PDF 생성·형식 검증 | 없음 | 없음 | — |
| `drive-add` | Drive 발송전 폴더에 **새 파일만** 추가 | **1명** | 필요 | 가능 |
| `protected` | 삭제 · 영구이동 · 권한변경 · **관청 실제 발송** · 정본 대량삭제 | 1명 | 필요 | ★**불가** |

- **검토자**: `claude`(기본) · `cursor` · `gemini`. ★**한 명이면 된다.** Claude 가 없으면 Cursor·Gemini 가 대신한다.
- **실행자**: `codex` · `claude` (lease 를 잡을 수 있는 쪽). ★**실행자는 자기 일을 자기가 검토할 수 없다.**
- `local` 은 Codex 단독으로 돈다 — 바깥에 아무것도 안 나간다.

### ★검토를 지어내거나 생략할 수 없다

검토·승인은 **계획SHA · 양식SHA · 대상해시** 셋에 묶인다.
★셋 중 하나라도 바뀌면 앞의 검토는 **없는 것**이 된다 — 계획을 고치고 옛 승인을 재활용할 수 없다.

기록은 `.coordination/seungin.ndjson` 에 **append-only** 로 쌓이고 **사슬해시**로 이어진다.
고쳐 쓰거나 지우면 사슬이 어긋나 드러난다. ★파일을 통째로 다시 써서 사슬을 새로 이으면
사슬만으로는 성해 보이므로, **`.coordination/audit.ndjson` 과 대조**한다(`대조검사()`).
숨기려면 **두 파일을 다 고쳐야** 한다.

### 긴급 우회 (대표 직전 승인)

대표가 **대상·건수·계획SHA·양식SHA** 를 확인하고 「긴급 실행 승인」 하면 AI 검토 없이 실행한다.

- 허용 범위: **로컬 PDF 생성**과 **Drive 발송전 폴더에 새 파일 추가**까지만
- ★금지: 기존 파일 삭제·영구 이동·권한 변경·관청 실제 발송·정본 대량 삭제 — **긴급으로도 못 연다**
- 유효시간 **기본 15분**. 승인 문구·시각·**실행 명령 해시**·대상 해시가 남는다
- ★승인은 **그 명령에만** 묶인다. 다른 명령으로는 못 쓴다
- 실행 **전후** 검증 결과가 이력에 남는다

### 쓰는 법

```bash
node scripts/with-lease.mjs --resource drive --agent codex --행위 drive-add --계획 tmp/계획.json --양식 lib/penalty/양식.ts --대상 tmp/대상.json -- node wonja/gwataeryo-seoryu.mjs --만든다
```

★`--행위` 를 **안 주면 전과 똑같이** 돈다(호환). 준 때만 문턱이 선다.
`--행위` 를 줬으면 `--계획 · --양식 · --대상` 이 **모두** 있어야 한다 — 없으면 승인을 지어낼 수 있다.

시험 : `node --test test/seungin.test.mjs test/with-lease-seungin.test.mjs`


## 직원과 Gemini의 경계

Gemini는 실행기가 아니라 안내·요약 도우미다. 자세한 규격은 [CODEX_GEMINI_PROTOCOL.md](CODEX_GEMINI_PROTOCOL.md)에 둔다.

1. 직원 요청은 Gemini에서 자연어 안내 또는 Codex 검토용 `DRAFT`가 될 수 있을 뿐, 실행 명령이 아니다.
2. Codex는 신원·역할을 확인한 뒤 해당 직원의 **자기 업무 범위 카드**만 Gemini에 전달한다. Gemini가 Sheet/Drive를 직접 읽거나 다른 직원 업무를 보여 주지 않는다.
3. Gemini 출력은 자연어 요약·질문·초안만 허용한다. 코드·명령·설정·원문 첨부·자동 실행 신호를 Codex에 보낼 수 없다.
4. 관리자용 범위 확대나 Gemini의 직접 데이터 접근은 별도의 역할·신원·보존 정책을 Claude가 설계하고 대표가 승인한 뒤에만 허용한다.

## 작업 생명주기

```text
A/B:  DRAFT(선택) → 분석·DRY RUN → 검증 → CLOSED
C:    DRAFT → QUEUED ── Claude DESIGN ──→ RESERVED → ANALYZING → REVIEW → VERIFIED → CLOSED
D:    DRAFT → QUEUED ── Claude DESIGN ──→ RESERVED → ANALYZING → REVIEW
                                                                  └─ Claude FINAL → APPROVAL_PENDING
                                                                     └─ 사용자 직전 승인 → APPLIED → VERIFIED → CLOSED
```

- 작업대장에는 비식별 제목·범위·등급·파일 경로·리소스·검증 증적만 남긴다. 직원·고객 이름, 연락처, 원문, 인증 정보는 남기지 않는다.
- Codex는 `VERIFIED` 전에 테스트·DRY RUN·원본 재조회·롤백 위치를 기록한다. 실패·원본 변경·lease 상실은 `FAILED` 또는 `STALE`로 돌리고 revision을 새로 낸다.
- 활성 작업이 같은 코드 경로 또는 라이브 리소스를 예약하려 하면 작업대장이 충돌로 막는다.

## 신호와 자동화

직원 업로드·코멘트·완료 체크·시간은 **읽기 전용 신호**다. `watch.mjs` 같은 감지기는 알림, 비식별 DRAFT, 로컬 분석만 자동으로 만들 수 있다. 신호가 Sheet·Drive·데이터센터 변경을 자동으로 일으키면 안 된다. 실제 변경은 항상 D 등급으로 다시 검토한다. 자세한 매핑은 [TRIGGERS.md](TRIGGERS.md)를 따른다.

## 격리와 lease

- 통합 worktree `C:/dev/aiops`는 Codex만 사용한다. Cursor는 `agent/cursor/<작업ID>` branch와 별도 worktree에서 수정하고, Codex가 검토된 커밋만 통합한다.
- 라이브 쓰기는 Codex가 `scripts/with-lease.mjs`로 획득한 선언 리소스 lease 안에서만 실행한다. 자식 writer는 lease를 다시 획득하지 않는다.
- 임시파일은 `tmp/<agent>/<task-id>/<run-id>/`에만 둔다. 고정 `tmp` 이름과 원문·백업의 Git 추적은 금지한다.
- 현재 lease는 같은 PC와 같은 `.coordination` 디렉터리를 쓰는 **신뢰된 프로세스 사이의 충돌 방지 장치**다. 다른 PC, 별도 데이터센터 API, 직접 `fetch`, 같은 자격증명을 가진 다른 프로세스까지 강제 차단하지는 않는다.
- 강한 권한 분리가 필요하면 Google/데이터센터 쓰기 자격증명을 Codex 전용 OS 계정 또는 승인 broker에 격리하고, 다른 AI에는 읽기 전용 연결만 제공한다.

## 중지와 보고

Codex는 구조가 모호함, 승인 만료, scope drift, lease 충돌, 테스트 실패, 원본 변경, 민감 원문 노출 가능성을 발견하면 멈추고 Claude 또는 대표에게 올린다. 실제 외부 변경·삭제·권한·스키마·대량 처리와 데이터센터 접속 방식의 확정은 대표의 직전 승인을 받는다.
