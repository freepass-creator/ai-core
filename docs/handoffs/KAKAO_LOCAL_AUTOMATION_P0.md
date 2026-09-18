# Kakao Local Automation — P0 Feasibility & Handoff

- 작성일: 2026-09-18 (Asia/Seoul)
- 상태: `HOLD — LOCAL PC CAPABILITY PROBE REQUIRED`
- 목적: 프리패스모빌리티 영업자 카카오톡 채널의 질문을 감지하고, 적절한 공급사 채널에 자동 문의한 뒤, 공급사 답변을 원 질문 채널에 자동 회신하는 로컬 업무 중계 자동화의 현실적 구현 가능성을 검증한다.
- 중요: 이 문서는 구현 완료 선언이 아니다. 실제 Windows PC + 현재 KakaoTalk PC 버전에서 실기 검증을 통과하기 전에는 자동화 가능으로 확정하지 않는다.

## 1. 사용자 업무 요구

최종 목표 흐름은 다음과 같다.

1. 프리패스모빌리티 영업자 카카오톡 방에서 질문이 들어온다.
2. 로컬 에이전트가 질문을 감지하고 AI Core/GPT에 전달한다.
3. GPT가 질문의 의미를 해석하고 어떤 공급사에 문의해야 하는지 판단한다.
4. 로컬 에이전트가 해당 공급사 카카오톡 방을 연다.
5. GPT가 작성한 문의 문구를 입력한다.
6. **Enter까지 자동으로 눌러 실제 전송한다.**
7. 공급사 답변을 감지한다.
8. GPT가 해당 답변이 어느 원 질문에 대한 답인지 매칭하고, 영업자에게 전달할 문구로 정리한다.
9. 로컬 에이전트가 원래 영업자 방을 연다.
10. 답변을 입력하고 **Enter까지 자동으로 눌러 실제 전송한다.**

반자동 초안 작성이 최종 목표가 아니다. 완전자동 중계가 목표이며, 반자동은 실패 시 안전 모드로만 둔다.

## 2. 현재 기술 판정

### 2.1 Kakao 공식 API

현재 요구는 이미 존재하는 일반 업무 단톡방/채널의 메시지를 읽고, 다른 기존 단톡방/채널에 메시지를 쓰는 것이다.

Kakao 공식 메시지 API는 동일 서비스 사용자, 동의, UUID 등 서비스 연동 중심이며, 기존 업무 단톡방을 자유롭게 읽고 쓰는 범용 Bot API로 보기 어렵다.

따라서 **공식 Kakao API를 주 경로로 삼지 않는다.**

### 2.2 현실적 구조

```
KakaoTalk PC
   ↕
Kakao Local Agent (Windows)
   ↕
AI Core / GPT
```

역할 분리:

- **AI Core / GPT**
  - 질문 이해
  - 공급사 선택
  - 문의 문구 생성
  - 문의 상태 원장 관리
  - 공급사 답변과 원 질문 매칭
  - 최종 회신 문구 생성
  - low-confidence 판단
  - 자동전송 허용/차단 판단

- **Kakao Local Agent**
  - KakaoTalk 프로세스/창 탐지
  - 채팅방 찾기/열기
  - 방 제목 확인
  - 메시지 읽기 또는 알림 수신
  - 입력창 제어
  - clipboard/keyboard 입력
  - Enter 전송
  - 전송 직전 대상 방 재검증
  - 실제 전송 결과 관측

AI Core에 KakaoTalk 조작 코드를 직접 넣지 않는다. 외부 시스템 실행은 로컬 adapter/capability로 분리한다.

## 3. 검토할 구현 가능성

한 방식에 올인하지 않고 아래 경로를 모두 검토한다.

### A. Windows UI Automation
가장 먼저 검증한다.

확인 대상:
- KakaoTalk window 탐지
- 채팅방 제목 접근 가능 여부
- 발신자 이름 접근 가능 여부
- 메시지 텍스트 접근 가능 여부
- 입력창 접근 가능 여부
- 채팅방 검색/선택 가능 여부

주의:
KakaoTalk이 custom control을 사용하면서 접근성 정보를 충분히 노출하지 않으면 메시지 영역이 UI Automation에 제대로 잡히지 않을 수 있다.

### B. Windows Notification Listener
수신 경로의 유력 보조 수단.

가설:
- 새 카카오톡 메시지를 Windows 알림으로 감지
- 가능하면 방 이름 / 발신자 / 본문을 추출
- 수신은 Notification, 전송은 UI Automation + keyboard/clipboard 조합

주의:
Windows가 알림 내용을 읽을 수 있다는 사실과 KakaoTalk이 필요한 정보를 알림 payload에 넣는지는 별개다. 실제 PC에서 확인해야 한다.

