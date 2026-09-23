// ERP 명세 엔진 — 화면과 떨어진 순수 로직이다. 브라우저(erp-app.js)와 Node 시험이 같은 파일을 쓴다.
// 명세(erp.spec.json)가 정본이고, 이 파일은 명세의 규칙(계산·상태 전이·권한·가드·효과·채번·검증)을 «해석»만 한다.
// 업무별 분기(if entity === 'sales_order')를 두지 않는다 — 두는 순간 명세 구동이 아니다.

export const clone = (v) => JSON.parse(JSON.stringify(v));

export function entities(spec) {
  return spec.modules.flatMap((m) => m.entities.map((e) => ({ ...e, module: m.id })));
}

export function entityOf(spec, id) {
  const found = entities(spec).find((e) => e.id === id);
  if (!found) throw new Error(`명세에 없는 entity: ${id}`);
  return found;
}

export function workflowOf(spec, ent) {
  return ent.workflow ?? (ent.kind === 'master' ? spec.standard.master_workflow : null);
}

export function stateOf(spec, ent, rec) {
  return workflowOf(spec, ent)?.states.find((s) => s.id === rec.status) ?? { id: rec.status, label: rec.status, tone: 'idle' };
}

/* ── 저장소 ─────────────────────────────────────────────────────────────── */

export function createStore(spec, seed) {
  const records = {};
  for (const ent of entities(spec)) {
    records[ent.id] = clone(seed.records[ent.id] ?? []).map((r) => ({
      created_at: r.date ?? r.joined ?? seed.today,
      created_by: r.owner ?? '시스템',
      updated_at: r.date ?? seed.today,
      history: [{ at: r.date ?? seed.today, by: r.owner ?? '시스템', what: '등록' }],
      ...r
    }));
  }
  return { spec, today: seed.today, records };
}

export function find(store, entId, id) {
  return store.records[entId]?.find((r) => r.id === id) ?? null;
}

/* ── 계산 ───────────────────────────────────────────────────────────────── */

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function computeRecord(spec, ent, rec) {
  const out = { ...rec };
  for (const f of ent.fields) {
    if (f.type !== 'computed') continue;
    const c = f.compute;
    if (c.op === 'lines_sum') out[f.id] = (out[c.lines] ?? []).reduce((s, l) => s + c.of.reduce((p, k) => p * num(l[k]), 1), 0);
    else if (c.op === 'lines_col') out[f.id] = (out[c.lines] ?? []).reduce((s, l) => s + num(l[c.of[0]]), 0);
    else if (c.op === 'rate') out[f.id] = Math.round(num(out[c.of[0]]) * spec.standard.tax.vat_rate);
    else if (c.op === 'add') out[f.id] = c.of.reduce((s, k) => s + num(out[k]), 0);
    else throw new Error(`규격에 없는 compute op: ${c.op}`);
  }
  return out;
}

/* ── 조건 ───────────────────────────────────────────────────────────────── */

export function matchWhere(rec, where = [], today = '') {
  return where.every(({ field, op, value }) => {
    const v = rec[field];
    if (op === 'in') return value.includes(v);
    if (op === 'eq') return v === value;
    if (op === 'lt') return num(v) < num(value);
    if (op === 'gte') return num(v) >= num(value);
    if (op === 'lt_field') return num(v) < num(rec[value]);
    if (op === 'month') return String(v ?? '').slice(0, 7) === (value === 'current' ? today.slice(0, 7) : value);
    throw new Error(`규격에 없는 where op: ${op}`);
  });
}

export function flagsOf(ent, rec) {
  return (ent.flags ?? []).filter((fl) => matchWhere(rec, fl.when));
}

/* ── 상태 전이 · 권한 · 가드 ──────────────────────────────────────────────── */

const GUARDS = {
  has_lines: (rec) => ((rec.lines ?? []).length > 0 ? null : '품목 줄이 한 줄 이상 있어야 합니다'),
  balanced: (rec) => {
    const d = (rec.lines ?? []).reduce((s, l) => s + num(l.debit), 0);
    const c = (rec.lines ?? []).reduce((s, l) => s + num(l.credit), 0);
    if (d === 0 && c === 0) return '분개 금액이 없습니다';
    return d === c ? null : `차변 ${d.toLocaleString('ko-KR')} ≠ 대변 ${c.toLocaleString('ko-KR')}`;
  }
};
export const GUARD_IDS = Object.keys(GUARDS);

/** 지금 상태에서 나갈 수 있는 전이. 역할이 없으면 빼고, 가드에 걸리면 «막힌 이유»와 함께 남긴다(숨기지 않는다). */
export function transitionsFor(spec, ent, rec, role) {
  const wf = workflowOf(spec, ent);
  if (!wf) return [];
  const full = computeRecord(spec, ent, rec);
  return wf.transitions
    .filter((t) => t.from.includes(rec.status) && t.roles.includes(role))
    .map((t) => ({ ...t, blocked: t.guard ? GUARDS[t.guard](full) : null }));
}

