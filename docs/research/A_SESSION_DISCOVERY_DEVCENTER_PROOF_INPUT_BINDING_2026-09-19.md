# A Session Discovery — DevCenter Proof Input Digest Binding

상태: **PROJECT_VERIFIED / ROUTED_TO_C / NOT_CANONICAL**

발견일: 2026-09-19 KST

## Discovery

- Project: DevCenter
- Repository: `freepass-creator/devcenter`
- Source path:
  - `scripts/verify-acceptance.mjs`
  - `scripts/card-audit.mjs`
  - `quality/COMPLETION.md`
  - `quality/INSPECTION-CONTROL.md`
- Revision:
  - observed repository head: `6a838a28b3c25b068e5bbe010071fd1de0242d30`
  - relevant implementation blobs:
    - `scripts/verify-acceptance.mjs@6178e5fa136a867cb0b4ad8709301e1b09fd8921`
    - `scripts/card-audit.mjs@59b61085c2ad424240283314e6f5dd080a42d77a`
- Category: Result / Receipt / Evidence / Verification
- Current implementation:
  - verification computes a digest over source inputs and verification implementation.
  - it snapshots that input set before and after the verification run and fails if the set changes during verification.
  - stored evidence is considered current only when:
    - prior run was stable,
    - catalog/source hashes still match,
    - verification implementation inputs still match,
    - required suites actually passed.
  - regression explicitly verifies that changing original bytes invalidates prior evidence **and** changing the test implementation invalidates prior evidence.
  - UNVERIFIED/HOLD are not removed from the denominator or silently counted as PASS.
- AI Core equivalent:
  - AI Core already has the stronger architectural rule that proof is revision-bound and becomes stale when source/requirement/target revision changes.
  - `ai-core-work-result/v1` currently carries `subject_revision`, evidence refs and checks.
  - `execution-receipt.mjs` validates terminal receipt creation/state, but the common result/receipt contract does not yet bind proof to a digest of the verification inputs/test implementation.
- Gap:
  - AI Core has the policy, DevCenter has a more concrete executable mechanism for **proof-input binding**.
  - a PASS can become semantically stale even when the subject revision is unchanged if the checker/fixture/policy implementation that produced the PASS changed.
- Project ahead / Core ahead / Different:
  - **Project > Core on executable proof-input/test-implementation binding.**
  - **Core > Project on broader revision/authority architecture.**
  - Net classification: `Different` with a reverse-import candidate for C.
- Evidence:
  - `verify-acceptance.mjs` records `sourceDigest: before`, `stable: before===after`, and fails on instability.
  - S04 verifies source-byte change invalidation.
  - S05 verifies test-implementation change invalidation.
  - `card-audit.mjs` stores exact input paths+SHA256 and only treats evidence as current when the current input digest matches.
- Generalizable: Yes
  - Generalize:
    1. subject revision
    2. requirement/policy revision
    3. verification-input digest
    4. checker/fixture version or digest
    5. environment/target
    6. stable-before-after flag where verification can race with source edits
- Destination:
  - C — Result / Receipt / Evidence contract
- Recommended action:
  - C should evaluate adding a proof-input binding object to result/receipt evidence rather than only free-form evidence refs.
  - exact field names and mandatory scope remain C owner decisions.
  - do not copy DevCenter's local file list or acceptance denominator into a universal contract.
- Migration impact:
  - additive for new receipts.
  - historical proofs without a verification-input digest remain valid only for their declared legacy scope; do not retroactively fabricate hashes.
- Status: `PROJECT_VERIFIED / SECOND_PROJECT_REQUIRED`

## Reverse Import Pipeline

Discover → DONE
Evidence → DONE
Compare → DONE
Extract Pattern → DONE
Generalize → DONE
Assign B/C/D → DONE (C)
Create Core Candidate → DONE (`result.proof-input-digest-binding`)
Core adoption 확인 → PENDING
Source revision 기록 → DONE
완료 → PENDING
