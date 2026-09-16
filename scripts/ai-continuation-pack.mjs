import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const need = (ok, code) => { if (!ok) throw new Error(code); };
const text = (value, code, max = 2000) => { need(typeof value === 'string' && value.trim() && value.length <= max, code); return value.trim(); };
const list = (value, code, max = 30) => { need(Array.isArray(value) && value.length <= max, code); return value.map(v => text(v, code)); };
const iso = value => { const v = text(value, 'TIME_REQUIRED', 50); need(Number.isFinite(Date.parse(v)), 'TIME_INVALID'); return new Date(v).toISOString(); };
const identifier = (value, prefix) => value === null || (typeof value === 'string' && new RegExp(`^${prefix}-[A-Za-z0-9_-]+$`).test(value));
const digest = value => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const forbidden = [
  ['EMAIL', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
  ['PHONE', /(?<![A-Za-z0-9])(?:\+?82[- .]?)?0\d{1,2}[- .]?\d{3,4}[- .]?\d{4}(?![A-Za-z0-9])/],
  ['LOCAL_PATH', /(?:\b[A-Za-z]:[\\/]|\\\\[^\\\s]+\\|(?:^|\s)\/(?:Users|home|var|etc|tmp)\/)/m],
  ['SECRET', /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key|authorization|password|passwd|secret)\s*[:=]/i],
  ['BEARER', /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/i],
];
export function assertPublicSafe(value) {
  const body = JSON.stringify(value);
  for (const [code, pattern] of forbidden) need(!pattern.test(body), `SENSITIVE_${code}`);
  return value;
}
const ref = value => {
  const v = text(value, 'REFERENCE_INVALID', 500);
  need(!/[?#]/.test(v), 'REFERENCE_QUERY_DENIED');
  need(/^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+(?::[1-9]\d*)?$/.test(v)
    || /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/(?:commit|pull|actions\/runs)\/[A-Za-z0-9_.-]+$/.test(v), 'REFERENCE_INVALID');
  return v;
};
const bullets = values => values.length ? values.map(v => `- ${v.replaceAll('\n', ' ')}`).join('\n') : '- 없음';

export function buildContinuationPack(input) {
  need(input?.schema === 'ai-core-continuation-input/v1', 'SCHEMA_INVALID');
  need(identifier(input.order_id, 'ORD') && identifier(input.work_id, 'WORK'), 'TARGET_ID_INVALID');
  const value = {
    generated_at: iso(input.generated_at), source_ref: text(input.source_ref, 'SOURCE_REF_REQUIRED', 300),
    order_id: input.order_id, work_id: input.work_id, status: text(input.status, 'STATUS_REQUIRED', 100),
    purpose: text(input.purpose, 'PURPOSE_REQUIRED'), decisions: list(input.decisions, 'DECISION_INVALID'),
    corrections: list(input.corrections, 'CORRECTION_INVALID'), completed: list(input.completed, 'COMPLETED_INVALID'),
    remaining: list(input.remaining, 'REMAINING_INVALID'), verification: list(input.verification, 'VERIFICATION_INVALID'),
    evidence_refs: list(input.evidence_refs, 'REFERENCE_INVALID').map(ref),
  };
  assertPublicSafe(value);
  const target = `order=${value.order_id ?? 'UNVERIFIED'}, work=${value.work_id ?? 'UNVERIFIED'}`;
  const handoffDigest = digest(JSON.stringify(value));
  const returnExample = { schema: 'ai-core-ai-proposal/v1', source_ai: 'chatgpt-free', generated_at: value.generated_at,
    captured_at: value.generated_at, target_order_id: value.order_id, target_work_id: value.work_id ?? 'WORK-UNVERIFIED', handoff_digest: handoffDigest,
    proposal_summary: 'Replace with a short proposal summary', proposed_changes: ['Replace with proposed files or actions; nothing has been executed'], evidence_refs: value.evidence_refs };
  const body = `# AI Core emergency handoff\n\n`+
    `> Read-only context for advice or draft work. This pack grants no claim, execution, completion, deployment or sending authority. Verify current canonical state before any action.\n\n`+
    `- Generated: ${value.generated_at}\n- Source: ${value.source_ref}\n- Target: ${target}\n- Status: ${value.status}\n- Purpose: ${value.purpose}\n- Handoff digest: ${handoffDigest}\n\n`+
    `## Your role\n\nHelp the user analyze, decide, draft, check or propose a patch using only this file. Ask one short question only when a missing choice materially changes the answer. Do not imply repository access or execution.\n\n`+
    `## Current selected work\n\n${value.purpose}\n\n`+
    `## Decisions\n\n${bullets(value.decisions)}\n\n## Corrections\n\n${bullets(value.corrections)}\n\n`+
    `## Completed\n\n${bullets(value.completed)}\n\n## Remaining\n\n${bullets(value.remaining)}\n\n`+
    `## Verification\n\n${bullets(value.verification)}\n\n## Evidence pointers\n\n${bullets(value.evidence_refs)}\n\n`+
    `## You may / may not\n\nYou may analyze, draft prose/checklists, propose a code patch and recommend next actions. You cannot read a private repository from its URL, access local files, run tests, commit/push, deploy, send or change live data.\n\n`+
    `## Return packet\n\nExplain scope, assumptions, proposed files/changes, tests not run and risks. End with exactly one JSON block based on this shape; keep PROPOSAL_ONLY and do not claim approval or execution.\n\n`+
    `\`\`\`json\n${JSON.stringify(returnExample, null, 2)}\n\`\`\`\n\n`+
    `Start sentence for the user: 이 인계파일 기준으로 현재 선택 업무를 이어서 분석하고 필요한 초안이나 패치 제안을 만들어줘. 결과는 RETURN_PACKET 형식으로 줘.\n\n`+
    `End sentence for the user: 지금 답변을 RETURN_PACKET.md 한 파일로 정리하고, 실행·테스트·커밋하지 않은 항목과 위험을 분명히 표시해줘.\n`;
  assertPublicSafe(body); return { markdown: body, digest: handoffDigest };
}

export function buildProposalRecord(input) {
  need(input?.schema === 'ai-core-ai-proposal/v1', 'SCHEMA_INVALID');
  need(['claude-code', 'chatgpt-free', 'gemini', 'cursor', 'other'].includes(input.source_ai), 'SOURCE_AI_INVALID');
  need(identifier(input.target_order_id, 'ORD') && typeof input.target_work_id === 'string' && /^WORK-[A-Za-z0-9_-]+$/.test(input.target_work_id), 'TARGET_ID_INVALID');
  need(/^sha256:[a-f0-9]{64}$/.test(input.handoff_digest ?? ''), 'HANDOFF_DIGEST_INVALID');
  const record = { schema: 'ai-core-proposal-record/v1', status: 'PROPOSAL_ONLY', source_ai: input.source_ai,
    generated_at: iso(input.generated_at), captured_at: iso(input.captured_at), target_order_id: input.target_order_id,
    target_work_id: input.target_work_id, handoff_digest: input.handoff_digest,
    proposal_summary: text(input.proposal_summary, 'SUMMARY_REQUIRED'), proposed_changes: list(input.proposed_changes, 'CHANGE_INVALID'),
    evidence_refs: list(input.evidence_refs, 'REFERENCE_INVALID').map(ref), authority: { claim: false, execute: false, complete: false, deploy: false, send: false } };
  assertPublicSafe(record); return record;
}

export function proposalFromMarkdown(markdown) {
  const value = text(markdown, 'RETURN_PACKET_REQUIRED', 30000);
  const blocks = [...value.matchAll(/```json\s*([\s\S]*?)```/g)];
  need(blocks.length === 1, 'RETURN_PACKET_JSON_REQUIRED');
  let input; try { input = JSON.parse(blocks[0][1]); } catch { throw new Error('RETURN_PACKET_JSON_INVALID'); }
  return buildProposalRecord(input);
}

async function main([mode, inputPath, outputPath]) {
  need(['export', 'recover'].includes(mode) && inputPath && outputPath, 'USAGE');
  const raw = (await readFile(resolve(inputPath), 'utf8')).replace(/^\uFEFF/, '');
  const input = mode === 'recover' && inputPath.toLowerCase().endsWith('.md') ? null : JSON.parse(raw);
  const output = mode === 'export' ? buildContinuationPack(input).markdown
    : `${JSON.stringify(input ? buildProposalRecord(input) : proposalFromMarkdown(raw), null, 2)}\n`;
  await writeFile(resolve(outputPath), output, { flag: 'wx' });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
