import test from 'node:test';
import assert from 'node:assert/strict';
import {compileDesignJob,makeQualityDraft,validateDesignJob} from '../scripts/design-compiler.mjs';

const binding={
  ai_core:{repository:'freepass-creator/ai-core',revision:'1111111111111111111111111111111111111111'},
  sources:{
    feature_registry:{version:'1.3.0'},
    tokens:{version:'1.1.0'},
    components:{version:'1.0.0'},
    patterns:{version:'1.1.0'},
    runtime_css:{path:'design-system/runtime-v2.css'},
    entrypoint:{path:'registry/ui-ux-entrypoint.json',version:'1.0.0'},
    freepass_product_profile:{path:'docs/FREEPASS_PRODUCT_UI_PROFILE.md'},
    start_here:{path:'docs/UI_UX_START_HERE.md'}
  }
};

const coreBundle={
  featureRegistry:{features:[
    {id:'navigation.header',kind:'surface',profiles:['RESPONSIVE'],required_states:['default'],verification:['mobile-desktop']},
    {id:'data.table',kind:'surface',profiles:['DATA_SURFACE'],required_states:['loading','empty','error','populated'],verification:['loading','empty','error','populated']},
    {id:'workflow.submit',kind:'workflow',profiles:['ASYNC_WRITE'],required_states:['idle','submitting','success','error'],verification:['failure-path']}
  ]},
  tokens:{},
  components:{components:[]},
  patterns:{patterns:[
    {feature_id:'navigation.header',implementation_status:'RUNTIME_V2',css_selector:'.ui-header',layer:'surface'},
    {feature_id:'data.table',implementation_status:'RUNTIME_V2',css_selector:'.ui-table',layer:'surface'},
    {feature_id:'workflow.submit',implementation_status:'CONTRACT_ONLY',layer:'workflow'}
  ]}
};

const baseJob={
  contract:'devcenter-design-job/v1',
  target:{project_id:'freepass-admin',repository:'freepass-creator/freepass-admin',revision:'2222222222222222222222222222222222222222'},
  surface:{id:'applications-list',kind:'ERP',viewports:[390,1440]},
  product_profile:{brand_profile_ref:'freepass-admin/.ai-core/ui-profile.json',ui_profile_ref:'FREEPASS',density:'COMPACT',locale:'ko-KR',direction:'LTR'},
  feature_ids:['navigation.header','data.table'],
  composition:[
    {id:'header',role:'HEADER',feature_id:'navigation.header',order:0},
    {id:'table',role:'DATA',feature_id:'data.table',order:1}
  ],
  approved_design_refs:[],
  quality:{require_runtime_implementation:true,require_visual_receipt:true}
};

test('valid design job compiles feature states and QA probes',()=>{
  assert.deepEqual(validateDesignJob(baseJob),[]);
  const plan=compileDesignJob(baseJob,{binding,coreBundle});
  assert.equal(plan.result.status,'COMPILED');
  assert.deepEqual(plan.qa.viewports,[390,1440]);
  assert.ok(plan.qa.probes.includes('loading'));
  assert.equal(plan.composition[1].runtime.css_selector,'.ui-table');
});

test('FreePass design job must bind the FreePass UI profile',()=>{
  const job=structuredClone(baseJob);
  job.product_profile.ui_profile_ref='GENERIC';
  assert.ok(validateDesignJob(job).includes('DESIGN_JOB_FREEPASS_UI_PROFILE_REQUIRED'));
});

test('missing UI product profile fails before design compilation',()=>{
  const job=structuredClone(baseJob);
  delete job.product_profile.ui_profile_ref;
  const errors=validateDesignJob(job);
  assert.ok(errors.includes('DESIGN_JOB_UI_PROFILE_REF_REQUIRED'));
  assert.ok(errors.includes('DESIGN_JOB_FREEPASS_UI_PROFILE_REQUIRED'));
});

test('unknown feature fails closed',()=>{
  const job=structuredClone(baseJob);
  job.feature_ids.push('made.up-feature');
  const plan=compileDesignJob(job,{binding,coreBundle});
  assert.equal(plan.status,'FAIL');
  assert.ok(plan.errors[0].includes('DESIGN_FEATURE_UNKNOWN'));
});

test('contract-only runtime becomes HOLD when executable mapping is required',()=>{
  const job=structuredClone(baseJob);
  job.feature_ids.push('workflow.submit');
  job.composition.push({id:'submit',role:'ACTION',feature_id:'workflow.submit',order:2});
  const plan=compileDesignJob(job,{binding,coreBundle});
  assert.equal(plan.result.status,'HOLD');
  assert.ok(plan.result.blocking_reasons.some((x)=>x.includes('workflow.submit')));
});

test('inline token copies are forbidden',()=>{
  const job={...structuredClone(baseJob),token_values:{primary:'#fff'}};
  assert.ok(validateDesignJob(job).includes('DESIGN_JOB_INLINE_TOKEN_VALUES_FORBIDDEN'));
});

test('quality draft keeps visual QA as HOLD until browser evidence exists',()=>{
  const plan=compileDesignJob(baseJob,{binding,coreBundle});
  const draft=makeQualityDraft(plan,{startedAt:'2026-09-21T00:00:00.000Z',finishedAt:'2026-09-21T00:01:00.000Z'});
  const visual=draft.checks.find((x)=>x.id==='DESIGN.VISUAL_QA');
  assert.equal(visual.status,'HOLD');
  assert.ok(visual.remediation);
});
