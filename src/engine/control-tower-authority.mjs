const need = (condition, code) => { if (!condition) throw new Error(code); };

async function inspectCanonicalAuthority({ readContext, verifyLedgerText, runControlTower, plan, capability, now }) {
  if (!plan?.order_id || !plan?.work_id || !plan?.project_id || !plan?.subject_revision) {
    return { ok: false, reason: 'EXECUTION_CONTEXT_REQUIRED' };
  }
  const context = structuredClone(await readContext(plan.order_id));
  const ledger = await verifyLedgerText(context.ledgerText);
  if (ledger?.status !== 'VALID' || !ledger.head) return { ok: false, reason: 'LEDGER_INVALID' };

  const mapping = (context.mappings ?? []).find(row =>
    row.order_id === plan.order_id
    && row.requirement_revision === context.order?.revision
    && row.work_id === plan.work_id);
  if (!mapping) return { ok: false, reason: 'ORDER_WORK_MAPPING_MISSING' };
  if (mapping.project_id !== plan.project_id || mapping.subject_revision !== plan.subject_revision) {
    return { ok: false, reason: 'ORDER_WORK_MAPPING_STALE' };
  }

  const item = (context.snapshot?.items ?? []).find(row => row.id === plan.work_id);
  if (!item || item.project_id !== plan.project_id || item.subject_revision !== plan.subject_revision) {
    return { ok: false, reason: 'CONTROL_ITEM_STALE' };
  }

  const canonicalAuth = item.authorization;
  if (!canonicalAuth?.required || canonicalAuth.status !== 'GRANTED') {
    return { ok: false, reason: 'CANONICAL_AUTHORITY_NOT_GRANTED' };
  }
  if (canonicalAuth.revision !== plan.subject_revision) return { ok: false, reason: 'CANONICAL_AUTHORITY_STALE' };
  if (!Array.isArray(canonicalAuth.scope)
    || !capability.required_scopes.every(scope => canonicalAuth.scope.includes(scope))) {
    return { ok: false, reason: 'CANONICAL_AUTHORITY_SCOPE_MISSING' };
  }
  if (canonicalAuth.expires_at && Date.parse(canonicalAuth.expires_at) <= now) {
    return { ok: false, reason: 'AUTHORIZATION_EXPIRED' };
  }

  const control = await runControlTower({
    registry: context.registry,
    snapshot: context.snapshot,
    ledgerText: context.ledgerText,
  });
  if (control?.ledger_head !== ledger.head) return { ok: false, reason: 'CONTROL_LEDGER_HEAD_MISMATCH' };
  const controlled = (control?.items ?? []).find(row => row.id === plan.work_id);
  if (!controlled?.execute?.enabled || controlled.execute.reasons?.length) {
    return { ok: false, reason: controlled?.execute?.reasons?.[0] ?? 'CONTROL_EXECUTION_BLOCKED' };
  }

  return { ok: true, context, ledger, item, canonicalAuth, control };
}

export function createControlTowerAuthorityBridge({ readContext, verifyLedgerText, runControlTower, clock = Date.now }) {
  need(typeof readContext === 'function', 'AUTHORITY_READ_CONTEXT_REQUIRED');
  need(typeof verifyLedgerText === 'function', 'AUTHORITY_LEDGER_VERIFIER_REQUIRED');
  need(typeof runControlTower === 'function', 'AUTHORITY_CONTROL_TOWER_REQUIRED');

  async function issue({ plan, capability }) {
    try {
      const issuedAt = clock();
      const inspected = await inspectCanonicalAuthority({ readContext, verifyLedgerText, runControlTower, plan, capability, now: issuedAt });
      if (!inspected.ok) return { status: 'HOLD', reason: inspected.reason };
      const { ledger, canonicalAuth } = inspected;
      return {
        schema: 'ai-core-authority-receipt/v1',
        status: 'GRANTED',
        order_id: plan.order_id,
        work_id: plan.work_id,
        project_id: plan.project_id,
        capability_id: capability.id,
        subject_revision: plan.subject_revision,
        ledger_head: ledger.head,
        scopes: capability.required_scopes.filter(scope => canonicalAuth.scope.includes(scope)),
        authorized_by: canonicalAuth.authorized_by,
        authorization_action: canonicalAuth.action,
        authorization_target: canonicalAuth.target,
        authorization_expires_at: canonicalAuth.expires_at,
        issued_at: new Date(issuedAt).toISOString(),
      };
    } catch (error) {
      return { status: 'HOLD', reason: error?.message || 'AUTHORITY_ISSUE_FAILED' };
    }
  }

  async function verify({ authority, plan, capability }) {
    try {
      if (!authority || authority.schema !== 'ai-core-authority-receipt/v1' || authority.status !== 'GRANTED') return false;
      if (authority.order_id !== plan.order_id || authority.work_id !== plan.work_id) return false;
      if (authority.project_id !== plan.project_id || authority.capability_id !== capability.id) return false;
      if (authority.subject_revision !== plan.subject_revision) return false;
      if (!Array.isArray(authority.scopes)
        || !capability.required_scopes.every(scope => authority.scopes.includes(scope))) return false;

      const inspected = await inspectCanonicalAuthority({ readContext, verifyLedgerText, runControlTower, plan, capability, now: clock() });
      if (!inspected.ok) return false;
      const { ledger, canonicalAuth } = inspected;
      if (authority.ledger_head !== ledger.head) return false;
      if (!authority.scopes.every(scope => canonicalAuth.scope.includes(scope))) return false;
      if (authority.authorized_by !== canonicalAuth.authorized_by) return false;
      if (authority.authorization_action !== canonicalAuth.action || authority.authorization_target !== canonicalAuth.target) return false;
      if (authority.authorization_expires_at !== canonicalAuth.expires_at) return false;
      return true;
    } catch {
      return false;
    }
  }

  return Object.freeze({ issue, verify });
}

export function createControlTowerAuthorityVerifier(dependencies) {
  return createControlTowerAuthorityBridge(dependencies).verify;
}
