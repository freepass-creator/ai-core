import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import {
  claudeReviewInvocation,
  claudeRunOutcome,
  gateStatus,
  parseClaudeResetAt,
} from '../src/collaboration/claude-usage-gate.mjs';

const statePath = process.env.AI_CORE_CLAUDE_GATE_STATE
  ?? join(homedir(), '.codex', 'state', 'claude-usage-gate.json');
const reviewTimeoutMs = 5 * 60 * 1000;

async function readState() {
  try { return JSON.parse(await readFile(statePath, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function saveState(state) {
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

const [command = 'status', ...args] = process.argv.slice(2);
const now = new Date();

if (command === 'status') {
  const result = gateStatus(await readState(), now);
  console.log(JSON.stringify({ schema: 'ai-core-claude-usage-gate/v1', ...result, state_path: statePath }, null, 2));
  process.exitCode = result.available ? 0 : 3;
} else if (command === 'clear') {
  await rm(statePath, { force: true });
  console.log(JSON.stringify({ schema: 'ai-core-claude-usage-gate/v1', status: 'CLEARED', state_path: statePath }, null, 2));
} else if (command === 'run') {
  const current = gateStatus(await readState(), now);
  if (!current.available) {
    console.log(JSON.stringify({ schema: 'ai-core-claude-usage-gate/v1', ...current, action: 'SKIP_CLAUDE_AND_DO_NOT_ASK_USER' }, null, 2));
    process.exitCode = 3;
  } else {
    const separator = args.indexOf('--');
    const requestedArgs = separator >= 0 ? args.slice(separator + 1) : args;
    let invocation;
    try {
      invocation = claudeReviewInvocation(requestedArgs);
    } catch (error) {
      console.error(JSON.stringify({ status: 'FAILED', reason: error.message }));
      process.exitCode = 2;
      invocation = null;
    }
    if (!invocation) process.exit(2);
    const result = spawnSync('claude', invocation.args, {
      cwd: invocation.cwd,
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
      timeout: reviewTimeoutMs,
      killSignal: 'SIGTERM',
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    const outcome = claudeRunOutcome(result);
    if (outcome.status === 'USAGE_LIMIT') {
      const blockedUntil = parseClaudeResetAt(outcome.combined, { now });
      if (blockedUntil) {
        await saveState({ schema: 'ai-core-claude-usage-gate-state/v1', reason: 'CLAUDE_USAGE_LIMIT', observed_at: now.toISOString(), blocked_until: blockedUntil });
        console.log(JSON.stringify({ status: 'UNAVAILABLE_UNTIL_RESET', blocked_until: blockedUntil, action: 'SKIP_CLAUDE_AND_DO_NOT_ASK_USER' }));
      } else {
        console.log(JSON.stringify({ status: 'UNAVAILABLE_RESET_UNKNOWN', action: 'DO_NOT_REPEAT_DURING_CURRENT_TASK' }));
      }
    } else if (outcome.status === 'EMPTY_RESPONSE') {
      console.error(JSON.stringify({ status: 'FAILED', reason: 'CLAUDE_EMPTY_RESPONSE' }));
    } else if (outcome.status === 'REVIEW_TIMEOUT') {
      console.error(JSON.stringify({ status: 'REVIEW_TIMEOUT', timeout_ms: reviewTimeoutMs, root: invocation.cwd, action: 'RETRY_WITH_NARROWER_SCOPE' }));
    } else if (outcome.status === 'FAILED') {
      console.error(JSON.stringify({ status: 'FAILED', reason: 'CLAUDE_PROCESS_FAILED', exit_code: result.status, signal: result.signal ?? null }));
    } else if (outcome.status === 'ANSWERED') {
      console.log(JSON.stringify({ status: 'ANSWERED', root: invocation.cwd, exit_code: 0 }));
    }
    process.exitCode = outcome.status === 'ANSWERED' ? 0 : outcome.status === 'REVIEW_TIMEOUT' ? 4 : (result.status || 1);
  }
} else {
  console.error('Usage: node scripts/claude-usage-gate.mjs status|clear|run [-- <claude args>]');
  process.exitCode = 2;
}
