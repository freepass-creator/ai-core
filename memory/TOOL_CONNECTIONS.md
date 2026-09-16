# Tool / Agent Connection Status

Updated: 2026-09-13

This file records user-confirmed availability of development executors/tools. It is an operational hint, not independent proof that a tool executed successfully on a specific task/revision.

## Gemini CLI

- status: `USER_CONFIRMED_CONNECTED`
- confirmed_by: user in Chat
- scope: development/review assistance through the user's Gemini CLI environment
- verification_state: `NOT_INDEPENDENTLY_VERIFIED_BY_CHAT`
- intended DevCenter role: structure/reference/data relationship review and other bounded tasks permitted by current DevCenter/project rules
- independence rule: Gemini may count as a separate reviewer only when it actually reviews the exact subject revision and its real output/evidence is recorded. Mere login/connection does not constitute review.
- authority rule: connection does not grant production/deployment/live-data/permission-changing authority.

## Usage rule

Work/Codex may treat this as evidence that Gemini CLI is expected to be available, but should record actual invocation success/failure per task. If the CLI fails, auth expires, or environment access differs, mark the task-level capability unavailable rather than assuming this status is current forever.

## Mail connection reuse

Start here before installing, logging in or rediscovering mail accounts. This is the existing connection entrypoint, not a credential store. See [bounded observation and reuse guide](../docs/intake/MAIL_CONNECTION_REUSE.md) and the existing operational procedures `C:/dev/aiops/docs/aiknowhow/메일읽기.md` / `C:/dev/aiops/docs/aiknowhow/메일보내기.md`. Do not copy their source or credentials into this repository.

| Existing identity / role | Existing route / reference | Evidence and limits |
| --- | --- | --- |
| `pyh@teamjpk.com`, TeamJPK Workspace | `%USERPROFILE%/.config/gws`, existing gws protected credentials | 2026-09-15 owner observed auth metadata and Gmail scopes; actual read/send not tested. Workspace default policy remains read-only. |
| Same pyh account, SMTP route | `C:/dev/mailtool/send_mail.py`; existing `GMAIL_ADDRESS` / `GMAIL_APP_PASSWORD` environment references | Sender registration observed by owner; password validity and SMTP sending not tested. This route is not another account. |
| `01046403871w@gmail.com`, user alias 웰릭스 세일즈폰 / local label 업무폰 계정 | Existing profile/credential reference UNVERIFIED | Sales reviewer reported local code/docs for MyData receiving and Contacts. Live login/read/send unverified. Preserve the lowercase `w`; do not infer sending capability. |

`gws-collab` and `gws-admin` were reported as profiles of the same pyh identity, not additional mail accounts. Cursor/Claude login emails do not establish mail registration. Total user mail accounts remain UNKNOWN; no default sender is selected.

1. Resolve the intended account and existing host-specific route from these references; use the caller's request to limit access.
2. Run `node scripts/mail-connection-status.mjs` for local presence/version only. If specifically authorized, `--check-auth` adds existing-profile auth metadata; it does not read mail or send. Do not print raw auth output, errors or secrets.
3. PRESENT/normal metadata means reuse the existing connection and skip installation/login. MISSING, FAILED, UNVERIFIED and AMBIGUOUS remain distinct; inspect only the referenced route and resolve ambiguity before account selection. None automatically means reinstall.
4. Follow [mail handoff](../docs/intake/MAIL_ORDER_HANDOFF.md) for content preparation and revision-bound approval. Sending is always separately authorized; even a send scope or registered SMTP address is not a successful send or permission to send.

These are time-stamped local references, not proof that another PC/server has the same profile. Keep passwords and tokens in their existing protected stores. Registered/metadata counts must not be reported as usable or authenticated account counts when auth status is FAILED/UNVERIFIED.
