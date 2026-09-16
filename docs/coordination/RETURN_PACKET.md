# RETURN_PACKET

Save a free chat's answer as `RETURN_PACKET.md`. It must explain assumptions, proposed files/changes, tests not run and risks in plain Markdown, then include exactly one final `json` block matching this shape. The coordinator verifies it before recording or applying anything.

```json
{
  "schema": "ai-core-ai-proposal/v1",
  "source_ai": "chatgpt-free",
  "generated_at": "2026-09-15T09:10:00Z",
  "captured_at": "2026-09-15T09:15:00Z",
  "target_order_id": null,
  "target_work_id": "WORK-example",
  "handoff_digest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "proposal_summary": "Short proposal summary",
  "proposed_changes": ["Proposed file or action; nothing has been executed"],
  "evidence_refs": ["docs/coordination/AI_CONTINUATION.md"]
}
```

`captured_at` is filled or corrected by the receiving coordinator. Do not include raw customer, case, mail or credential content. This packet grants no authority.
