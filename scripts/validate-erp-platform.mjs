#!/usr/bin/env node
// 범용 ERP 플랫폼 시안 — 명세 규격 검사기.
// 명세(examples/erp-platform/erp.spec.json)가 규격을 지키는지, 시안 데이터가 명세를 지키는지,
// 화면 배치 CSS 가 claude-v1 규칙(토큰 밖 값·선·그림자 금지)을 지키는지 기계로 본다.
//
//   npm run erp:validate
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const E = await import(pathToFileURL(resolve(root, 'examples/erp-platform/erp-engine.js')).href);

export function validateErpPlatform(spec, seed, css = '') {
  const fail = [];
  const st = spec.standard;
  const need = (ok, msg) => { if (!ok) fail.push(msg); };
  const roles = new Set(spec.roles.map((r) => r.id));
  const ents = E.entities(spec);
  const entIds = ents.map((e) => e.id);
  need(new Set(entIds).size === entIds.length, 'entity id 가 겹친다');
  need(new Set(spec.modules.map((m) => m.id)).size === spec.modules.length, 'module id 가 겹친다');
  const prefixes = ents.filter((e) => e.prefix).map((e) => e.prefix);
  need(new Set(prefixes).size === prefixes.length, '문서 prefix 가 겹친다');

  for (const ent of ents) {
    const at = `${ent.id}`;
    need(Object.hasOwn(st.entity_kinds, ent.kind), `${at}: 규격에 없는 kind ${ent.kind}`);
    const fields = new Map(ent.fields.map((f) => [f.id, f]));
    need(fields.size === ent.fields.length, `${at}: field id 가 겹친다`);
    const known = (id) => fields.has(id) || id === 'status' || (id === 'no' && ent.kind !== 'master');
    if (ent.kind === 'master') need(ent.fields.some((f) => f.id === 'code' && f.type === 'code' && f.required), `${at}: 기준정보는 필수 code 필드가 있어야 한다`);
    else {
      need(/^[A-Z]{2,4}$/.test(ent.prefix ?? ''), `${at}: document·ledger 는 대문자 prefix 가 있어야 한다`);
      need(Boolean(ent.workflow), `${at}: document·ledger 는 workflow 가 있어야 한다`);
    }
    need(known(ent.title_field), `${at}: title_field ${ent.title_field} 가 없다`);
    for (const s of ent.subtitle_fields ?? []) need(known(s), `${at}: subtitle ${s} 가 없다`);

    const checkField = (f, where) => {
      need(Object.hasOwn(st.field_types, f.type), `${where}: 규격에 없는 type ${f.type}`);
      if (f.type === 'enum') need(Array.isArray(f.options) && f.options.length > 0, `${where}: enum 은 options 가 있어야 한다`);
      if (f.type === 'ref') need(entIds.includes(f.ref), `${where}: ref ${f.ref} 가 명세에 없다`);
      if (f.type === 'lines') { need(Array.isArray(f.columns) && f.columns.length > 0, `${where}: lines 는 columns 가 있어야 한다`); for (const c of f.columns ?? []) checkField(c, `${where}.${c.id}`); }
      if (f.type === 'computed') {
        need(Object.hasOwn(st.compute_ops, f.compute?.op), `${where}: 규격에 없는 compute op ${f.compute?.op}`);
        if (/^lines_/.test(f.compute?.op ?? '')) {
          const lf = fields.get(f.compute.lines);
          need(lf?.type === 'lines', `${where}: compute.lines ${f.compute.lines} 가 lines 필드가 아니다`);
          for (const k of f.compute.of ?? []) need(lf?.columns?.some((c) => c.id === k), `${where}: compute.of ${k} 가 줄에 없다`);
        } else for (const k of f.compute?.of ?? []) need(fields.has(k), `${where}: compute.of ${k} 가 없다`);
      }
      if (f.pattern) { try { new RegExp(f.pattern); } catch { fail.push(`${where}: pattern 이 정규식이 아니다`); } }
    };
    for (const f of ent.fields) checkField(f, `${at}.${f.id}`);

    for (const c of ent.list.columns) need(known(c), `${at}: list 열 ${c} 가 없다`);
    need(ent.list.columns.includes('status'), `${at}: list 에 상태 열이 있어야 한다`);
    for (const c of ent.list.search) need(known(c), `${at}: 검색 필드 ${c} 가 없다`);
    need(known(ent.list.sort.field) && ['asc', 'desc'].includes(ent.list.sort.dir), `${at}: 정렬 기준이 잘못됐다`);
    for (const fl of ent.flags ?? []) {
      need(st.tones.includes(fl.tone), `${at}: flag ${fl.id} tone 이 규격 밖이다`);
      for (const w of fl.when) need(fields.has(w.field) && (w.op !== 'lt_field' || fields.has(w.value)), `${at}: flag ${fl.id} 조건 필드가 없다`);
    }

    const wf = E.workflowOf(spec, ent);
    const states = new Map(wf.states.map((s) => [s.id, s]));
    need(states.has(wf.initial), `${at}: initial ${wf.initial} 이 states 에 없다`);
    for (const s of wf.states) need(st.tones.includes(s.tone), `${at}: 상태 ${s.id} tone ${s.tone} 이 규격 밖이다`);
    for (const t of wf.transitions) {
      const w = `${at}.${t.id}`;
      need(states.has(t.to), `${w}: to ${t.to} 가 없다`);
      for (const f of t.from) { need(states.has(f), `${w}: from ${f} 가 없다`); need(!states.get(f)?.final, `${w}: 끝 상태 ${f} 에서 나가는 전이가 있다`); }
      need(t.roles.length > 0 && t.roles.every((r) => roles.has(r)), `${w}: roles 가 비었거나 명세에 없다`);
      need(st.action_kinds.includes(t.kind), `${w}: kind ${t.kind} 이 규격 밖이다`);
      if (t.kind === 'risk') need(Boolean(t.confirm) || Boolean(t.comment), `${w}: risk 전이는 confirm 이나 사유(comment)가 있어야 한다`);
      if (t.guard) need(Object.hasOwn(st.guards, t.guard) && E.GUARD_IDS.includes(t.guard), `${w}: 규격에 없는 guard ${t.guard}`);
      for (const ef of t.effects ?? []) {
        need(Object.hasOwn(st.effect_ops, ef.op), `${w}: 규격에 없는 effect ${ef.op}`);
        need(entIds.includes(ef.target) && E.entityOf(spec, ef.target).fields.some((f) => f.id === ef.field && ['number', 'money'].includes(f.type)), `${w}: effect 대상 ${ef.target}.${ef.field} 가 숫자 필드가 아니다`);
      }
    }
    for (const s of wf.states) {
      const out = wf.transitions.filter((t) => t.from.includes(s.id));
      if (!s.final) need(out.length > 0, `${at}: 끝이 아닌 상태 ${s.id} 에서 나갈 길이 없다(막다른 상태)`);
      for (const r of roles) need(out.filter((t) => t.roles.includes(r) && t.kind === 'primary').length <= 1, `${at}: 상태 ${s.id} 에서 ${r} 에게 primary 가 둘 이상이다`);
    }
    const reach = new Set([wf.initial]);
    for (let grew = true; grew;) { grew = false; for (const t of wf.transitions) if (t.from.some((f) => reach.has(f)) && !reach.has(t.to)) { reach.add(t.to); grew = true; } }
    for (const s of wf.states) need(reach.has(s.id) || (seed.records[ent.id] ?? []).some((r) => r.status === s.id), `${at}: 상태 ${s.id} 에 닿을 길이 없다`);
  }

  for (const m of spec.dashboard.metrics) {
    need(['count', 'sum', 'approvals'].includes(m.agg), `지표 ${m.id}: 규격에 없는 agg`);
    if (m.agg !== 'approvals') need(entIds.includes(m.entity), `지표 ${m.id}: entity 가 없다`);
    if (m.agg === 'sum') need(E.entityOf(spec, m.entity).fields.some((f) => f.id === m.field), `지표 ${m.id}: 합칠 필드가 없다`);
  }

  // 시안 데이터가 명세를 지키는가 — 명세를 고치고 데이터를 두고 가면 여기서 잡힌다.
  const store = E.createStore(spec, seed);
  for (const ent of ents) {
    const wf = E.workflowOf(spec, ent);
    for (const rec of store.records[ent.id]) {
      need(wf.states.some((s) => s.id === rec.status), `데이터 ${ent.id}/${rec.id}: 상태 ${rec.status} 가 명세에 없다`);
      const errs = E.validateInput(store, ent.id, rec, { editingId: rec.id });
      for (const [k, v] of Object.entries(errs)) fail.push(`데이터 ${ent.id}/${rec.id}.${k}: ${v}`);
      if (ent.prefix) need(new RegExp(`^${ent.prefix}-\\d{6}-\\d{4}$`).test(rec.no ?? ''), `데이터 ${ent.id}/${rec.id}: 문서번호가 채번 규칙과 다르다`);
    }
  }
  for (const k of Object.keys(seed.records)) need(entIds.includes(k), `데이터: 명세에 없는 entity ${k}`);

  // 배치 CSS — claude-v1 규칙을 이 화면에도 똑같이 건다.
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const bad = (re, msg) => { const hits = [...body.matchAll(re)].map((m) => m[0].trim()); if (hits.length) fail.push(`${msg}: ${[...new Set(hits)].join(' / ')}`); };
  bad(/#[0-9a-f]{3,8}\b|\brgba?\(/gi, 'CSS 가 토큰 밖 색을 만든다');
  const decl = (prop, ok, msg) => {
    const hits = [...body.matchAll(new RegExp(`(?:^|[;{\\s])(${prop})\\s*:\\s*([^;]+);`, 'g'))].map((m) => [m[1], m[2].trim()]).filter(([, v]) => !ok(v)).map(([p2, v]) => `${p2}: ${v}`);
    if (hits.length) fail.push(`${msg}: ${[...new Set(hits)].join(' / ')}`);
  };
  decl('box-shadow', (v) => v === 'none', 'CSS 가 그림자를 쓴다');
  decl('border(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?(?:-(?:color|width|style))?', (v) => /^(0|none)$/.test(v), 'CSS 가 선을 그린다');
  decl('font-size', (v) => /^var\(--t-[a-z-]+\)$/.test(v), 'CSS 가 토큰 밖 글자 크기를 쓴다');
  decl('border-radius', (v) => /^var\(--c-r-[a-z]+\)$/.test(v), 'CSS 가 토큰 밖 모서리를 쓴다');
  decl('font-weight', (v) => /^var\(--t-w-[a-z]+\)$/.test(v), 'CSS 가 토큰 밖 굵기를 쓴다');
  return fail;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const read = (p) => readFileSync(resolve(root, p), 'utf8');
  const spec = JSON.parse(read('examples/erp-platform/erp.spec.json'));
  const seed = JSON.parse(read('examples/erp-platform/erp.seed.json'));
  const fail = validateErpPlatform(spec, seed, read('examples/erp-platform/erp.css'));
  const ents = E.entities(spec);
  console.log(JSON.stringify({
    status: fail.length ? 'FAIL' : 'PASS',
    spec: `${spec.spec}@${spec.version}`,
    modules: spec.modules.length,
    entities: ents.length,
    fields: ents.reduce((s, e) => s + e.fields.length, 0),
    transitions: ents.reduce((s, e) => s + E.workflowOf(spec, e).transitions.length, 0),
    records: Object.values(seed.records).reduce((s, r) => s + r.length, 0),
    failures: fail
  }, null, 2));
  process.exit(fail.length ? 1 : 0);
}