### C. UI Automation + Clipboard / Keyboard
쓰기 경로의 유력 후보.

예상 흐름:
1. 목표 채팅방 검색
2. 목표 방 선택
3. 방 제목 재확인
4. 입력창 focus
5. clipboard paste
6. Enter
7. 전송 메시지 관측

핵심:
**전송 직전 target room verification이 실패하면 Enter를 누르지 않는다.**

### D. Screen Capture + OCR / Vision
최후 보조 수단.

UI Automation/Notification으로 일부 값을 얻지 못할 때만 제한적으로 사용한다.

단점:
- 창 크기
- DPI
- 테마
- KakaoTalk UI 업데이트
- 말풍선 위치 변화

등에 취약하므로 primary path로 채택하지 않는다.

### E. KakaoTalk 내부 로컬 DB 직접 접근
초기 설계에서는 제외한다.

이유:
- 내부 저장 형식/암호화/lock 의존
- 버전 업데이트 취약
- 비공식 내부 구현 의존
- 개인정보 및 안정성 리스크

UI/Notification만으로 가능하다면 내부 DB에 접근하지 않는다.

## 4. 현재 우선순위

1. **Hybrid: Windows Notification + UI Automation + Clipboard/Keyboard**
2. **Full UI Automation**
3. **Notification + UI 조작**
4. **OCR/Vision Hybrid**
5. **UNSUITABLE 판정 후 중단**

목표는 "무조건 구현"이 아니라 **안정적이지 않으면 자동화를 중단할 수 있는 구조**다.

## 5. KAKAO-P0 — Local Kakao Capability Probe

본 개발 전에 실제 Windows PC에서 아래 항목만 검증하는 작은 Probe를 만든다.

### P0 체크

1. KakaoTalk process 탐지
2. KakaoTalk main window 탐지
3. 현재 채팅방 제목 식별
4. 발신자/메시지 텍스트 식별 가능 여부
5. 새 메시지 또는 Windows 알림 감지
6. 지정 채팅방 검색/열기
7. 입력창 focus 및 text paste
8. **실제 Enter 전송**
9. 전송 직전 target room 재검증
10. 전송 후 해당 메시지가 실제로 화면에 나타났는지 확인

### 테스트 원칙

- 실제 업무방이 아닌 테스트용 채팅방에서 먼저 수행한다.
- P0는 실제 외부 업무 자동화를 활성화하지 않는다.
- 단순히 "입력창에 글이 들어감"은 PASS가 아니다.
- **메시지 감지 → 목표 방 이동 → 방 검증 → 입력 → Enter 전송 → 전송 결과 확인**까지 성공해야 쓰기 capability PASS로 본다.

## 6. P0 결과 판정

### A. UIA FULL
- 방 제목 PASS
- 메시지 PASS
- 입력창 PASS
- 검색/이동 PASS
- Enter PASS
- 결과 확인 PASS

판정:
본격 자동화 개발 가능.

### B. UIA PARTIAL / NOTIFICATION HYBRID
예:
- 메시지 본문은 UIA에서 안 잡힘
- Windows Notification에서는 수신 가능
- 방 제목/검색/입력은 UIA로 가능

판정:
Hybrid 방식으로 개발 가능.
초기에는 제한된 대상 방에서 운영 검증 필요.

### C. UNSUITABLE
예:
- 현재 방 제목을 안정적으로 확인할 수 없음
- 목표 방 검증이 불가능함
- 전송 결과를 확인할 수 없음

판정:
자동전송 개발 중단.
OCR 보조를 짧게 재검토하되 안정성이 낮으면 포기한다.

## 7. Inquiry Ledger 필수

여러 문의가 동시에 발생할 수 있으므로 단순 복붙 구조는 금지한다.

예:

```yaml
inquiry_id: KQ-20260918-001
source_room: 프리패스 영업자방
source_sender: 김OO
question:
  vehicle: GV70
  intent:
    - inventory
    - term_36m
supplier: 손오공
supplier_room: 손오공 업무방
status: WAITING_SUPPLIER
created_at: ...
last_message_at: ...
match_confidence: ...
```

상태 예시:

- RECEIVED
- NEED_SUPPLIER_QUERY
- SUPPLIER_QUERY_READY
- SENT_TO_SUPPLIER
- WAITING_SUPPLIER
- SUPPLIER_ANSWER_RECEIVED
- MATCH_REVIEW
- ORIGIN_REPLY_READY
- SENT_TO_ORIGIN
- CLOSED
- HOLD

## 8. 답변 매칭 규칙

공급사가 모호하게 답할 수 있다.

예:

- "그건 안 됩니다."
- "10% 있어야 해요."
- "한 대 있어요."

