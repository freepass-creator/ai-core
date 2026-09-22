## Review scope and what I could not check

Read-only pass over the five files supplied. Six scripts that carry real verification weight are referenced but not included — `verify-function-collector.mjs`, `verify-function-examples.mjs`, `verify-reuse.cjs`, `verify-learning.mjs`, `verify-card-evidence.mjs`, `assess-learning.mjs`. Nine of the 23 machine criteria resolve to a substring of their stdout, so those nine cannot be signed off from this review at all. That is itself a finding (B3, B14 below).

Counting the wiring as written: 41 of 50 criteria have an evidence contract, 16 can be satisfied by machine evidence alone, and 34 are gated on a browser receipt that no supplied file produces. **Today's achievable ceiling is 16/50 = 32%, against a stated target of 70.** HOLD is the correct posture; the blockers below are what stands between here and a defensible number.

---

## Blockers — false PASS

**B1. R09 passes off a stale artifact and never re-runs the work it claims.**
`check('R09')` in `verify-acceptance.mjs` reads `capabilities/packages/VERIFIED.json` and asserts three things: `consumers` deep-equals a literal array, the tgz hash matches, and the source hash matches. None of that demonstrates an install happened. `verify-portable-package.mjs` — the script that actually does the offline install and typecheck — is never invoked by the acceptance suite. The `consumers:['fresh-javascript','fresh-typescript']` field is written by that same script about itself, and `capabilities/packages/` is untracked in git (`?? capabilities/packages/`). Worse, `VERIFIED.json` is not in `sourceDigest()`'s file list (only the `.tgz` is), so hand-editing it invalidates nothing. A months-old, different-machine, different-Node run passes R09 indefinitely. This is the weakest PASS in the set and it is one of only two deep criteria that can ever score.

**B2. I04 verifies the shape of a hash, not the hash.**
`assert(/^[a-f0-9]{64}$/.test(m.get(f.moduleId).sha256))` tests that a 64-hex string is present in `functions.json`. It never rehashes the module file on disk. Likewise `Object.hasOwn(p.get(f.project),'head')` tests key presence, not that `head` is a reachable commit or matches current HEAD, and `f.line>=1` does not establish that the function is at that line. The criterion text reads "located, hash-pinned module and snapshot project record"; the assertion earns none of those three words.

**B3. Eight criteria are four signals counted twice.**
- `I02`, `I03`, `I06` → all `collector.includes('PASS')` from one run.
- `S04` ("changing original bytes invalidates") and `S05` ("changing test implementation invalidates") → the identical `stale.includes('PASS')`. Two distinct invalidation properties, one bit.
- `R05`, `R06` → identical `reuse.includes('PASS')`.
- `L03`, `L04` → identical `learning.includes('PASS')`.
- `I09`, `R08` → both `collector.includes('non-execution')`.

If the collector prints `PASS` for one internal case, three criteria clear. `includes('PASS')` also matches inside `FAIL: expected PASS`. The numerator overstates independent evidence by roughly 8 points, which is 16 percentage points on the headline.

**B4. 34 of 50 criteria rest on an unauthenticated, unproduced receipt.**
`report-acceptance.mjs` accepts `quality/acceptance-browser.json` if `sourceDigest` matches, `stable!==false`, and `appSha256` matches. Nothing else. No runner name, no version, no URL, no artifact hash, no trace. Anyone who can compute two hashes can author `{checks:{D01:{status:'PASS'},...}}` and clear all eight D criteria plus most of L and R. Note also that `stable!==false` treats a *missing* `stable` field as stable — a hand-written receipt that simply omits the key passes that gate. No such file appears in git status, so the browser bucket is currently empty; the blocker is that when it arrives it will carry no provenance.

**B5. `--app` lets browser evidence bind to a file the user never loads.**
`const appFile = appArg<0 ? portal/static/app.js : process.argv[appArg+1]`. The one link between browser claims and shipped code is redirectable by a CLI flag. In a build pipeline pointed at an intermediate artifact, the receipt validates against something that was never served.

