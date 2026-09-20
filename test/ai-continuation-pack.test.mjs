import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildContinuationPack, buildProposalRecord, proposalFromMarkdown } from '../scripts/ai-continuation-pack.mjs';

const input = { schema: 'ai-core-continuation-input/v1', generated_at: '2026-09-15T09:00:00Z', source_ref: 'task:01-message:02',
  order_id: 'ORD-demo_001', work_id: 'WORK-demo_001', status: 'HOLD', purpose: 'Review the next bounded change',
  decisions: ['Use the existing ledger'], corrections: ['Production is not connected'], completed: ['Synthetic tests passed'],
  remaining: ['Review the proposed change'], verification: ['290 tests passed at the cited checkpoint'],
  evidence_refs: ['docs/integration/INTEGRATION_STATUS.md', 'https://github.com/freepass-creator/ai-core/commit/0577201c4e639be607c49512465c784cb454f001'] };

test('exports a deterministic human-readable pack with no authority', () => {
  const a = buildContinuationPack(input), b = buildContinuationPack(structuredClone(input));
  assert.equal(a.digest, b.digest); assert.match(a.markdown, new RegExp(a.digest)); assert.match(a.markdown, /PROPOSAL_ONLY/); assert.match(a.markdown, /grants no claim/);
  assert.match(a.markdown, /## Your role/); assert.match(a.markdown, /## You may \/ may not/); assert.match(a.markdown, /```json/);
  assert.doesNotMatch(a.markdown, /execution_authorized.*true/);
});
test('rejects common sensitive values and unsafe evidence references', () => {
  for (const source_ref of ['person@example.com', '010-1234-5678', 'C:\\secret\\file.txt', 'api_key=secret', 'password=hunter2'])
    assert.throws(() => buildContinuationPack({ ...input, source_ref }), /SENSITIVE_/);
  assert.throws(() => buildContinuationPack({ ...input, evidence_refs: ['https://github.com/o/r/commit/abc?token=x'] }), /REFERENCE_QUERY_DENIED/);
});
test('normalizes returned work as an immutable proposal record', () => {
  const record = buildProposalRecord({ schema: 'ai-core-ai-proposal/v1', source_ai: 'chatgpt-free', generated_at: '2026-09-15T09:01:00Z',
    captured_at: '2026-09-15T09:02:00Z', target_order_id: input.order_id, target_work_id: input.work_id,
    handoff_digest: 'sha256:' + 'a'.repeat(64), proposal_summary: 'Add a bounded test', proposed_changes: ['Review before applying'], evidence_refs: ['test/ai-continuation-pack.test.mjs'] });
  assert.equal(record.status, 'PROPOSAL_ONLY'); assert.deepEqual(Object.values(record.authority), [false, false, false, false, false]);
});
test('rejects proposals without a work target, digest, or with sensitive text', () => {
  const base = { schema: 'ai-core-ai-proposal/v1', source_ai: 'claude-code', generated_at: '2026-09-15T09:01:00Z', captured_at: '2026-09-15T09:02:00Z',
    target_order_id: null, target_work_id: 'WORK-demo', handoff_digest: 'sha256:' + 'b'.repeat(64), proposal_summary: 'Review', proposed_changes: [], evidence_refs: [] };
  assert.throws(() => buildProposalRecord({ ...base, target_work_id: null }), /TARGET_ID_INVALID/);
  assert.throws(() => buildProposalRecord({ ...base, handoff_digest: 'bad' }), /HANDOFF_DIGEST_INVALID/);
  assert.throws(() => buildProposalRecord({ ...base, proposal_summary: 'contact person@example.com' }), /SENSITIVE_EMAIL/);
});
test('recovers exactly one JSON return packet from a Markdown file', () => {
  const packet = { schema: 'ai-core-ai-proposal/v1', source_ai: 'chatgpt-free', generated_at: '2026-09-15T09:01:00Z', captured_at: '2026-09-15T09:02:00Z',
    target_order_id: null, target_work_id: 'WORK-demo', handoff_digest: 'sha256:' + 'c'.repeat(64), proposal_summary: 'Draft only', proposed_changes: [], evidence_refs: [] };
  assert.equal(proposalFromMarkdown(`# RETURN_PACKET\n\n\`\`\`json\n${JSON.stringify(packet)}\n\`\`\``).status, 'PROPOSAL_ONLY');
  assert.throws(() => proposalFromMarkdown('# no packet'), /RETURN_PACKET_JSON_REQUIRED/);
});
test('emergency handoff is self-contained for a chat without repository context', async () => {
  const markdown = await readFile(new URL('../docs/coordination/EMERGENCY_HANDOFF.md', import.meta.url), 'utf8');
  for (const required of ['## Your role', '## Current selected work', '## You may / may not', '## Return packet', 'Start sentence for the user', 'End sentence for the user', 'PROPOSAL_ONLY', 'order=UNVERIFIED, work=UNVERIFIED']) assert.ok(markdown.includes(required), required);
  assert.doesNotMatch(markdown, /\b[A-Z]:[\\/]|\\\\[^\\\s]+\\/);
  assert.doesNotMatch(markdown, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
});
test('Claude entrypoint delegates to the two canonical conversation entrypoints', async () => {
  const markdown = await readFile(new URL('../CLAUDE.md', import.meta.url), 'utf8');
  for (const required of ['docs/coordination/AI_CONTINUATION.md', 'WORK_READ_FIRST.md',
    'Do not keep a separate Claude task list or session ledger', 'same designated conversation', 'HOLD']) assert.ok(markdown.includes(required), required);
  assert.doesNotMatch(markdown, /codex\/order-control-integration|1575f467b5356fe351d877da4b561cdc67af9175|PR22/);
  assert.doesNotMatch(markdown, /execution_authorized\s*[:=]\s*true/i);
});
