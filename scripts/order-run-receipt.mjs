import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RemoteOrderClient, connectionOptions, readConnectionPolicy } from '../src/orders/client.mjs';

export async function recordRun({ client, orderId, taskId, repository, commit, runId, attempt, checkStatus, recordResult = false, commandFile }) {
  if (!/^ORD-[a-f0-9-]{36}$/.test(orderId ?? '') || !/^T[1-9]\d*$/.test(taskId ?? '')) throw new Error('Invalid order or task identifier');
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(repository ?? '') || !/^[a-f0-9]{40}$/.test(commit ?? '') || !/^\d+$/.test(runId ?? '') || !/^\d+$/.test(attempt ?? '')) throw new Error('Invalid GitHub execution reference');
  if (!['success', 'failure', 'cancelled', 'skipped'].includes(checkStatus)) throw new Error('Invalid check status');
  const context = await client.checkContext(orderId, taskId);
  const canonicalProject = readConnectionPolicy().projectRepositories?.[context.project] ?? context.project;
  if (canonicalProject !== repository) throw new Error('Order project does not match the checked repository');
  const runUrl = `https://github.com/${repository}/actions/runs/${runId}`;
  const receipt = { schema: 'ai-core-github-check/v1', ledgerId: client.ledgerId, orderId, taskId, repository, commit, runUrl, attempt, checkStatus, observedRequirementRevision: context.requirementRevision, checkedRequirementRevision: null, purpose: 'REPOSITORY_CHECK_REFERENCE_ONLY', orderCompleted: false, recorded: false };
  if (recordResult) {
    if (!commandFile) throw new Error('A durable command file is required for write retries');
    let command = { requestId: `github-check:${runId}:${attempt}:${orderId}:${taskId}`, version: context.version, action: 'note', note: `GitHub 저장소 검사 참고기록 · ${taskId} · ${repository}@${commit} · ${checkStatus} · ${runUrl} · 오더별 완료 조건 검증이나 완료 처리가 아닙니다.` };
    if (existsSync(commandFile)) {
      const saved = JSON.parse(readFileSync(commandFile, 'utf8'));
      if (saved.requestId !== command.requestId || saved.note !== command.note || saved.action !== 'note') throw new Error('Existing retry command belongs to another execution');
      command = saved;
    } else { mkdirSync(dirname(commandFile), { recursive: true }); writeFileSync(commandFile, JSON.stringify(command, null, 2), { flag: 'wx' }); }
    await client.mutate(orderId, command);
    receipt.recorded = true;
  }
  return receipt;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const folder = resolve('.local/github-receipt'); mkdirSync(folder, { recursive: true });
  try {
    const env = process.env;
    if (!['true', 'false'].includes(env.AI_CORE_RECORD_RESULT ?? 'false')) throw new Error('Invalid record flag');
    const receipt = await recordRun({ client: new RemoteOrderClient(connectionOptions()), orderId: env.AI_CORE_ORDER_ID, taskId: env.AI_CORE_TASK_ID, repository: env.GITHUB_REPOSITORY, commit: env.GITHUB_SHA, runId: env.GITHUB_RUN_ID, attempt: env.GITHUB_RUN_ATTEMPT, checkStatus: env.AI_CORE_CHECK_STATUS, recordResult: env.AI_CORE_RECORD_RESULT === 'true', commandFile: resolve(folder, 'retry-command.json') });
    writeFileSync(resolve(folder, 'receipt.json'), JSON.stringify(receipt, null, 2));
    console.log(JSON.stringify(receipt, null, 2));
  } catch (e) { console.error(JSON.stringify({ error: e.code ?? 'RECEIPT_FAILED', message: e.message, executionComplete: false, retryCommand: '.local/github-receipt/retry-command.json' })); process.exitCode = 1; }
}
