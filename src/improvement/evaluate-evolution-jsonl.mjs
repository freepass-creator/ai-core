import { createInterface } from 'node:readline';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateSelfEvolution } from '../../scripts/evaluate-self-evolution.mjs';

// A transport boundary only: all policy decisions belong to the shared evaluator.
export function evaluateEvolutionLine(line, lineNumber) {
  let input;
  try {
    input = JSON.parse(line);
  } catch {
    return failure(lineNumber, 'HOLD_INVALID_JSON', 'JSON_PARSE_FAILED');
  }
  try {
    return envelope(lineNumber, evaluateSelfEvolution(input));
  } catch {
    // An evaluator exception is unknown, not a schema verdict or policy approval.
    // Do not echo untrusted payloads or exception text into diagnostics.
    return failure(lineNumber, 'HOLD_EVALUATION_ERROR', 'EVALUATOR_THROWN');
  }
}

function failure(line, status, reason) {
  return envelope(line, {
    status, reasons: [reason], auto_adopted: false, execution_authorized: false
  });
}

function envelope(line, result) {
  return { line, result, auto_adopted: false, execution_authorized: false };
}

export async function evaluateEvolutionStream(input, output) {
  const lines = createInterface({ input, crlfDelay: Infinity });
  let lineNumber = 0;
  let failed = false;
  async function* records() {
    for await (const rawLine of lines) {
      lineNumber += 1;
      // Accept one UTF-8 signature only at the beginning of the file.
      const line = lineNumber === 1 && rawLine.startsWith('\uFEFF') ? rawLine.slice(1) : rawLine;
      // Blank physical lines are ignored but retain their place in provenance.
      if (!line.trim()) continue;
      const record = evaluateEvolutionLine(line, lineNumber);
      if (['HOLD_INVALID_JSON', 'HOLD_EVALUATION_ERROR'].includes(record.result.status)) failed = true;
      yield `${JSON.stringify(record)}\n`;
    }
  }
  try {
    await pipeline(records(), output);
  } finally {
    lines.close();
  }
  return { input_error: failed };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const useStdin = args.length === 0 || (args.length === 1 && args[0] === '--stdin');
  const useFile = args.length === 2 && args[0] === '--input' &&
    args[1].trim().length > 0 && !args[1].startsWith('--');
  if (!useStdin && !useFile) {
    console.error('Usage: node src/improvement/evaluate-evolution-jsonl.mjs [--stdin | --input <file.jsonl>]');
    process.exitCode = 2;
  } else {
    let input;
    try {
      input = useFile ? createReadStream(args[1]) : process.stdin;
      const result = await evaluateEvolutionStream(input, process.stdout);
      process.exitCode = result.input_error ? 2 : 0;
    } catch {
      console.error('Evolution stream I/O failed; output may be partial.');
      process.exitCode = 1;
    } finally {
      if (useFile) input?.destroy();
    }
  }
}
