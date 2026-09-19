# A Session — B Adoption Delta

상태: **ADOPTION_TRACKING / CLOSEOUT_HOLD / NOT_CANONICAL**

기준일: 2026-09-19 KST

## 목적

A가 B로 넘긴 UI/UX 후보가 B Phase 1 chain(#92 → #95 → #97 → #98)에 실제로 어느 수준까지 흡수됐는지 구분한다.

A는 최종 B canon을 선언하지 않는다.
이 문서는 **evidence candidate → B implementation → consumer adoption** 사이의 상태만 추적한다.

---

## 1. `ui.machine-conformance-gate`

A evidence:
- FP Settlement
- TeamJPKWork
- evidence level: `CROSS_PROJECT_VERIFIED`

### B chain observation

B2 includes:
- `scripts/validate-ui-ux-runtime.mjs`
- Design Token SSOT
- Feature Registry
- Component/Pattern/Interaction/Screen contracts
- consumer-conformance registry
- semantic validation that fails on contract/runtime inconsistency

B4 adds:
- revision-bound UI/UX conformance receipt
- per-feature PASS/FAIL/HOLD
- source SHA-256 / evidence refs
- exact product revision + AI Core revision + Feature Registry version binding

However:

`registry/ui-ux-consumers.json` currently records:
- required conformant consumers: 2
- current conformant consumers: 0

The inspected B runtime validator validates Core registries/runtime assets. It does not yet demonstrate the exact FP Settlement / TeamJPKWork mechanism class of recursively scanning arbitrary consumer implementation source/effective styles and hard-failing unapproved off-grid values.

### A classification

`CORE_MECHANISM_IMPLEMENTED_IN_B_CHAIN / CONSUMER_ADOPTION_NOT_PROVEN`

Do **not** mark COMMON_ADOPTED yet.

Next evidence required:
1. B chain merged to main;
2. at least one real consumer runs a revision-bound conformance path;
3. project implementation drift actually fails that path;
4. eventual two materially different CONFORMANT consumers per B policy.

---

## 2. `ui.client-release-freshness`

A evidence:
- FreePassERP3
- FreePassERP4
- evidence level: `CROSS_PROJECT_VERIFIED`

Generalized meaning:

`served release identity → running client identity → drift detection → safe update policy`

### B chain observation

No explicit B2 Feature Registry entry or contract was found for:
- client build stamp vs served build stamp
- long-lived stale client detection
- update available/reload policy
- dirty-form-aware client refresh

Search of current B2 Feature Registry found no release-freshness/build-stamp/reload/service-worker update contract.

### A classification

`NOT_YET_ADOPTED_BY_B`

This is **Phase 2 candidate**, not a Phase 1 blocker.

Recommended B follow-up after BASELINE_LOCKED:
- define feature/interaction contract for stale-running-client detection;
- separate detection from update UX;
- profiles for clean read-only / dirty form / critical incompatibility;
- bind release identity to C/Governance source if needed.

---

## 3. Reduced motion / zoom accessibility Backports

A project gaps:
- FreePass Homepage — reduced-motion missing
- TeamJPK Homepage — user zoom disabled + reduced-motion missing

### B chain observation

B1/B2 already includes:

- `system.motion-preference`
- reduced-motion as an explicit state/profile
- WCAG-oriented Accessibility Standard
- minimum verification:
  - keyboard-only
  - 200% zoom
  - 400% reflow
  - reduced motion
  - forced colors/high contrast
- staged migration procedure

### A classification

`B_STANDARD_PRESENT_IN_CANDIDATE_CHAIN / PROJECT_BACKPORT_READY_AFTER_B_MAIN`

Once B is canonical on main:
- FreePass Homepage backport can target the canonical B accessibility contract.
- TeamJPK zoom/motion backport can target the same canonical B accessibility contract.
- No new B standard is needed for these two gaps.

---

## 4. B closeout impact

A found **no new Phase 1 blocker** in this adoption comparison.

Current interpretation:

- B already has enough machine assets to support Phase 1 executable baseline.
- `ui.machine-conformance-gate` has a strong implementation analogue but lacks real consumer conformance completion.
- `ui.client-release-freshness` is correctly deferrable to Phase 2.
- accessibility backports are project migrations, not blockers for B canon.

Therefore A's position remains:

**do not delay B Phase 1 merge solely to absorb every A UI candidate.**

The closeout criterion is a usable common baseline, not exhaustion of all Phase 2 improvements.
