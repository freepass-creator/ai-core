const need = (condition, code) => { if (!condition) throw new Error(code); };

export function createControlTowerAuthorityVerifier({ readContext, verifyLedgerText, runControlTower }) {
  need(typeof readContext === 'function', 'AUTHORITY_READ_CONTEXT_REQUIRED');
  need(typeof verifyLedgerText === 'function', 'AUTHORITY_LEDGER_VERIFIER_REQUIRED');
  need(typeof runControlTower === 'function', 'AUTHORITY_CONTROL_TOWER_REQUIRED');

  return async function verifyAuthority({ authority, plan, capability }) {
    try {
      if (!authority || authority.status !== 'GRANTED') return false;
      if (!plan?.order_id || !plan?.work_id || !plan?.project_id || !plan?.subject_revision) return false;
      if (authority.order_id !== plan.order_id || authority.work_id !== plan.work_id) return false;
      if (authority.project_id !== plan.project_id || authority.capability_id !== capability.id) return false;
      if (authority.subject_revision !== plan.subject_revision) return false;
      if (!Array.isArray(authority.scopes) || !capability.required_scopes.every(scope => authority.scopes.includes(scope))) return false;

      const context = structuredClone(await readContext(plan.order_id));
      const ledger = await verifyLedgerText(context.ledgerText);
      if (ledger?.status !== 'VALID' || !ledger.head || authority.ledger_head !== ledger.head) return false;

      const mapping = (context.mappings ?? []).find(row =>
        row.order_id === plan.order_id
        && row.requirement_revision === context.order?.revision
        && row.work_id === plan.work_id);
      if (!mapping) return false;
      if (mapping.project_id !== plan.project_id || mapping.subject_revision !== plan.subject_revision) return false;

      const item = (context.snapshot?.items ?? []).find(row => row.id === plan.work_id);
      if (!item || item.project_id !== plan.project_id || item.subject_revision !== plan.subject_revision) return false;

      const canonicalAuth = item.authorization;
      if (!canonicalAuth?.required || canonicalAuth.status !== 'GRANTED') return false;
      if (canonicalAuth.revision !== plan.subject_revision) return false;
      if (!Array.isArray(canonicalAuth.scope) || !capability.required_scopes.every(scope => canonicalAuth.scope.includes(scope))) return false;
      if (!authority.scopes.every(scope => canonicalAuth.scope.includes(scope))) return false;

      const control = await runControlTower({
        registry: context.registry,
        snapshot: context.snapshot,
        ledgerText: context.ledgerText,
      });
      if (control?.ledger_head !== ledger.head) return false;
      const controlled = (control?.items ?? []).find(row => row.id === plan.work_id);
      if (!controlled?.execute?.enabled || controlled.execute.reasons?.length) return false;

      return true;
    } catch {
      return false;
    }
  };
}