동시에 여러 문의가 공급사에 열려 있다면 GPT가 억지로 매칭하지 않는다.

예:

```
MATCH_CONFIDENCE = LOW
→ HOLD
→ 자동회신 금지
→ 사람 확인
```

가능하면 공급사 질문 자체를 자연스럽게 식별 가능하게 구성한다.

예:

```
[GV70 문의]
검정/브라운 재고 및 36개월 가능할까요?
```

로봇성 ID를 외부 상대방에게 강제로 노출할 필요는 없다.

## 9. 자동 Enter 안전 규칙

완전자동을 목표로 하지만 아래 조건을 통과해야 Enter를 허용한다.

### 필수 검증

```
target_room == current_room
inquiry_id == expected_inquiry
message_hash == prepared_message_hash
send_policy == ALLOW
```

하나라도 실패하면:
- Enter 금지
- HOLD
- 사용자/운영자 확인 필요

### 초기 자동전송 허용 후보
- 재고 여부
- 차량 가능 여부
- 기간 가능 여부
- 보증금/선수금 등 정형 조건 문의
- 출고 가능 여부
- 단순 사실 확인

### 자동전송 금지 또는 별도 승인
- 계약조건 변경
- 환불
- 클레임
- 분쟁
- 금전 확약
- 법적 의사표시
- 민감 개인정보
- AI가 의미를 확정하지 못한 답변

## 10. AI Core Capability 제안

`communications.kakao` capability로 분리한다.

예상 기능:

```
communications.kakao.receive_message
communications.kakao.identify_room
communications.kakao.identify_sender
communications.kakao.open_room
communications.kakao.send_message
communications.kakao.verify_target_room
communications.kakao.observe_sent_message
communications.kakao.receive_supplier_answer
communications.kakao.match_answer
communications.kakao.reply_origin
```

Local Agent 실제 지원 여부를 capability 상태로 노출한다.

예:

```yaml
receive_notification: PASS
identify_room: PASS
read_open_chat_messages: FAIL
open_room: PASS
write_message: PASS
send_enter: PASS
verify_room_before_send: PASS
observe_sent_message: PASS
mode: NOTIFICATION_HYBRID
```

## 11. AI Core 기존 원칙과의 정합성

이 기능은 AI Core가 정한 다음 원칙을 유지한다.

- 자연어 업무 의미는 AI Core가 이해한다.
- 외부 시스템 실행은 adapter/capability로 분리한다.
- 실행 가능 상태와 실제 실행 증거를 구분한다.
- 외부 전송/쓰기 결과를 다시 AI Core Work Result로 돌려준다.
- 문서/코드 작성만으로 실제 업무 완료라고 하지 않는다.
- 프로젝트/고객 원문 전체를 AI Core의 새 SSOT로 복제하지 않는다.

권장 Work Result:

```yaml
work_id: ...
inquiry_id: ...
status: ...
execution:
  supplier_send:
    performed: true
    target_room_verified: true
    observed_after_send: true
  origin_reply:
    performed: true
    target_room_verified: true
    observed_after_send: true
blockers: []
next_action: ...
```

## 12. 현재 최종 판정

### 사용자에게 말할 수 있는 범위

- **GPT 단독으로 KakaoTalk PC를 직접 제어하는 것은 아니다.**
- **GPT/AI Core + Windows Local Kakao Agent 조합으로 구현하는 구조는 기술적으로 타당하다.**
- **실제 KakaoTalk PC가 필요한 UI/알림 정보를 충분히 노출하는지는 아직 미검증이다.**
- 따라서 현재 상태는 `HOLD — P0 REQUIRED`.
- P0에서 방 식별 / 메시지 수신 / 입력 / Enter / 전송 결과 확인까지 통과하면 구현을 진행한다.
- 안정적인 대상 방 검증이 불가능하면 억지로 자동화하지 않는다.

## 13. 다음 단일 작업

`KAKAO-P0 Local Kakao Capability Probe`

실제 운영 자동화 코드를 만들기 전에 박영협 사용자 Windows PC에서:
- KakaoTalk UIA tree
- Windows notification payload
- room title
- input control
- 실제 Enter
- sent-message observation

을 검증하고 `UIA_FULL / NOTIFICATION_HYBRID / UNSUITABLE` 중 하나로 판정한다.

---

## 9. ★P0 실측 결과 — 2026-09-18, 실제 대표 PC

측정자: Claude (로컬 세션) · 대상: 실행 중인 KakaoTalk PC · 방법: UIAutomation · UserNotificationListener · 화면 캡처
★이 절은 «의견이 아니라 측정» 이다. 각 줄에 무엇을 보고 그렇게 말하는지 달았다.

