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
