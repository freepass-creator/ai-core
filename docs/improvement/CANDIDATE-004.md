# Candidate 004 — expose untargeted user burden before claiming benefit

2026-09-15. Status: REPRODUCED / SHARED_POLICY_COORDINATION_REQUIRED.
Read-only investigation requested by coordinator while Cycle003 integration runs.
Local base: `267028c5b79e423ff02ec0a57ddf33fb7c10ad88`.
PR22 observed head: `8dfa6413f96e8592dea4c851e97ad84b934158e5` (OPEN).
Fetched integration branch; its evaluator and SELF_EVOLUTION contract have no
diff against this lane. No code/test modifications were made for this candidate.

## Observation

The contract lists user corrections and rework together in evidence-vector item 4
and leaves incomparable results HOLD. The evaluator validates and compares these
metrics only when selected in candidate.target_metrics. It does not report an
untargeted correction count even when it worsens or is unobserved.

With target_metrics = [rework_loop_count], baseline rework 2 and trial rework 1:

| Baseline corrections | Trial corrections | Actual provisional finding |
|---|---|---|
| 1 | 1 | OUTCOME_BENEFIT_OBSERVED |
| 1 | 100 | OUTCOME_BENEFIT_OBSERVED |
| 1 | null | OUTCOME_BENEFIT_OBSERVED |

All three return HOLD_EXTERNAL_ATTESTATION_REQUIRED with only rework in
comparisons. auto_adopted and execution_authorized remain false. This is a
potentially misleading provisional benefit, **not** an observed authorization or
adoption bypass. These are synthetic diagnostics, not actual user outcomes.

## Reproduce without modifying data

Run the following JavaScript through `node --input-type=module` from the repo root:

```js
import { candidateDigest, evaluateSelfEvolution } from './scripts/evaluate-self-evolution.mjs';
const candidate = {
  candidate_id:'CHECK-004', source_episode_id:'BASE', baseline_episode_id:'BASE',
  trial_episode_id:'TRIAL', scope:'ai-core', confidence:0.5,
  cause_hypothesis:'synthetic diagnostic', before_behavior:'baseline', after_behavior:'trial',
  counterexample:'untargeted burden', executable_check:'node reproduction', rollback:'no mutation',
  expected_benefit:'less rework', possible_harm:'more corrections', current_state:'TRIAL_READY',
  candidate_revision:'diagnostic-only', registered_at:'2026-09-01T12:00:00Z',
  trial_started_at:'2026-09-02T00:00:00Z', target_metrics:['rework_loop_count'],
  non_application_conditions:['real adoption'], evidence_refs:['synthetic:diagnostic']
};
candidate.candidate_digest = candidateDigest(candidate);
const episode = (id, observedAt, corrections, rework) => ({
  episode_id:id, status:'CLOSED', project:{id:'ai-core'},
  intent:{requirement_set_digest:id+'-req'}, execution:{subject_revision:id+'-revision'},
  evidence_state:{proof_revision_matches_subject:true, independent_review:'CONFIRMED', failures:0,
    unresolved_p0:0, unresolved_p1:0, authority_violations:0, evidence_loss_events:0, user_control_violations:0},
  metrics:{false_completion_events:0, unverified_criteria_count:0, regression_events:0,
    acceptance_criteria_total:2, criteria_with_current_evidence:2,
    user_correction_count:corrections, rework_loop_count:rework},
  comparison:{key:'same-task', requirement_family_digest:'same-family', metric_schema_version:'1',
    observation_window:'same-window', observed_at:observedAt}, outcome:{observed:true, success:true}
});
const baseline = episode('BASE','2026-09-01T00:00:00Z',1,2);
for (const corrections of [1,100,null]) {
  const trial = episode('TRIAL','2026-09-03T00:00:00Z',corrections,1);
  console.log(corrections, evaluateSelfEvolution({candidate,baseline,trial}));
}
```

## Proposed scope and prerequisite

Reuse the common evaluator. Do not implement another improvement evaluator or
hide this in the JSONL transport. Required ownership: shared
`scripts/evaluate-self-evolution.mjs`, existing `test/evaluate-self-evolution.test.mjs`,
and `docs/SELF_EVOLUTION.md` only if the burden tradeoff rule needs clarification.

Coordinator must assign one writer and fix the intended semantics first: recommend
valid observations for both burden metrics, explicit comparison of both, and no
provisional benefit for missing observations or an unresolved burden tradeoff.
The current contract does not specify an exchange rate between corrections and
rework; do not invent one or silently prioritize one over the other. Exact HOLD
versus REJECTED status for an adverse tradeoff needs the common owner's decision.
This does not depend on durable mappings/outbox or production activation.

Validation after policy decision: reproduce both adverse/unknown examples, retain
the favorable control, swap target/non-target roles, and preserve external
attestation plus authority-false boundaries. Run the shared evaluator and JSONL
regressions, then the integrated suite/inventory through the integration owner.

Expected effect: less selective reporting of improvement. Measure on later real,
comparable episodes using both observed correction and rework counts plus existing
safety/outcome guards. Do not claim reduced workload from synthetic tests alone.
Risk: medium shared behavioral semantics; request independent policy review before
implementation adoption. Current evidence is source inspection plus reproduced
runtime output, not an independently reviewed policy change.
