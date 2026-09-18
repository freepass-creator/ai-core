import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createTerminalReceiptReader } from './execution-receipt.mjs';

const execFileAsync = promisify(execFile);
const need = (condition, code) => { if (!condition) throw new Error(code); };
const safeToken = token => typeof token === 'string' && token.length > 0 && !/[;&|><\r\n]/.test(token);

export function parseRegistryCommand(command) {
  need(typeof command === 'string' && command.trim(), 'PROJECT_COMMAND_UNAVAILABLE');
  need(!/[;&|><\r\n]/.test(command), 'PROJECT_COMMAND_UNSAFE');
  const tokens = command.trim().split(/\s+/);
  need(tokens.every(safeToken), 'PROJECT_COMMAND_UNSAFE');
  return tokens;
}

function platformExecutable(executable) {
  if (executable === 'node') return process.execPath;
  if (executable === 'npm' && process.platform === 'win32') return 'npm.cmd';
  return executable;
}

export function createProjectRuntime({
  readHead = async localPath => (await execFileAsync('git', ['-C', localPath, 'rev-parse', 'HEAD'], { windowsHide: true })).stdout.trim(),
  runProcess = async ({ argv, cwd }) => {
    const [exe, ...args] = argv;
    try {
      const { stdout, stderr } = await execFileAsync(platformExecutable(exe), args, {
        cwd, windowsHide: true, maxBuffer: 16 * 1024 * 1024,
      });
      return { stdout, stderr, exit_code: 0 };
    } catch (error) {
      return {
        stdout: error?.stdout ?? '',
        stderr: error?.stderr ?? '',
        exit_code: Number.isInteger(error?.code) ? error.code : 1,
      };
    }
  },
  importModule = async path => import(pathToFileURL(path).href),
  receiptReader = createTerminalReceiptReader(),
} = {}) {
  async function assertProject(project) {
    need(project && project.status === 'ACTIVE', 'PROJECT_NOT_ACTIVE');
    need(typeof project.local_path === 'string' && project.local_path.length > 0 && isAbsolute(project.local_path), 'PROJECT_LOCAL_PATH_REQUIRED');
    const head = await readHead(project.local_path);
    need(head === project.head_revision, 'PROJECT_REVISION_STALE');
    return head;
  }

  function commandFor(capability, project) {
    const adapter = capability.adapter;
    if (adapter.kind === 'PROJECT_REGISTRY_COMMAND') {
      return parseRegistryCommand(project.commands?.[adapter.command_key]);
    }
    if (adapter.kind === 'PROJECT_COMMAND') {
      need(Array.isArray(adapter.argv) && adapter.argv.every(safeToken), 'PROJECT_COMMAND_UNSAFE');
      return [...adapter.argv];
    }
    throw new Error('PROJECT_COMMAND_ADAPTER_REQUIRED');
  }

  async function prepareCommand(capability, project) {
    const argv = commandFor(capability, project);
    return { kind: 'PROJECT_COMMAND', project_id: project.project_id, cwd: project.local_path, argv };
  }

  async function runCommand(capability, project) {
    const subjectRevision = await assertProject(project);
    const prepared = await prepareCommand(capability, project);
    const receiptConfig = capability.adapter.receipt ?? null;
    const before = receiptConfig ? await receiptReader.snapshot(project.local_path, receiptConfig) : null;
    const result = await runProcess({ argv: prepared.argv, cwd: prepared.cwd });

    if (receiptConfig) {
      const reconciled = await receiptReader.reconcile(project.local_path, receiptConfig, before);
      const receiptEvidence = reconciled.path
        ? [`MEASURED: terminal receipt ${reconciled.path} state=${reconciled.state ?? 'UNKNOWN'}`]
        : [];
      const status = reconciled.status;
      return {
        status,
        summary: status === 'SUCCEEDED'
          ? `${capability.title} 실행기록 검증 완료`
          : status === 'FAILED'
            ? `${capability.title} 실행기록이 실패를 확인했습니다.`
            : `${capability.title} 실행결과를 성공으로 확정하지 못했습니다.`,
        data: {
          stdout: result.stdout ?? '',
          stderr: result.stderr ?? '',
          exit_code: result.exit_code ?? 0,
          receipt: reconciled.receipt ?? null,
          receipt_path: reconciled.path ?? null,
          receipt_state: reconciled.state ?? null,
        },
        evidence: [
          `MEASURED: ${prepared.argv.join(' ')} @${project.project_id}:${subjectRevision}`,
          ...receiptEvidence,
        ],
        artifacts: reconciled.path ? [reconciled.path] : [],
        checks: [
          { name: capability.id + '.process', status: (result.exit_code ?? 0) === 0 ? 'PASS' : 'FAIL', detail: `exit=${result.exit_code ?? 0}` },
          { name: capability.id + '.receipt', status: status === 'SUCCEEDED' ? 'PASS' : 'FAIL', detail: reconciled.reason ?? reconciled.state ?? null },
        ],
        blockers: status === 'SUCCEEDED' ? [] : [reconciled.reason ?? 'EXECUTION_RECEIPT_NOT_SUCCESS'],
        next_action: status === 'SUCCEEDED' ? null : '프로젝트 실행기록과 하위 HOLD/실패 단계를 확인합니다.',
        external_effect: capability.mode === 'EXTERNAL_MUTATION',
      };
    }

    const success = (result.exit_code ?? 0) === 0;
    return {
      status: success ? 'SUCCEEDED' : 'FAILED',
      summary: success ? `${capability.title} 실행 완료` : `${capability.title} 실행 실패`,
      data: { stdout: result.stdout ?? '', stderr: result.stderr ?? '', exit_code: result.exit_code ?? 0 },
      evidence: [`MEASURED: ${prepared.argv.join(' ')} @${project.project_id}:${subjectRevision}`],
      checks: [{ name: capability.id, status: success ? 'PASS' : 'FAIL' }],
      blockers: success ? [] : ['PROJECT_COMMAND_FAILED'],
      external_effect: capability.mode === 'EXTERNAL_MUTATION',
    };
  }

  async function runModule(capability, project, input) {
    const subjectRevision = await assertProject(project);
    const entry = resolve(project.local_path, capability.adapter.entrypoint);
    const rel = relative(project.local_path, entry);
    need(rel && !rel.startsWith('..') && !isAbsolute(rel), 'PROJECT_MODULE_PATH_ESCAPE');
    const module = await importModule(entry);
    const fn = module?.[capability.adapter.export];
    need(typeof fn === 'function', 'PROJECT_MODULE_EXPORT_MISSING');
    const data = await fn(input);
    if (data && ['SUCCEEDED', 'HOLD', 'FAILED'].includes(data.status)) return data;
    const auditHold = data?.recordAuditVerdict === 'HOLD';
    return {
      status: auditHold ? 'HOLD' : 'SUCCEEDED',
      summary: auditHold ? `${capability.title} 결과가 HOLD입니다.` : `${capability.title} 완료`,
      data,
      evidence: [`READ: ${capability.adapter.entrypoint}#${capability.adapter.export} @${project.project_id}:${subjectRevision}`],
      checks: [{ name: capability.id, status: auditHold ? 'FAIL' : 'PASS' }],
      blockers: auditHold ? [...(data?.findings ?? ['PROJECT_MODULE_AUDIT_HOLD'])] : [],
      external_effect: false,
    };
  }

  return Object.freeze({ assertProject, prepareCommand, runCommand, runModule });
}
