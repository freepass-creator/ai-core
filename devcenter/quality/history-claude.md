## High

**1. `academy.tsx` — the fetched catalog is used unvalidated, and the grader throws inside the render body**

`fetch('/catalog/standard-cards.json') → r.json()` is cast straight to `Data`; the only guard is `r.ok`. Then the render body runs `const result=gradeQuestions(data.questions,answers)` unconditionally. `gradeQuestions` throws on: duplicate `q.id`, empty `q.id`, `choices.length<2`, non-integer or out-of-range `q.answer`. Any of those in the shipped JSON crashes the render — **not** the `.catch`, because `setData(d)` already resolved successfully and the throw happens on the next render. The `error-box` / "다시 불러오기" recovery path is therefore unreachable for exactly the failure it looks like it covers. Same class: `data.counts.registered`, `data.questions.map`, `card.example.page` are all dereferenced without a shape check.

Fix: validate the payload in the `.then` (or a `parseCatalog` mirroring `parseHistory`'s strictness) and reject there, so failures land in `setError`. Secondary: `.catch(e=>setError(e.message))` surfaces raw `JSON.parse` SyntaxError text (English) into a Korean UI when the response body is malformed.

**Latent variant:** `answers`/`graded`/`selected` are never reset when `data` is replaced. If an answered id disappears from the new question set, `gradeQuestions`'s `invalid` check throws in render. Today this is hard to reach (the only `setRetry` trigger sits behind the error branch, which can't render once data has loaded), so it bites via fast refresh or any future refetch trigger. Reset `answers` in the same effect that sets `data`.

## Medium

**2. Non-secure context: persistence is impossible *and* the stated fallback is also impossible**

`persist` requires `navigator.locks`, `save` requires `crypto.randomUUID`, `exportHistory` requires `navigator.clipboard`. All three are secure-context-only. On an http origin (or where these are stripped), the lock check produces "기록을 내보내서 보관하세요" — but the export button calls `navigator.clipboard.writeText`, which is unavailable for the same reason. The advice cannot be followed. The `crypto.randomUUID` case isn't guarded at all and surfaces a raw English TypeError. Add a non-clipboard export (readonly textarea / Blob download) and a `randomUUID` fallback, or state the secure-context requirement up front.

**3. One bad record makes the entire archive unreadable, with no in-app repair**

`parseHistory` is all-or-nothing over `value.records`. A single malformed record sets `ready=false`, which disables both save buttons and the merge button. There is no delete, no prune, no per-record skip, and no "start fresh" — the user's only route out is devtools. Compounding: `mergeHistory` throws at >200 records and nothing can ever be removed, so a heavy user reaches a terminal state where no new session can be saved. For a "persistent multi-session record" requirement this is the main durability gap.

Mitigating (and correctly built): `exportHistory` reads `localStorage` raw rather than `archive`, so the data is still extractable while the parsed view is broken. Nothing overwrites or deletes on the error path — the "저장 원문은 자동으로 덮어쓰거나 삭제하지 않습니다" claim holds in code.

**4. `outcome:'passed'` is self-reported, survives import, and silently drives an aggregate**

`relearn` excludes any practice record with `outcome==='passed'`, and that value comes either from a `<select>` the user picks themselves or from pasted JSON produced on another machine. The only additional gate is `evidence` being non-empty (any string passes). Per-record display is correctly hedged ("실행 성공 기록 · 검수 대기", "원본 확인 미검증 · 승인 대기"), but the `<h3>보관 N건 · 재학습·보완 대상 M건</h3>` count reads as a work-remaining figure with no self-report qualifier. Recommend counting self-declared passes in a distinct bucket ("자가 보고 성공 · 미검수 K건") rather than removing them from the outstanding set.

Also, merged records carry no provenance — after import, a record created here and one pasted from elsewhere are indistinguishable, and `createdAt` is arbitrary (backdated/future values pass the regex). The import copy says "가져온 기록은 자가 기록으로 취급합니다", which is the right framing; there is just nothing structural behind it.

**5. `questionVersion` is trusted, never verified against `questions`**

`parseHistory` only checks that it's 64 hex chars, then uses equality with `currentVersion` to decide whether to regrade. Nothing in the reviewed code recomputes the hash over `data.questions`. If a build ships a changed question set under an unchanged version string, old answers are regraded against new questions — wrong scores, or a throw that trips finding #3 and bricks the whole archive read. Verify the hash client-side at load, or treat a mismatch as "재학습 필요". I cannot check the generator from these excerpts.