**B12. S02 fails the moment a human approves a card.**
`assert.equal(c.review.status,'pending')` for all 12 cards. The suite structurally requires that review never completes. The invariant you want is "no card is self-approved / approval carries a recorded human reviewer," not "all cards are pending forever." As written, progress on standards review breaks acceptance. `R02`'s `runtimeVerified===false` has the same shape but is defensible today; S02 is not.

---

## Blockers — stale evidence

**B6. The timestamp on screen is the wrong timestamp.**
`acceptance.tsx` renders `report.capturedAt` as "검사 스냅샷". That field is `new Date().toISOString()` at report-generation time in `report-acceptance.mjs`. The per-evidence `capturedAt` — the time the checks actually ran — is collected into `evidence[]` and never rendered. A rebuild stamps a fresh date on evidence of any age. There is also no max-age policy anywhere: digest equality is the only freshness test, and it does not cover Node version, OS, npm state, or the external `../freepasserp4` tree beyond what the manifest happens to list.

**B10. The digest is machine-bound, cwd-dependent, and silently tolerates missing files.**
Three defects in `sourceDigest()`:
- Absolute paths are hashed (`C:/dev/devcenter/...`), so relocating the repo or running in CI invalidates every receipt and digests cannot be compared across environments.
- `path.resolve(s.path)` for manifest sources resolves against `process.cwd()`, not `here`. `verify-acceptance.mjs` spawns children with `cwd:here`, but `report-acceptance.mjs` invoked from `portal/` during the static build would compute a different digest and silently mark everything UNVERIFIED. Should be `path.resolve(here, s.path)`.
- `fs.existsSync(p) ? sha(...) : null` — a manifest-listed original that is absent hashes to `null` and the digest still computes. Missing evidence should be an error, not a value.

**B11. The published artifact is outside the digest.**
The walk covers `portal/app` and `scripts`; the fixed list names `portal/public/catalog/*.json`. The browser fetches `/catalog/acceptance.json`, which per git status lives at `portal/static/catalog/acceptance.json` — not in the digest, not checked by the page against anything. The report JSON the user reads is hand-editable with no invalidation. (Separately, the `portal/public` vs `portal/static` split means the digest pins one catalog while the site serves another; worth confirming which is authoritative.)

**B14. Nine machine criteria are trusted verbatim from scripts outside this review.**
Listed at the top. `R04`'s `cases===11` and `R07`'s `result==='PASS'` both come from one unreviewed script's self-report; `I03`, `I05`, `I10` are assertions made about `functions.json` using only `functions.json` (`excluded.sensitive_name>0`, `unindexedCallables>0`, duplicate groups internally consistent). If the generator is wrong, every one of these passes, and the digest then freezes the wrong answer in place.

---

## Blockers — misleading metrics

**B7. The UI's two most important honesty statements are hardcoded strings.**
`acceptance.tsx` prints `전체 수집 자산의 의미 검수율: 미측정 · 네 AI 최종 검토: HOLD` as JSX literals. It does not read `report.assetSemanticCoverage` or `report.overallReview`. Both directions are broken: if coverage is later measured, the page still says 미측정; if someone sets the JSON to APPROVED, the page still says HOLD. Correct-by-accident today, unmaintainable tomorrow.

Compounding this: `overallReview:'HOLD'` is a literal in `report-acceptance.mjs`. There is no four-AI review artifact anywhere — no reviewer identities, no timestamps, no signed record, nothing the HOLD could be lifted *from*. The gate cannot currently be released except by editing a string, which means it also cannot be audited.

**B8. FAIL is invisible in the detail rows.**
Each evidence line renders `{e.kind} · {e.current?'현재 버전':'...'} · {e.result?.description}`. `e.result.status` is never printed. A failing check displays as `자동 검사 · 현재 버전 · Every function has a located, hash-pinned module...` — the criterion's positive claim, next to "현재 버전", with no failure marker. Only the collapsed `<summary>` carries 검증 미완료. Print the status and the `error` string on the evidence line.

