---
name: google-sheets
description: 구글 시트를 읽거나 고쳐야 할 때 — "시트 봐줘", "시트에 값 넣어", "이 칸 고쳐", "행 추가", 공급사 시트·업무 시트 작업. 세션이 gws 로 직접 한다 — Codex·대표에게 넘기지 않는다. 숫자(대수·미수·계약)를 «세는» 용도로 쓰지 않는다.
---

# 구글 시트 읽고 쓰기 — `gws sheets` (2026-10-03 확인)

★대표 10-03: 「왜 구글 시트를 직접 못 만지고 코덱스를 통해서 만지냐」. 이 세션이 직접 한다.

## 시트 ID 찾기
`C:\dev\ai-ops\docs\지도\SHEET_MAP.md`(F코드) → 없으면 `drive-find` 스킬.

## 읽기 (실행 확인)
```bash
gws sheets +read --spreadsheet <ID> --range "<탭>!A1:D10"
```

## 쓰기 (`--dry-run` 확인 — 실제 쓰기는 작업마다 되읽기로 증명)
1. **쓰기 전에 같은 범위를 읽어** 지금 값을 남긴다.
2. 쓴다:
   ```bash
   gws sheets spreadsheets values update --params '{"spreadsheetId":"<ID>","range":"<탭>!B2","valueInputOption":"USER_ENTERED"}' --json '{"values":[["값"]]}'
   gws sheets spreadsheets values batchUpdate --params '{"spreadsheetId":"<ID>"}' --json '{"valueInputOption":"USER_ENTERED","data":[{"range":"<탭>!B2","values":[["값"]]}]}'
   gws sheets +append --spreadsheet <ID> --json-values '[["a","b"]]'
   ```
   처음엔 `--dry-run` 을 붙여 요청 모양을 본다.
3. **쓴 뒤 같은 범위를 다시 읽어** 바뀐 값을 확인하고 «전 → 후»로 보고한다.

## 지킬 것
- 시트 수정은 사용자가 시킨 범위만. 다른 사람이 쓰는 업무 시트의 구조(탭·열) 변경, 공유·권한 변경, 삭제는 사용자 지시가 있을 때만.
- 대수·미수·계약 같은 업무 숫자는 시트를 새로 세지 않는다 → `canon-numbers`.
- JSON 따옴표 때문에 **Bash** 로 부른다(PowerShell 은 따옴표가 깨진다).
