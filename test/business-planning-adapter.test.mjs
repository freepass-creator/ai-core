import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBusinessPlanningFrame, aiCoreBusinessPlanning } from '../src/engine/business-planning-adapter.mjs';

test('separates confirmed decisions, proposals and unknowns',()=>{
  const frame=buildBusinessPlanningFrame({
    objective:'구독사업 출시 준비 범위를 정리한다',
    facts:[{statement:'반환차량 한정',provenance:'USER_CONFIRMED'}],
    decisions:[
      {statement:'신차는 제외한다',status:'CONFIRMED',provenance:'USER_CONFIRMED'},
      {statement:'초기 월 10대를 검토한다',status:'PROPOSED',provenance:'AI_INFERRED'},
    ],
    unknowns:['보험 적용기준을 확정해야 하는가?'],
    constraints:['외부 발송 금지'],
    options:[{label:'보수적 파일럿',tradeoffs:['운영 위험이 낮다','학습 속도가 느릴 수 있다']}],
  });
  assert.equal(frame.decisions.confirmed.length,1);
  assert.equal(frame.decisions.proposed.length,1);
  assert.equal(frame.unknowns.length,1);
  assert.equal(frame.readiness.status,'NEEDS_DECISIONS');
  assert.equal(frame.invariants.recommendation_selected,false);
});

test('AI inferred decision cannot be marked CONFIRMED',()=>{
  assert.throws(()=>buildBusinessPlanningFrame({
    objective:'사업 방향',
    decisions:[{statement:'이 안으로 확정',status:'CONFIRMED',provenance:'AI_INFERRED'}],
  }),/AI_INFERRED_DECISION_CANNOT_BE_CONFIRMED/);
});

test('source-derived facts require a source reference',()=>{
  assert.throws(()=>buildBusinessPlanningFrame({
    objective:'사업 방향',
    facts:[{statement:'시장 자료상 수요 증가',provenance:'SOURCE_DERIVED'}],
  }),/SOURCE_DERIVED_FACT_REF_REQUIRED/);
});

test('blank declared unknown cannot disappear into READY_FOR_REVIEW',()=>{
  assert.throws(()=>buildBusinessPlanningFrame({
    objective:'사업 방향',
    unknowns:['   '],
  }),/BUSINESS_UNKNOWN_QUESTION_REQUIRED/);
});

test('adapter fails closed when objective is missing',async()=>{
  const result=await aiCoreBusinessPlanning({facts:[]});
  assert.equal(result.status,'HOLD');
  assert.deepEqual(result.blockers,['BUSINESS_OBJECTIVE_REQUIRED']);
  assert.equal(result.external_effect,false);
});

test('adapter returns a read-only planning frame with provenance evidence',async()=>{
  const result=await aiCoreBusinessPlanning({
    objective:'사업 준비상태를 정리한다',
    facts:[{statement:'체크리스트가 존재한다',provenance:'SOURCE_DERIVED',source_ref:'mewcar@abc:정본/03_체크리스트.md'}],
    decisions:[{statement:'외부 발송은 별도 승인',status:'CONFIRMED',provenance:'USER_CONFIRMED'}],
    unknowns:[],
  });
  assert.equal(result.status,'SUCCEEDED');
  assert.equal(result.data.readiness.status,'READY_FOR_REVIEW');
  assert.deepEqual(result.evidence,['SOURCE: mewcar@abc:정본/03_체크리스트.md']);
  assert.equal(result.external_effect,false);
});
