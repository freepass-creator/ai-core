import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyDocumentTask, documentExecutionRoute, documentVerificationPlan, documentWorkPacket } from '../src/document-domain.mjs';

test('proposal selects DocsHub proposal profile',()=>{
  assert.equal(classifyDocumentTask({goal:'신규 사업 제안서 만들어줘'}).template_id,'proposal');
});

test('contract selects contract profile',()=>{
  assert.equal(classifyDocumentTask({goal:'장기렌터카 전자계약서 작성'}).template_id,'contract');
});

test('simple one-page drafting stays GPT_DIRECT',()=>{
  assert.equal(documentExecutionRoute({goal:'회의 정리 문서',page_count_estimate:1}),'GPT_DIRECT');
});

test('multi-page PDF routes WORK_CODEX',()=>{
  assert.equal(documentExecutionRoute({goal:'보고서',needs_pdf:true,page_count_estimate:5}),'WORK_CODEX');
});

test('consequential external submission remains HUMAN_GATE',()=>{
  assert.equal(documentExecutionRoute({goal:'법원 제출 문서',risk:'D',external_effect:'legal_filing'}),'HUMAN_GATE');
});

test('rendered PDF requires layout pagination and pdf checks',()=>{
  const p=documentVerificationPlan({goal:'보고서',needs_pdf:true,page_count_estimate:5});
  assert.ok(p.checks.includes('pagination_check'));
  assert.ok(p.checks.includes('pdf_output_check'));
  assert.equal(p.content_pass_separate,true);
  assert.equal(p.layout_pass_separate,true);
});

test('legal document adds freshness and human review checks',()=>{
  const p=documentVerificationPlan({domain:'legal',legal_document:true});
  assert.ok(p.checks.includes('source_freshness_check'));
});

test('work packet never grants external authority',()=>{
  const p=documentWorkPacket({goal:'내부 업무 보고',project:'demo'});
  assert.equal(p.authorization,'NOT_GRANTED');
  assert.ok(p.invariants.includes('CONTENT_AND_LAYOUT_PASS_MUST_BE_SEPARATE'));
});
