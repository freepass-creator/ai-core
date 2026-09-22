import crypto from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

function stable(value){
  if(Array.isArray(value)) return value.map(stable);
  if(value&&typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,stable(value[key])]));
  return value;
}

export function coreReceiptChecksum(value){
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')}`;
}

function requireString(name,value){
  if(typeof value!=='string'||!value.trim()){
    const error=new TypeError(`${name} must be a non-empty string`);
    error.code='CORE_RECEIPT_FIELD_REQUIRED';
    throw error;
  }
  return value;
}

function normalizeRefs(refs){
  if(!Array.isArray(refs)){
    const error=new TypeError('receipt refs must be an array');
    error.code='CORE_RECEIPT_REFS_INVALID';
    throw error;
  }
  return [...new Set(refs.map((ref)=>requireString('receipt ref',ref)))];
}

const CORE_TERMINAL_STATUS=new Set(['SUCCEEDED','HOLD','FAILED','PARTIAL']);

export function buildCoreReceipt({
  receiptId,
  operationId=receiptId,
  operationKind,
  actor,
  executor,
  correlationId=receiptId,
  status,
  reasonCode=null,
  inputPayload,
  outputPayload,
  inputRefs=[],
  outputRefs=[],
  sourceRevision=null,
  startedAt,
  endedAt,
  evidenceRefs=[],
  deterministic=true,
  executorVersion='1',
  environmentRevision=sourceRevision,
  commandRef=null
}){
  requireString('receiptId',receiptId);
  requireString('operationId',operationId);
  requireString('operationKind',operationKind);
  requireString('actor',actor);
  requireString('executor',executor);
  requireString('correlationId',correlationId);
  requireString('startedAt',startedAt);
  requireString('endedAt',endedAt);
  requireString('executorVersion',executorVersion);
  if(!CORE_TERMINAL_STATUS.has(status)){
    const error=new TypeError(`unsupported core receipt status: ${status}`);
    error.code='CORE_RECEIPT_STATUS_INVALID';
    throw error;
  }
  if(reasonCode!==null) requireString('reasonCode',reasonCode);
  if(sourceRevision!==null) requireString('sourceRevision',sourceRevision);
  if(environmentRevision!==null) requireString('environmentRevision',environmentRevision);
  if(commandRef!==null) requireString('commandRef',commandRef);

  return {
    schema_version:'core-receipt/v1',
    receipt_id:receiptId,
    operation_id:operationId,
    operation_kind:operationKind,
    actor,
    executor,
    correlation_id:correlationId,
    status,
    reason_code:reasonCode,
    input:{digest:coreReceiptChecksum(inputPayload),refs:normalizeRefs(inputRefs)},
    output:{digest:coreReceiptChecksum(outputPayload),refs:normalizeRefs(outputRefs)},
    source_revision:sourceRevision,
    started_at:startedAt,
    ended_at:endedAt,
    evidence_refs:normalizeRefs(evidenceRefs),
    reproducibility:{
      deterministic:Boolean(deterministic),
      executor_version:executorVersion,
      environment_revision:environmentRevision,
      command_ref:commandRef
    }
  };
}

const need = (condition, code) => { if (!condition) throw new Error(code); };

function safeUnder(root, path, code = 'RECEIPT_PATH_ESCAPE') {
  const rel = relative(root, path);
  need(rel === '' || (!rel.startsWith('..') && !isAbsolute(rel)), code);
}

function validateConfig(config) {
  need(config?.kind === 'NEW_JSON_TERMINAL_RECEIPT', 'RECEIPT_CONFIG_INVALID');
  for (const key of ['directory','prefix','suffix','schema_field','schema_value','state_field']) {
    need(typeof config[key] === 'string' && config[key].length > 0, 'RECEIPT_CONFIG_INVALID');
  }
  for (const key of ['success_states','hold_states','failure_states']) {
    need(Array.isArray(config[key]), 'RECEIPT_CONFIG_INVALID');
  }
  const all = [...config.success_states, ...config.hold_states, ...config.failure_states];
  need(all.length > 0 && new Set(all).size === all.length, 'RECEIPT_STATES_INVALID');
  return config;
}

export function createTerminalReceiptReader({
  listDirectory = readdir,
  readText = path => readFile(path, 'utf8'),
  readStat = stat,
} = {}) {
  async function snapshot(projectRoot, config) {
    validateConfig(config);
    const dir = resolve(projectRoot, config.directory);
    safeUnder(resolve(projectRoot), dir);
    let names = [];
    try { names = await listDirectory(dir); }
    catch (error) { if (error?.code === 'ENOENT') return new Map(); throw error; }
    const selected = names.filter(name => name.startsWith(config.prefix) && name.endsWith(config.suffix));
    const entries = await Promise.all(selected.map(async name => {
      const path = resolve(dir, name);
      safeUnder(dir, path);
      const info = await readStat(path);
      return [name, Number(info.mtimeMs) || 0];
    }));
    return new Map(entries);
  }

  async function reconcile(projectRoot, config, before) {
    validateConfig(config);
    const after = await snapshot(projectRoot, config);
    const changed = [...after.entries()]
      .filter(([name, mtime]) => !before.has(name) || before.get(name) !== mtime)
      .sort((a,b) => b[1] - a[1]);
    if (changed.length === 0) return { status: 'HOLD', reason: 'EXECUTION_RECEIPT_MISSING' };
    if (changed.length > 1 && changed[0][1] === changed[1][1]) {
      return { status: 'HOLD', reason: 'EXECUTION_RECEIPT_AMBIGUOUS' };
    }

    const [name] = changed[0];
    const dir = resolve(projectRoot, config.directory);
    const path = resolve(dir, name);
    safeUnder(dir, path);
    let receipt;
    try { receipt = JSON.parse(await readText(path)); }
    catch { return { status: 'HOLD', reason: 'EXECUTION_RECEIPT_UNREADABLE', path }; }

    if (receipt?.[config.schema_field] !== config.schema_value) {
      return { status: 'HOLD', reason: 'EXECUTION_RECEIPT_SCHEMA_MISMATCH', path, receipt };
    }
    const state = receipt?.[config.state_field];
    if (config.success_states.includes(state)) return { status: 'SUCCEEDED', path, receipt, state };
    if (config.hold_states.includes(state)) return { status: 'HOLD', reason: 'EXECUTION_RECEIPT_HOLD', path, receipt, state };
    if (config.failure_states.includes(state)) return { status: 'FAILED', reason: 'EXECUTION_RECEIPT_FAILED', path, receipt, state };
    return { status: 'HOLD', reason: 'EXECUTION_RECEIPT_NON_TERMINAL', path, receipt, state };
  }

  return Object.freeze({ snapshot, reconcile });
}