**B9. 심화 x/10 is really x/1, and PENDING is hidden.**
Nine criteria — `I08`, `S08`, `S09`, `S10`, `R10`, `D09`, `D10`, `L09`, `L10` — have no entry in `requirements`. All nine are in `deepIds`. So the deep bucket has exactly one gradeable criterion (`R09`, itself blocked by B1) presented as `x/10`. In the aggregate, an unimplemented placeholder is indistinguishable from a criterion that was tested and failed. The report emits `passed/50` with no `pending` or `unverified` counts; `target:70` is emitted and never rendered, so the headline percentage appears with no stated bar.

**B15. The denominator freeze is partial.**
`if(area.criteria.length!==10) throw` guards per-area count, but `total:50`, `basic.total:40`, `deep.total:10`, and `average = sum/5` are all hardcoded and `areas.length` is unchecked. Add a sixth area and `average` can exceed 100 while `total` still reads 50. `deepIds` membership is likewise never validated against the baseline — drift there silently corrupts the basic/deep split. Derive all four numbers from the baseline and assert `deepIds ⊆ ids` with `length===10`.

Minor, related: `average` is arithmetically identical to `passed*2` because every area has exactly 10 criteria. Presenting it as an area-weighted average implies methodology that contributes nothing.

---

## Demonstration vs. production integration

`verify-portable-package.mjs` is a competent **demonstration**. Its PROVENANCE is honest — `kind:'derived_local_package_not_authority'` and a scope line explicitly disclaiming production integration and publication. That honesty is the best thing in this codebase and it never reaches the user: the report drops it, and `acceptance.tsx` renders R09 as `심화 · 검사 통과` with no caveat. **Blocker: propagate `PROVENANCE.scope` into the report and render it on any criterion sourced from a derived package.**

What the demonstration does not establish, and should not be read as establishing:

- **Dependency-freedom is under-enforced.** `assert(!sf.statements.some(ts.isImportDeclaration))` catches top-level `import` declarations only — not `require()`, not dynamic `import()`, not `export {x} from './y'` (an `ExportDeclaration` with a module specifier). A source with re-exports passes this gate and then fails at consumer runtime.
- **The whole module ships, not the two reviewed functions.** `source.js` is the full transpiled file and is listed in `files`. The `exports` map does block subpath access, so it is not reachable — but unreviewed bytes are still in the tarball, while PROVENANCE lists two exports.
- **The TypeScript consumer typechecks a hand-rolled `.d.ts`, not the original types.** `index.d.ts` is built by string surgery: `n.getText(sf).slice('export '.length, n.body.getStart(sf)-n.getStart(sf))`. This breaks on `export default`, on separately-exported declarations, and on overloads (`n.body` undefined). More importantly, if the slice drops or mangles a return annotation, the consumer validates against a declaration that may not describe the emitted JS. Emit declarations with `tsc --declaration` instead.
- **"Runtime validation" is two hardcoded assertions** — `kmValue('8.3만km')===83000` and `fileSizeText(1048576)==='1.0MB'` — chosen by the same script that built the package. No empty, boundary, or malformed input. The typecheck is one line: `const count: number = kmValue(83000)`.
- Also: `skipLibCheck:true` and `types:[]` narrow the typecheck further; the sandbox in `os.tmpdir()` is never cleaned up; the 60s `npm install` timeout will fail on a cold cache.

None of this makes the package work invalid. It makes it a scoped demonstration that two functions can be extracted, installed offline, and called — which is a real result. It is not evidence that any existing production project can consume the capability, and R09 is currently the only deep criterion that can score, which gives that single demonstration outsized weight in the 심화 metric.

---

## Suggested order of attack

1. B1 and B2 — the two outright false PASSes. R09 must re-run the packager or record an externally attested receipt; I04 must rehash on disk.
2. B4 and B5 — define a browser receipt schema with runner identity, version, target URL, and artifact hashes, and drop `--app`. Without this the target of 70 is unreachable by any honest route.
3. B3 — split the shared substring signals into per-criterion structured results (JSON per check ID, not stdout matching).
4. B6, B7, B8 — three small UI/report fixes that stop the page from overstating what the data says.
5. B12 — fix S02 before anyone tries to approve a card.

B9, B10, B11, B15 are correctness hardening; they do not currently produce a wrong number but they remove the guarantees the digest is supposed to provide.

I did not execute anything or modify any file.
