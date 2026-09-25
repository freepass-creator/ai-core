# 문서 지도 — 무엇을 언제 읽나

| 문서 | 무엇 | 누가 |
|---|---|---|
| [../AI_GUIDE.md](../AI_GUIDE.md) | 시작하는 법 · **하지 말 것** · 정본 · 열 정의 | 모든 AI, 맨 처음 |
| [CONTROL_PLANE.md](CONTROL_PLANE.md) | 운영 헌장 — 역할·승인·작업 생명주기 | 모든 AI |
| [ROLES.md](ROLES.md) | 역할 요약 (구조설계 Claude / 업무수행 코덱스 / 보조 제미나이·커서) | 모든 AI |
| [BOUNDARY.md](BOUNDARY.md) | **구조 vs 업무** — 코덱스가 스스로 할 수 있는 것과 Claude 검토가 필요한 것 | 코덱스·Claude |
| [INBOX.md](INBOX.md) | 짧은 질문·보고만. 제안은 여기 쓰지 않는다 | 코덱스·제미나이·Claude |
| [제안함.md](제안함.md) | **제안·협업 의견은 여기 하나.** 긴 본문은 `docs/제안/` | 모두 |
| [ONE_LINE.md](ONE_LINE.md) | **말 한마디 시스템** — 직원 한 줄 → AI가 다 처리. 「요청」 탭 설계 | 모두 |
| [TRIGGERS.md](TRIGGERS.md) | **신호 → 작업** — 무엇이 트리거이고 자동/승인/사람 등급 | 코덱스 |
| [sop/](sop/) | **업무 매뉴얼** — 언제·무엇을·어떤 명령으로·확인·멈출 때 | 코덱스(주인) |
| [LOG.md](LOG.md) | 무엇을 왜 고쳤나 (날짜순) | 모두, 이어받을 때 |

## 세션 시작 순서
1. `AI_GUIDE.md` (처음이면) → `docs/README.md`(이 문서) → `LOG.md` 최근 몇 줄
2. `node scripts/task-board.mjs list` · `docs/INBOX.md` — 나에게 온 요청
3. 할 일이 정해지면 `docs/sop/` 에 해당 SOP 가 있는지 먼저 본다
