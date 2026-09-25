# AI Core Contracts v0.1

## Task Envelope
`task_id, goal, domain, project, intent, risk, authority_required, freshness_required, done_when, out_of_scope`

## Source Pointer
`owner_system, location, revision_or_sha, scope, status(authoritative/reference/candidate/blocked), checked_at`

## Context Packet
`task_id, source_pointers, known_facts, claims, uncertainties, conflicts, relevant_failures, omitted_context_reason`

## Capability Reference
`capability_id, devcenter_pointer, version_or_sha, status, applicability, known_limits, verification_entrypoint`

## Work Packet
`task_id, source_revision_set, capability_revision_set, allowed_changes, forbidden_changes, roles, checks, rollback_or_recovery, approval_gate`

## Evidence Packet
`task_id, subject_revision, check_definition_revision, executed_checks, failures, skips, reviewers, evidence_pointers, valid_until_change_of`

## Outcome Record
`task_id, expected_outcome, observed_outcome, measurement_source, observed_at, side_effects, confidence_basis`

## Learning Candidate
`candidate_id, derived_from_task_ids, target_owner(aiops/devcenter/ai-core), type, proposal, evidence_pointers, counterexamples, scope, status, next_validation`

## 불변조건
1. Source Pointer 없는 사실은 Core 장기 지식으로 승격하지 않는다.
2. 현재 subject revision과 맞지 않는 Evidence Packet은 STALE이다.
3. 필수 검증 skip이 있으면 VERIFIED로 승격하지 않는다.
4. 승인 요구 작업은 gate 충족 전 EXECUTED로 가지 않는다.
5. Outcome 없는 가설을 실무 성과로 표현하지 않는다.