export function applyTransition(store, entId, id, transId, { role, by, at, comment } = {}) {
  const { spec } = store;
  const ent = entityOf(spec, entId);
  const rec = find(store, entId, id);
  if (!rec) return { ok: false, error: '문서를 찾을 수 없습니다' };
  const t = transitionsFor(spec, ent, rec, role).find((x) => x.id === transId);
  if (!t) return { ok: false, error: '이 역할로는 지금 할 수 없는 동작입니다' };
  if (t.blocked) return { ok: false, error: t.blocked };
  if (t.comment && !String(comment ?? '').trim()) return { ok: false, error: '사유를 적어 주세요' };

  // 효과를 먼저 «계산»하고, 전부 가능할 때만 반영한다(반쯤 반영된 재고를 남기지 않는다).
  const changes = [];
  for (const ef of t.effects ?? []) {
    const rows = ef.op === 'adjust_lines' ? (rec[ef.lines] ?? []).map((l) => ({ ref: l[ef.ref_col], by: num(l[ef.by]) }))
      : ef.op === 'adjust' ? [{ ref: rec[ef.ref_field], by: num(rec[ef.by]) }]
      : (() => { throw new Error(`규격에 없는 effect op: ${ef.op}`); })();
    const sign = typeof ef.sign === 'number' ? ef.sign : num(ef.sign.map[rec[ef.sign.field]]);
    for (const row of rows) {
      const target = find(store, ef.target, row.ref);
      if (!target) return { ok: false, error: `${row.ref} 을(를) 찾을 수 없습니다` };
      const next = num(target[ef.field]) + sign * row.by;
      if (next < 0) return { ok: false, error: `${target.name ?? target.id} ${fieldOf(spec, ef.target, ef.field).label}이(가) 모자랍니다 (${num(target[ef.field])} → ${next})` };
      changes.push({ target, field: ef.field, next, delta: sign * row.by });
    }
  }
  for (const c of changes) {
    c.target[c.field] = c.next;
    c.target.history.push({ at, by, what: `${fieldOf(spec, targetEntity(store, c.target), c.field).label} ${c.delta > 0 ? '+' : ''}${c.delta}`, note: rec.no ?? rec.id });
  }
  const from = stateOf(spec, ent, rec).label;
  rec.status = t.to;
  rec.updated_at = at;
  rec.history.push({ at, by, what: `${t.label} · ${from} → ${stateOf(spec, ent, rec).label}`, note: comment || undefined, tone: stateOf(spec, ent, rec).tone });
  return { ok: true, record: rec, changes: changes.length };
}

function targetEntity(store, rec) {
  return Object.keys(store.records).find((k) => store.records[k].includes(rec));
}

export function fieldOf(spec, entId, fieldId) {
  if (fieldId === 'status') return { id: 'status', label: '상태', type: 'status' };
  if (fieldId === 'no') return { id: 'no', label: '문서번호', type: 'code' };
  return entityOf(spec, entId).fields.find((f) => f.id === fieldId) ?? { id: fieldId, label: fieldId, type: 'text' };
}

/* ── 결재함 ─────────────────────────────────────────────────────────────── */

export function approvalsFor(store, role) {
  const out = [];
  for (const ent of entities(store.spec)) {
    for (const rec of store.records[ent.id]) {
      const ts = transitionsFor(store.spec, ent, rec, role).filter((t) => t.approval);
      if (ts.length) out.push({ ent, rec, transitions: ts });
    }
  }
  return out.sort((a, b) => String(a.rec.updated_at).localeCompare(String(b.rec.updated_at)));
}

/* ── 지표 ───────────────────────────────────────────────────────────────── */

export function metricValue(store, m, role) {
  if (m.agg === 'approvals') return approvalsFor(store, role).length;
  const ent = entityOf(store.spec, m.entity);
  const rows = store.records[m.entity].map((r) => computeRecord(store.spec, ent, r)).filter((r) => matchWhere(r, m.where, store.today));
  if (m.agg === 'count') return rows.length;
  if (m.agg === 'sum') return rows.reduce((s, r) => s + num(r[m.field]), 0);
  throw new Error(`규격에 없는 agg: ${m.agg}`);
}

/* ── 채번 · 입력 검증 · 등록 ──────────────────────────────────────────────── */

export function nextNumber(store, ent, date) {
  const ym = String(date ?? store.today).slice(0, 7).replace('-', '');
  const head = `${ent.prefix}-${ym}-`;
  const max = store.records[ent.id].map((r) => r.no ?? '').filter((n) => n.startsWith(head)).map((n) => Number(n.slice(head.length))).reduce((a, b) => Math.max(a, b), 0);
  return head + String(max + 1).padStart(4, '0');
}

