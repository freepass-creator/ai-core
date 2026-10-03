---
name: mail-read
description: 회사 메일함(지메일)을 읽거나 찾아야 할 때 — "메일 왔어?", "그 메일 내용 봐줘", "안 읽은 메일", "누가 보낸 메일 찾아". 이 PC 의 gws 로 직접 읽는다(다른 AI 를 거치지 않는다).
---

# 메일 읽기 — `gws gmail` (2026-10-03 실행 확인)

```bash
gws gmail +triage --max 10 --format table        # 안 읽은 메일 요약(보낸 사람·제목·날짜)
gws gmail +read --id <메시지ID> --headers          # 한 통 본문 + From/To/Subject/Date
gws gmail users messages list --params '{"userId":"me","q":"from:보낸이 newer_than:7d","maxResults":10}'   # 검색(Gmail 검색식)
```

- JSON 따옴표 때문에 PowerShell 보다 **Bash** 로 부른다.
- 요청 범위만 읽는다. 메일함 전체를 훑거나 원문을 저장소·로그에 옮기지 않는다(고객 개인정보).
- 인증 오류면 그 층(인증)을 그대로 적고 멈춘다 — 재설치·재로그인을 추측해서 하지 않는다. 막히면 `blocked-escalate`.
- 답장·전달은 `+reply`/`+forward` 가 있지만 «보내는» 일이다 → `mail-send` 의 승인 규칙을 그대로 따른다.