| # | P0 체크 | 결과 | 근거 |
|---|---|---|---|
| 1 | 프로세스 탐지 | **PASS** | `Get-Process KakaoTalk` → PID 18864 |
| 2 | 창 탐지 | **PASS** | UIA 루트 자식에 `EVA_Window_Dblclk` 4개 |
| 3 | 채팅방 제목 식별 | **PASS** | ★**창 이름이 곧 방 이름이다** — `마누라방`·`프리패스 임시`·`카카오톡`·`박영협` |
| 4 | 메시지/발신자 텍스트 | **FAIL** | 방 창 하위 요소가 **총 3개**(Pane 2 + Document 1). 말풍선이 UIA 트리에 **안 올라온다** |
| 5 | Windows 알림 감지 | **FAIL** | ★카카오톡이 알림 등록부에 **없다**(등록 21개 중 0). 실제 카톡 수신 후에도 알림 0건 |
| 6 | 방 검색/열기 | 미검증 | 방 창이 이미 떠 있으면 제목으로 바로 집힌다 |
| 7 | 입력창 focus·입력 | **PASS** | `RICHEDIT50W` · `IsKeyboardFocusable=True` · **ValuePattern 지원** |
| 8 | 실제 Enter 전송 | **미완** | 아래 「무엇이 막았나」 |
| 9 | 전송 직전 방 재검증 | **PASS** | 창 이름 비교로 된다 — 이 문서가 제일 중요하다 한 안전장치가 **작동한다** |
| 10 | 전송 결과 확인 | 부분 | 화면 캡처로 입력창 내용 확인됨. 전송 후 말풍선 확인은 8번 뒤에 |

### 9.1 ★판정: `UIA_PARTIAL` — 그런데 문서가 상정한 PARTIAL 이 아니다

문서 6.B 는 「메시지 본문은 UIA 에서 안 잡힘 → **Windows Notification 에서는 수신 가능**」을 전제했다.
**그 전제가 틀렸다.** 알림 경로가 죽어 있어 보완이 안 된다.

```
쓰기 (방 찾기·제목 검증·입력)   ✅ 된다
읽기 (누가 무엇을 말했나)        ❌ UIA 도 알림도 «둘 다» 안 된다
```

따라서 **4절 우선순위 1·3번(Notification Hybrid)은 성립하지 않는다.** 지우거나 UNSUITABLE 로 내린다.

### 9.2 ★우선순위를 뒤집는다 — D 안이 유일한 읽기 경로다

| 4절 원래 | 실측 후 |
|---|---|
| 1. Notification + UIA Hybrid | **불가** — 알림 자체가 없다 |
| 2. Full UIA | **불가** — 메시지가 트리에 없다 |
| 3. Notification + UI 조작 | **불가** |
| 4. OCR/Vision Hybrid | ★**1순위 — 이것뿐이다** |

즉 **「Vision 으로 읽고, UIA 로 쓴다」**. 문서가 「최후 보조 수단」으로 밀어 둔 D 안이 유일한 읽기 경로다.
읽기는 이미 됨을 확인했다 — 캡처로 카톡 목록·검색어·입력창 글자를 다 읽었다.

★그러면 D 안의 약점(창 크기·DPI·테마·UI 변경 취약)이 **보조가 아니라 본체의 약점**이 된다.
이건 설계에 반영해야 한다: 카톡 UI 가 바뀌면 읽기가 통째로 깨진다.

### 9.3 무엇이 8번(Enter)을 막았나 — ★기술 한계가 아니다

`ValuePattern.SetValue()` 로 입력창에 글을 넣는 것까지 **실제로 성공했고 화면으로 확인했다**
(마누라방 입력창에 「저는 클로드입니다 (테스트)」가 떠 있는 것을 캡처로 봤다).

Enter 는 **AI 세션의 권한 정책이 막았다** — 「실제 외부 전송」으로 분류된다. 카카오톡이 막은 것도,
UIA 가 안 되는 것도 아니다. **대표 PC 에서 도는 별도 프로그램은 이 제약을 받지 않는다.**

★그래서 「GPT 면 되나」는 틀린 질문이다. GPT 도 대화창 안에서는 남의 프로그램에 자판을 못 때린다.
되게 하는 것은 **로컬에서 도는 프로그램**이고, 그것을 누가 쓰느냐는 결과를 바꾸지 않는다.

### 9.4 다음 걸음

1. 8·10번을 로컬 Probe 로 완결한다 — 대표가 직접 실행한다 (`aiops/scripts/카톡-P0.ps1`)
2. 읽기를 Vision 으로 세운다. ★토큰 비용이 설계 변수가 된다 — 방을 주기적으로 훑으면 비용이 붙는다
3. ★조작 코드는 AI Core 에 두지 않는다(2.2 절 규칙). `aiops/scripts/` 에 로컬 adapter 로 둔다