export function validateValue(f, v) {
  const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  if (empty) return f.required && f.type !== 'lines' ? '꼭 넣어야 합니다' : null;
  if (['number', 'money', 'percent'].includes(f.type)) {
    if (!Number.isFinite(Number(v))) return '숫자로 넣어 주세요';
    if (f.type === 'money' && !Number.isInteger(Number(v))) return '원 단위 정수로 넣어 주세요';
    if (f.min !== undefined && Number(v) < f.min) return `${f.min} 이상이어야 합니다`;
    if (f.type === 'percent' && (Number(v) < 0 || Number(v) > 100)) return '0~100 사이여야 합니다';
  }
  if (f.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'YYYY-MM-DD 로 넣어 주세요';
  if (f.type === 'enum' && !f.options.includes(v)) return '고를 수 있는 값이 아닙니다';
  if (f.pattern && !new RegExp(f.pattern).test(String(v))) return f.help ? `${f.help} 로 넣어 주세요` : '형식이 맞지 않습니다';
  return null;
}

export function validateInput(store, entId, values, { editingId } = {}) {
  const ent = entityOf(store.spec, entId);
  const errors = {};
  for (const f of ent.fields) {
    if (f.type === 'computed' || f.readonly) continue;
    const v = values[f.id];
    let e = validateValue(f, v);
    if (!e && f.type === 'ref' && v && !find(store, f.ref, v)) e = '없는 대상입니다';
    if (!e && f.type === 'code' && store.records[entId].some((r) => r[f.id] === v && r.id !== editingId)) e = '이미 쓰는 코드입니다';
    if (!e && f.type === 'lines') {
      (v ?? []).forEach((line, i) => {
        for (const col of f.columns) {
          const ce = validateValue(col, line[col.id]);
          if (ce && !e) e = `${i + 1}번째 줄 ${col.label}: ${ce}`;
        }
      });
    }
    if (e) errors[f.id] = e;
  }
  return errors;
}

export function createRecord(store, entId, values, { by, at }) {
  const ent = entityOf(store.spec, entId);
  const errors = validateInput(store, entId, values);
  if (Object.keys(errors).length) return { ok: false, errors };
  const wf = workflowOf(store.spec, ent);
  const rec = { ...clone(values), status: wf.initial, created_at: at, created_by: by, updated_at: at, history: [{ at, by, what: '작성' }] };
  if (ent.kind === 'master') rec.id = values.code;
  else { rec.no = nextNumber(store, ent, values.date ?? values.start ?? at); rec.id = rec.no; }
  for (const f of ent.fields) if (f.readonly && rec[f.id] === undefined) rec[f.id] = 0;
  store.records[entId].unshift(rec);
  return { ok: true, record: rec };
}

/** 고칠 수 있나: 기준정보는 늘, 문서는 첫 상태(작성 중)에서만. 원장은 확정 뒤 절대 못 고친다. */
export function canEdit(spec, ent, rec) {
  const wf = workflowOf(spec, ent);
  if (ent.kind === 'master') return true;
  return rec.status === wf.initial && !wf.states.find((s) => s.id === rec.status)?.final;
}

export function updateRecord(store, entId, id, values, { by, at }) {
  const ent = entityOf(store.spec, entId);
  const rec = find(store, entId, id);
  if (!canEdit(store.spec, ent, rec)) return { ok: false, errors: { _: '이 상태에서는 고칠 수 없습니다' } };
  const errors = validateInput(store, entId, values, { editingId: id });
  if (Object.keys(errors).length) return { ok: false, errors };
  const changed = ent.fields.filter((f) => f.type !== 'computed' && !f.readonly && JSON.stringify(rec[f.id] ?? null) !== JSON.stringify(values[f.id] ?? null)).map((f) => f.label);
  for (const f of ent.fields) if (f.type !== 'computed' && !f.readonly) rec[f.id] = clone(values[f.id] ?? null);
  rec.updated_at = at;
  if (changed.length) rec.history.push({ at, by, what: `수정 · ${changed.join(', ')}` });
  return { ok: true, record: rec };
}

/* ── 표시 ───────────────────────────────────────────────────────────────── */

export function display(store, entId, fieldId, rec) {
  const { spec } = store;
  const f = fieldOf(spec, entId, fieldId);
  const v = rec[fieldId];
  if (v === undefined || v === null || v === '') return '—';
  if (f.type === 'money' || (f.type === 'computed')) return Number(v).toLocaleString('ko-KR');
  if (f.type === 'number') {
    const unit = f.unit ?? (f.unit_field ? rec[f.unit_field] : '');
    return `${Number(v).toLocaleString('ko-KR')}${unit ? ` ${unit}` : ''}`;
  }
  if (f.type === 'percent') return `${v}%`;
  if (f.type === 'ref') {
    const target = find(store, f.ref, v);
    const tEnt = entityOf(spec, f.ref);
    return target ? String(target[tEnt.title_field] ?? v) : String(v);
  }
  if (f.type === 'status') return stateOf(spec, entityOf(spec, entId), rec).label;
  return String(v);
}

export const isNumeric = (f) => ['money', 'number', 'percent', 'computed'].includes(f.type);