## Low–Medium

**6. Merge conflict detection is key-order sensitive.** `JSON.stringify(old)!==JSON.stringify(record)` in `mergeHistory` — round-tripped exports preserve key order, but the UI explicitly invites pasted JSON, where a reordered-but-identical record falsely trips "같은 ID의 내용이 다릅니다" and aborts the *entire* merge. Compare field-by-field over the known key list.

**7. Display order is insertion order, not time order.** `[...archive.records].reverse()` puts merged-in records at the top regardless of `createdAt`, so history imported from an older session presents as the newest. Sort by `createdAt`. Related: `{r.createdAt}` renders the raw UTC ISO string.

**8. Errors don't identify what failed.** An empty session name yields "이력의 필수 내용 또는 길이를 확인하세요" — `textField` is shared across session/evidence/plan values, so the user can't tell which field or which record. Import failures give no record index or id. The session `Input` has no `required`/`aria-invalid`.

**9. Re-grading on every keystroke.** Typing in `Practice` fires `onPlanChange` → `setPlan` in `Academy` → re-renders `LearningHistory`, which recomputes `relearn` and per-record `score`; each `gradeQuestions` call re-validates the whole question array. That's O(records × questions) per character, up to 200 records. Memoize the grade per record id, or lift the plan draft out of `Academy`.

**10. `id` regex `/^[a-f0-9-]{36}$/i` accepts non-UUIDs** (36 hyphens passes). Record identity, dedup and merge conflict detection all key off it. Use the actual UUID shape.

**11. No duplicate-content guard on save.** Fields aren't cleared after a successful save and every click mints a fresh UUID, so a double-click yields two records that `mergeHistory` will never see as conflicting — they just consume the 200 cap.

## Low

- `academy.tsx` card detail hardcodes "이 카드 버전의 독립 의미 검토·정식 승인은 아직 완료되지 않았습니다" regardless of `card.audit.reviewComplete`/`approved`, while the metrics panel counts those same dimensions. It errs safe (understates), but the detail can contradict the header. `structureComplete`, `reviewComplete`, `testEvidenceStatus`, `approved` are never rendered per card.
- `cards.find(c=>c.id===selected)||cards[0]` silently shows a *different* card when "관련 카드 보기" targets a `cardId` absent from the catalog.
- Card list badge `testsPassed ? '검사 근거 있음' : '검토 필요'` conflates "no test evidence" with "needs review".
- `checkPlan`'s placeholder regex is whole-field exact-match only, so "추후 확인" passes. This is consistent with the UI's stated scope (누락 확인 only) — worth leaving as-is rather than strengthening it into something that reads as content validation.
- `card.sources.map(s=><div key={s.path}>)` duplicates keys if a card lists the same path twice; radio answers can't be individually cleared once selected.

## Correct as built (the parts most likely to be wrong)

- **Concurrent saves.** `navigator.locks.request(historyKey, …)` wraps read→merge→validate→`setItem` as one exclusive critical section, so cross-tab interleaving can't lose a record. `setItem` precedes `setArchive`, so a quota failure leaves UI state consistent with storage. The `storage` listener correctly includes `e.key===null` for `clear()`.
- **No write/read lockout.** `persist` re-runs `parseHistory` on the *serialized merged* archive before writing, so it can't persist something larger than the 1MB read limit.
- **No forged-approval surface in the data model.** `fields()` whitelists reject unknown keys at archive, record, and plan level; no score or approval field is ever stored; scores are always recomputed from `answers`; `certification`/`approved`/`sourceVerified` are `false as const` and flow into both clipboard payloads.
- **No prototype pollution.** `JSON.parse` creates `__proto__` as an own property, whitelists reject it everywhere except `answers`, where values are constrained to integers 0–100.
- **Stale versions don't regrade.** Records with a non-current `questionVersion` skip `gradeQuestions` in `parseHistory`, and `&&` binding in `relearn` short-circuits before grading them.

## Limits of this review

Static read of the four excerpts, no execution and no other files. Not seen: `./primitives` (so `Button` `disabled`/`variant`, `NativeSelect`, `Input` behavior is assumed), `/catalog/standard-cards.json` and its generator (finding #5 is unverifiable here), the `go()` router and target pages, any error boundary that might soften #1, and the test suites named in `card.verification.suites`. Browser-API availability claims in #2 are from spec behavior, not measured. I did not assess whether a prior `devcenter.learning-history.v1` payload is already deployed in users' browsers.
