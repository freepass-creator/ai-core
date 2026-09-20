import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import { buildFactEvidence, evidenceKindSatisfies, isDirectObservation } from '../src/contracts/fact-evidence.mjs';

const types=JSON.parse(await readFile(new URL('../contracts/core-types.schema.json',import.meta.url),'utf8'));
const fact=JSON.parse(await readFile(new URL('../contracts/core-fact-evidence.schema.json',import.meta.url),'utf8'));
const ajv=new Ajv2020({allErrors:true,strict:false}); addFormats(ajv); ajv.addSchema(types); ajv.addSchema(fact);
const validate=ajv.getSchema('https://schemas.freepass.ai/core/fact-evidence/v1');

test('inferred fact requires explicit inference provenance',()=>{
  const evidence=buildFactEvidence({
    assertion_id:'fact_001',fact_id:'sales.quote-presented',subject:{type:'lead',id:'lead_1',revision:'r7'},
    assertion_kind:'INFERRED',value_digest:'sha256:'+'a'.repeat(64),asserted_at:'2026-09-20T02:00:00Z',
    basis_refs:['workflow:transition/1'],verification_state:'VERIFIED',
    inference:{rule_ref:'D:freepass-sales.quote-presented-before-progress-agreement',basis_fact_refs:['fact:sales.proceeding-agreed/1']}
  });
  assert.equal(validate(evidence),true,JSON.stringify(validate.errors));
  assert.equal(isDirectObservation(evidence),false);
});

test('inferred evidence cannot satisfy a direct-observation requirement',()=>{
  const inferred={assertion_kind:'INFERRED'};
  assert.equal(evidenceKindSatisfies(inferred,['OBSERVED']),false);
  assert.equal(evidenceKindSatisfies(inferred,['INFERRED','OBSERVED']),true);
});

test('observed fact forbids inference payload',()=>{
  const invalid={
    schema_version:'core-fact-evidence/v1',assertion_id:'fact_002',fact_id:'sales.quote-sent',
    subject:{type:'lead',id:'lead_1',revision:'r7'},assertion_kind:'OBSERVED',value_digest:'sha256:'+'b'.repeat(64),
    asserted_at:'2026-09-20T02:00:00Z',basis_refs:['message:quote/1'],verification_state:'VERIFIED',
    inference:{rule_ref:'x',basis_fact_refs:['y']}
  };
  assert.equal(validate(invalid),false);
});

test('builder rejects inferred fact without rule and basis facts',()=>{
  assert.throws(()=>buildFactEvidence({
    assertion_id:'fact_003',fact_id:'sales.quote-presented',subject:{type:'lead',id:'lead_1'},
    assertion_kind:'INFERRED',value_digest:'sha256:'+'c'.repeat(64),asserted_at:'2026-09-20T02:00:00Z',basis_refs:['workflow:1']
  }),/FACT_EVIDENCE_INFERENCE_REQUIRED/);
});
