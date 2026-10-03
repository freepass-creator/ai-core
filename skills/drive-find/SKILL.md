---
name: drive-find
description: 구글 드라이브에서 파일·폴더·시트를 찾아야 할 때 — "드라이브에서 찾아", "그 파일 어디 있어", "시트 ID 모르겠어", "폴더 안 파일 목록". gws 로 직접 찾는다.
---

# 드라이브 찾기 — `gws drive files list` (2026-10-03 실행 확인)

```bash
gws drive files list --params '{"q":"name contains '\''견적'\'' and trashed=false","fields":"files(id,name,mimeType,modifiedTime)","pageSize":20}'
gws drive files list --params '{"q":"'\''<폴더ID>'\'' in parents and trashed=false","fields":"files(id,name)"}'
```

- 시트만: `"q":"mimeType='\''application/vnd.google-apps.spreadsheet'\'' and name contains '\''…'\''"`.
- 따옴표가 겹치므로 **Bash** 로 부른다. 찾은 ID 는 `google-sheets` 로 넘긴다.
- 업무 시트는 먼저 `C:\dev\ai-ops\docs\지도\SHEET_MAP.md`(F코드)를 본다 — 같은 이름의 사본이 여럿일 수 있다.
- 찾기는 요청 범위만. 파일 공유·권한 변경·이동·삭제는 사용자 지시가 있을 때만.
