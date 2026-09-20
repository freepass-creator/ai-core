import { readdir, readFile, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

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
  if (config.identity_field != null) {
    need(typeof config.identity_field === 'string' && config.identity_field.length > 0, 'RECEIPT_CONFIG_INVALID');
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

  async function reconcile(projectRoot, config, before, { expectedIdentity = null } = {}) {
    validateConfig(config);
    const after = await snapshot(projectRoot, config);
    const changed = [...after.entries()]
      .filter(([name, mtime]) => !before.has(name) || before.get(name) !== mtime)
      .sort((a,b) => b[1] - a[1]);
    if (changed.length === 0) return { status: 'HOLD', reason: 'EXECUTION_RECEIPT_MISSING' };

    const identityBound = expectedIdentity != null
      && typeof config.identity_field === 'string' && config.identity_field.length > 0;
    if (!identityBound && changed.length > 1 && changed[0][1] === changed[1][1]) {
      return { status: 'HOLD', reason: 'EXECUTION_RECEIPT_AMBIGUOUS' };
    }

    const dir = resolve(projectRoot, config.directory);
    let [name] = changed[0];
    let path = resolve(dir, name);
    safeUnder(dir, path);
    let receipt;

    if (identityBound && changed.length > 1) {
      const exact = [];
      for (const [candidateName] of changed) {
        const candidatePath = resolve(dir, candidateName);
        safeUnder(dir, candidatePath);
        let candidateReceipt;
        try { candidateReceipt = JSON.parse(await readText(candidatePath)); }
        catch { continue; }
        if (candidateReceipt?.[config.schema_field] !== config.schema_value) continue;
        if (candidateReceipt?.[config.identity_field] !== expectedIdentity) continue;
        exact.push({ name: candidateName, path: candidatePath, receipt: candidateReceipt });
      }
      if (exact.length > 1) return { status: 'HOLD', reason: 'EXECUTION_RECEIPT_AMBIGUOUS' };
      if (exact.length === 1) ({ name, path, receipt } = exact[0]);
    }

    if (receipt === undefined) {
      try { receipt = JSON.parse(await readText(path)); }
      catch { return { status: 'HOLD', reason: 'EXECUTION_RECEIPT_UNREADABLE', path }; }
    }

    if (receipt?.[config.schema_field] !== config.schema_value) {
      return { status: 'HOLD', reason: 'EXECUTION_RECEIPT_SCHEMA_MISMATCH', path, receipt };
    }

    let identityVerified = expectedIdentity == null;
    if (expectedIdentity != null) {
      if (typeof config.identity_field !== 'string' || config.identity_field.length === 0) {
        return { status: 'HOLD', reason: 'EXECUTION_RECEIPT_IDENTITY_UNBOUND', path, receipt, identity_verified: false };
      }
      const observedIdentity = receipt?.[config.identity_field];
      if (observedIdentity !== expectedIdentity) {
        return {
          status: 'HOLD',
          reason: 'EXECUTION_RECEIPT_IDENTITY_MISMATCH',
          path,
          receipt,
          identity: observedIdentity ?? null,
          identity_verified: false,
        };
      }
      identityVerified = true;
    }

    const state = receipt?.[config.state_field];
    if (config.success_states.includes(state)) return { status: 'SUCCEEDED', path, receipt, state, identity_verified: identityVerified };
    if (config.hold_states.includes(state)) return { status: 'HOLD', reason: 'EXECUTION_RECEIPT_HOLD', path, receipt, state, identity_verified: identityVerified };
    if (config.failure_states.includes(state)) return { status: 'FAILED', reason: 'EXECUTION_RECEIPT_FAILED', path, receipt, state, identity_verified: identityVerified };
    return { status: 'HOLD', reason: 'EXECUTION_RECEIPT_NON_TERMINAL', path, receipt, state, identity_verified: identityVerified };
  }

  return Object.freeze({ snapshot, reconcile });
}
