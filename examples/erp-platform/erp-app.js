// ERP 화면 렌더러 — 명세(erp.spec.json)를 읽어 메뉴·대시보드·결재함·목록·상세·입력을 그린다.
// 부품은 claude-v1 정본(examples/claude/claude-v1.css)의 것만 쓴다. 새 색·새 크기를 만들지 않는다.
import * as E from './erp-engine.js';

const ICON = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  left: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  right: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  sort: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'
};
const icon = (n) => `<svg class="c-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n] ?? ''}</svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PAGE = 8;
const KEY = 'erp-platform:v1';

let spec, seed, store;
const ui = { role: 'manager', q: '', chips: new Set(), sort: null, page: 1, picked: new Set(), open: null, toast: '' };

/* ── 시작 ───────────────────────────────────────────────────────────────── */

export async function boot(root, { specData, seedData } = {}) {
  spec = specData ?? await (await fetch('./erp.spec.json')).json();
  seed = seedData ?? await (await fetch('./erp.seed.json')).json();
  store = E.createStore(spec, seed);
  try { const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (saved?.version === spec.version) store.records = saved.records; } catch {}
  try { ui.role = localStorage.getItem(KEY + ':role') ?? ui.role; } catch {}
  window.addEventListener('hashchange', () => { resetView(); render(root); });
  root.addEventListener('click', (ev) => onClick(ev, root));
  root.addEventListener('input', (ev) => onInput(ev, root));
  root.addEventListener('change', (ev) => onChange(ev, root));
  render(root);
}

const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ version: spec.version, records: store.records })); } catch {} };
const person = () => spec.roles.find((r) => r.id === ui.role);
const now = () => store.today;
const route = () => { const [, a, b, c] = (location.hash || '#/home').split('/'); return { view: a || 'home', ent: b, id: c ? decodeURIComponent(c) : null }; };
function resetView() { ui.q = ''; ui.chips = new Set(); ui.sort = null; ui.page = 1; ui.picked = new Set(); ui.open = route().id; }

/* ── 뼈대 ───────────────────────────────────────────────────────────────── */

function render(root) {
  const r = route();
  if (r.view === 'e' && r.id) ui.open = r.id;
  const approvals = E.approvalsFor(store, ui.role).length;
  const menu = spec.modules.map((m) => `
      <span class="c-menu-label">${esc(m.name)}</span>
      ${m.entities.map((e) => `<a href="#/e/${e.id}" ${r.view === 'e' && r.ent === e.id ? 'aria-current="page"' : ''}>${esc(e.name)}</a>`).join('')}`).join('');
  const who = person();
  root.innerHTML = `
  <div class="c-shell">
    <aside class="c-side">
      <div class="c-brand">${esc(spec.company.name)} <span>erp</span></div>
      <nav class="c-menu" aria-label="업무">
        <a href="#/home" ${r.view === 'home' ? 'aria-current="page"' : ''}>대시보드</a>
        <a href="#/approvals" ${r.view === 'approvals' ? 'aria-current="page"' : ''}>결재함 ${approvals ? `<span class="c-badge" data-shape="count">${approvals}</span>` : ''}</a>
        ${menu}
      </nav>
      <div class="erp-who">
        <div class="c-who"><span class="c-avatar" aria-hidden="true">${esc(who.person[0])}</span>
          <span><span class="n">${esc(who.person)}</span><br><span class="r">${esc(who.dept)} · ${esc(who.name)}</span></span></div>
        <label class="c-field"><span>역할 바꿔 보기</span>
          <select class="c-select" data-act="role">${spec.roles.map((x) => `<option value="${x.id}" ${x.id === ui.role ? 'selected' : ''}>${esc(x.name)} · ${esc(x.person)}</option>`).join('')}</select></label>
      </div>
    </aside>
    <div class="erp-page">
      <nav class="erp-mnav" aria-label="업무(좁은 화면)">
        <select class="c-select" data-act="goto" aria-label="화면 이동">
          <option value="#/home">대시보드</option><option value="#/approvals" ${r.view === 'approvals' ? 'selected' : ''}>결재함 (${approvals})</option>
          ${spec.modules.map((m) => `<optgroup label="${esc(m.name)}">${m.entities.map((e) => `<option value="#/e/${e.id}" ${r.ent === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</optgroup>`).join('')}
        </select>
        <select class="c-select" data-act="role" aria-label="역할">${spec.roles.map((x) => `<option value="${x.id}" ${x.id === ui.role ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      </nav>
      ${r.view === 'approvals' ? viewApprovals() : r.view === 'e' && r.ent ? viewList(r.ent) : viewHome()}
    </div>
  </div>
  <dialog class="c-dialog erp-dialog" id="erp-dialog"></dialog>
  <div class="erp-toast-dock" role="status" aria-live="polite">${ui.toast ? `<span class="c-toast">${icon('check')}${esc(ui.toast)}</span>` : ''}</div>`;
}

const head = (where, title, actions = '') => `
  <header class="c-head"><div><div class="c-where">${esc(where)}</div><h1>${esc(title)}</h1></div>
  <div class="c-actions c-spacer">${actions}</div></header>`;

const stateTag = (st) => `<span class="c-state" data-tone="${st.tone}">${esc(st.label)}</span>`;

/* ── 대시보드 ───────────────────────────────────────────────────────────── */

function fmtMetric(v, unit) {
  if (unit === '원') return v >= 1e8 ? `${(v / 1e8).toFixed(2)}<small>억 원</small>` : `${Math.round(v / 1e4).toLocaleString('ko-KR')}<small>만 원</small>`;
  return `${v.toLocaleString('ko-KR')}<small>${esc(unit)}</small>`;
}

function viewHome() {
  const metrics = spec.dashboard.metrics.map((m) => {
    const v = E.metricValue(store, m, ui.role);
    const tone = m.tone && v > 0 ? m.tone : '';
    return `<div class="c-metric" ${tone === 'risk' ? 'data-tone="risk"' : ''}><span class="k">${esc(m.label)}</span><span class="v">${fmtMetric(v, m.unit)}</span></div>`;
  }).join('');
  const panels = spec.dashboard.panels.map((p) => {
    let rows;
    if (p.source === 'approvals') rows = E.approvalsFor(store, ui.role).slice(0, p.limit).map(({ ent, rec }) => rowLink(ent, rec));
    else {
      const ent = E.entityOf(spec, p.entity);
      rows = store.records[ent.id].map((r) => E.computeRecord(spec, ent, r)).filter((r) => E.matchWhere(r, p.where, store.today)).slice(0, p.limit).map((rec) => rowLink(ent, rec));
    }
    return `<section class="c-box"><h3>${esc(p.title)}</h3>${rows.length ? `<div class="erp-links">${rows.join('')}</div>` : '<p class="c-note">처리할 것이 없습니다.</p>'}</section>`;
  }).join('');
  return `${head(`${spec.company.name} · ${store.today}`, '대시보드')}
  <main class="c-body">
    <div class="c-metrics">${metrics}</div>
    <div class="erp-panels">${panels}</div>
    <section class="c-sec"><h2>모듈</h2>
      <div class="erp-mods">${spec.modules.map((m) => `<div class="c-box"><h3>${esc(m.name)}</h3><div class="erp-links">${m.entities.map((e) => `<a class="erp-link" href="#/e/${e.id}"><span class="t">${esc(e.name)}</span><span class="n">${store.records[e.id].length}건</span></a>`).join('')}</div></div>`).join('')}</div>
    </section>
  </main>`;
}

function rowLink(ent, rec) {
  const full = E.computeRecord(spec, ent, rec);
  const sub = (ent.subtitle_fields ?? []).map((f) => E.display(store, ent.id, f, full)).join(' · ');
  return `<a class="erp-link" href="#/e/${ent.id}/${encodeURIComponent(rec.id)}"><span class="t">${esc(ent.name)} · ${esc(E.display(store, ent.id, ent.title_field, full))}</span><span class="n">${stateTag(E.stateOf(spec, ent, rec))}</span><span class="m">${esc(sub)}</span></a>`;
}

/* ── 결재함 ─────────────────────────────────────────────────────────────── */

function viewApprovals() {
  const list = E.approvalsFor(store, ui.role);
  const body = list.length ? `<div class="erp-scroll"><table class="c-table"><thead><tr><th>문서</th><th>종류</th><th>요약</th><th>상태</th><th class="num">금액·수량</th><th>올린 날</th><th>처리</th></tr></thead><tbody>
    ${list.map(({ ent, rec, transitions }) => {
      const full = E.computeRecord(spec, ent, rec);
      const amount = full.total ?? full.debit_total ?? full.days;
      return `<tr><td><a class="erp-key" href="#/e/${ent.id}/${encodeURIComponent(rec.id)}">${esc(rec.no ?? rec.id)}</a></td><td>${esc(ent.name)}</td>
        <td>${esc((ent.subtitle_fields ?? []).slice(0, 1).map((f) => E.display(store, ent.id, f, full)).join(''))}</td>
        <td>${stateTag(E.stateOf(spec, ent, rec))}</td><td class="num">${amount !== undefined ? Number(amount).toLocaleString('ko-KR') : '—'}</td><td>${esc(rec.updated_at)}</td>
        <td><div class="erp-inline">${transitions.map((t) => actionBtn(ent, rec, t, true)).join('')}</div></td></tr>`;
    }).join('')}</tbody></table></div>`
    : `<div class="c-empty"><b>결재할 문서가 없습니다</b><p>${esc(person().name)} 역할로 처리할 결재가 모두 끝났습니다. 다른 역할로 바꿔 보면 그 역할의 결재함이 보입니다.</p></div>`;
  return `${head('공통 · 전자결재', `결재함 · ${person().name}`)}<main class="c-body">${body}</main>`;
}

function actionBtn(ent, rec, t, small = false) {
  const kind = t.kind === 'primary' && small ? '' : t.kind;
  return `<button class="c-btn" type="button" ${kind ? `data-kind="${kind}"` : ''} data-act="go" data-ent="${ent.id}" data-id="${esc(rec.id)}" data-t="${t.id}" ${t.blocked ? `disabled title="${esc(t.blocked)}"` : ''}>${t.blocked ? icon('lock') : ''}${esc(t.label)}</button>`;
}

/* ── 목록 + 상세 ────────────────────────────────────────────────────────── */

function rowsFor(ent) {
  const cols = ent.list.columns;
  const q = ui.q.trim().toLowerCase();
  let rows = store.records[ent.id].map((r) => E.computeRecord(spec, ent, r));
  if (q) rows = rows.filter((r) => ent.list.search.some((f) => E.display(store, ent.id, f, r).toLowerCase().includes(q) || String(r[f] ?? '').toLowerCase().includes(q)));
  if (ui.chips.size) rows = rows.filter((r) => [...ui.chips].some((c) => (c.startsWith('flag:') ? E.flagsOf(ent, r).some((f) => 'flag:' + f.id === c) : r.status === c)));
  const sort = ui.sort ?? ent.list.sort;
  if (sort && cols.includes(sort.field) || sort?.field === ent.list.sort.field) {
    const f = E.fieldOf(spec, ent.id, sort.field);
    rows.sort((a, b) => {
      const x = E.isNumeric(f) ? Number(a[sort.field] ?? 0) - Number(b[sort.field] ?? 0) : String(E.display(store, ent.id, sort.field, a)).localeCompare(String(E.display(store, ent.id, sort.field, b)), 'ko');
      return sort.dir === 'desc' ? -x : x;
    });
  }
  return rows;
}

function viewList(entId) {
  const ent = E.entityOf(spec, entId);
  const mod = spec.modules.find((m) => m.id === ent.module);
  const wf = E.workflowOf(spec, ent);
  const cols = ent.list.columns;
  const rows = rowsFor(ent);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  ui.page = Math.min(ui.page, pages);
  const shown = rows.slice((ui.page - 1) * PAGE, ui.page * PAGE);
  const sort = ui.sort ?? ent.list.sort;
  const chip = (id, label) => `<button class="c-chip" type="button" data-act="chip" data-v="${id}" aria-pressed="${ui.chips.has(id)}">${icon('check')}${esc(label)} <span class="erp-count">${store.records[ent.id].map((r) => E.computeRecord(spec, ent, r)).filter((r) => (id.startsWith('flag:') ? E.flagsOf(ent, r).some((f) => 'flag:' + f.id === id) : r.status === id)).length}</span></button>`;

  const picked = [...ui.picked].map((id) => E.find(store, ent.id, id)).filter(Boolean);
  const bulk = picked.length ? (() => {
    const common = wf.transitions.filter((t) => picked.every((p) => E.transitionsFor(spec, ent, p, ui.role).some((x) => x.id === t.id && !x.blocked)) && !t.comment);
    return `<div class="erp-bulk" role="status">${icon('check')}${picked.length}건 선택됨<span class="c-spacer"></span>
      ${common.map((t) => `<button class="c-btn" data-kind="${t.kind === 'risk' ? 'risk' : 'quiet'}" type="button" data-act="bulk" data-t="${t.id}">${esc(t.label)}</button>`).join('') || '<span class="erp-hint">고른 건에 함께 할 수 있는 동작이 없습니다</span>'}
      <button class="c-btn" data-kind="quiet" type="button" data-act="unpick">선택 해제</button></div>`;
  })() : '';

  const table = shown.length ? `<div class="erp-scroll"><table class="c-table"><thead><tr>
      <th class="erp-pick"><label class="c-pick" data-shape="many" aria-label="이 쪽 전체 선택"><input type="checkbox" data-act="pickall" ${shown.every((r) => ui.picked.has(r.id)) ? 'checked' : ''}><span class="mark"></span></label></th>
      ${cols.map((c) => { const f = E.fieldOf(spec, ent.id, c); const on = sort?.field === c; return `<th class="${E.isNumeric(f) ? 'num' : ''}" aria-sort="${on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}"><button type="button" class="erp-sort" data-act="sort" data-f="${c}">${esc(f.label)}${on ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}</button></th>`; }).join('')}
    </tr></thead><tbody>
      ${shown.map((r) => `<tr data-row="${esc(r.id)}" ${ui.open === r.id ? 'aria-selected="true"' : ''}>
        <td><label class="c-pick" data-shape="many" aria-label="선택"><input type="checkbox" data-act="pick" data-id="${esc(r.id)}" ${ui.picked.has(r.id) ? 'checked' : ''}><span class="mark"></span></label></td>
        ${cols.map((c, i) => cell(ent, c, r, i === 0)).join('')}</tr>`).join('')}
    </tbody></table></div>`
    : `<div class="c-empty"><b>조건에 맞는 ${esc(ent.name)}이(가) 없습니다</b><p>검색어나 거른 조건을 지워 보세요.</p><button class="c-btn" type="button" data-act="clear">조건 지우기</button></div>`;

  const openRec = ui.open ? E.find(store, ent.id, ui.open) : null;
  return `${head(`${mod.name} · ${ent.name}`, ent.name,
    `<button class="c-btn" data-kind="quiet" type="button" data-act="csv">${icon('download')}내보내기</button>
     <button class="c-btn" data-kind="primary" type="button" data-act="new">${icon('plus')}새 ${esc(ent.name)}</button>`)}
  <main class="c-body erp-body">
    <div class="erp ${openRec ? 'has-side' : ''}">
      <div class="erp-main">
        <div class="erp-bar">
          <div class="c-search">${icon('search')}<input type="search" data-act="q" value="${esc(ui.q)}" placeholder="${esc(ent.list.search.map((f) => E.fieldOf(spec, ent.id, f).label).join(' · '))} 검색" aria-label="검색">
            ${ui.q ? `<button type="button" aria-label="지우기" data-act="qclear">${icon('x')}</button>` : ''}</div>
        </div>
        <div class="c-chips" role="group" aria-label="상태로 거르기">${wf.states.map((s) => chip(s.id, s.label)).join('')}${(ent.flags ?? []).map((f) => chip('flag:' + f.id, f.label)).join('')}</div>
        ${bulk}
        ${table}
        <div class="erp-foot"><div class="c-pager"><span class="p">${rows.length}건 중 ${rows.length ? (ui.page - 1) * PAGE + 1 : 0}–${Math.min(ui.page * PAGE, rows.length)}</span>
          <button type="button" data-act="page" data-p="${ui.page - 1}" ${ui.page <= 1 ? 'disabled' : ''} aria-label="이전">${icon('left')}</button>
          ${Array.from({ length: pages }, (_, i) => `<button type="button" data-act="page" data-p="${i + 1}" ${i + 1 === ui.page ? 'aria-current="page"' : ''}>${i + 1}</button>`).join('')}
          <button type="button" data-act="page" data-p="${ui.page + 1}" ${ui.page >= pages ? 'disabled' : ''} aria-label="다음">${icon('right')}</button></div>
          <span class="c-spacer"></span><button class="c-btn" data-kind="quiet" type="button" data-act="reset">${icon('reset')}시안 데이터 되돌리기</button></div>
      </div>
      ${openRec ? detail(ent, openRec) : ''}
    </div>
  </main>`;
}

function cell(ent, c, r, first) {
  const f = E.fieldOf(spec, ent.id, c);
  if (c === 'status') {
    const flags = E.flagsOf(ent, r).map((fl) => ` <span class="c-badge" data-tone="${fl.tone}">${esc(fl.label)}</span>`).join('');
    return `<td>${stateTag(E.stateOf(spec, ent, r))}${flags}</td>`;
  }
  const v = esc(E.display(store, ent.id, c, r));
  if (first) return `<td><a href="#/e/${ent.id}/${encodeURIComponent(r.id)}" class="erp-key">${v}</a></td>`;
  if (c === 'stock' && E.flagsOf(ent, r).length) return `<td class="num"><b class="erp-warn">${v}</b></td>`;
  return `<td class="${E.isNumeric(f) ? 'num' : ''}">${v}</td>`;
}

function steps(spec, ent, rec) {
  const wf = E.workflowOf(spec, ent);
  const st = E.stateOf(spec, ent, rec);
  // 진행 단계는 «정상 경로»만 보인다. 반려·취소 같은 끝(위험 톤 final)은 지금 그 상태일 때만 보인다.
  const path = wf.states.filter((s) => !(s.final && s.tone === 'risk') || s.id === st.id).filter((s) => !(s.final && s.tone === 'idle' && s.id !== st.id));
  const at = path.findIndex((s) => s.id === st.id);
  return `<div class="c-steps">${path.map((s, i) => `<span class="c-step" ${i < at ? 'data-state="done"' : i === at ? 'data-state="now"' : ''}>${esc(s.label)}</span>`).join('')}</div>`;
}

function detail(ent, rec) {
  const full = E.computeRecord(spec, ent, rec);
  const st = E.stateOf(spec, ent, rec);
  const ts = E.transitionsFor(spec, ent, rec, ui.role);
  const facts = ent.fields.filter((f) => f.type !== 'lines' && f.type !== 'longtext').map((f) => `<div><dt>${esc(f.label)}</dt><dd>${esc(E.display(store, ent.id, f.id, full))}</dd></div>`).join('');
  const long = ent.fields.filter((f) => f.type === 'longtext' && full[f.id]).map((f) => `<p class="c-note"><b>${esc(f.label)}</b> · ${esc(full[f.id])}</p>`).join('');
  const lines = ent.fields.filter((f) => f.type === 'lines').map((f) => {
    const ls = full[f.id] ?? [];
    const amount = f.columns.some((c) => c.id === 'qty') && f.columns.some((c) => c.id === 'price');
    return `<div class="erp-lines"><span class="erp-sub">${esc(f.label)} ${ls.length}줄</span>${ls.length ? `<table class="c-table"><thead><tr>${f.columns.map((c) => `<th class="${E.isNumeric(c) ? 'num' : ''}">${esc(c.label)}</th>`).join('')}${amount ? '<th class="num">금액</th>' : ''}</tr></thead><tbody>
      ${ls.map((l) => `<tr>${f.columns.map((c) => `<td class="${E.isNumeric(c) ? 'num' : ''}">${esc(c.type === 'ref' ? refName(c.ref, l[c.id]) : E.isNumeric(c) ? Number(l[c.id] ?? 0).toLocaleString('ko-KR') : l[c.id])}</td>`).join('')}${amount ? `<td class="num">${(Number(l.qty) * Number(l.price)).toLocaleString('ko-KR')}</td>` : ''}</tr>`).join('')}
      </tbody></table>` : '<p class="c-note">줄이 없습니다.</p>'}</div>`;
  }).join('');
  const editable = E.canEdit(spec, ent, rec);
  return `<aside class="erp-side" aria-label="${esc(ent.name)} 상세">
    <div class="erp-side-head"><div class="erp-side-top"><span class="c-where">${esc(ent.name)}</span><button class="c-btn" data-kind="quiet" type="button" data-act="close" aria-label="닫기">${icon('x')}</button></div>
      <span class="nm">${esc(E.display(store, ent.id, ent.title_field, full))}</span>
      <span class="sub">${esc((ent.subtitle_fields ?? []).map((f) => E.display(store, ent.id, f, full)).join(' · '))}</span>
      <div class="erp-inline">${stateTag(st)}${E.flagsOf(ent, full).map((fl) => `<span class="c-badge" data-tone="${fl.tone}">${esc(fl.label)}</span>`).join('')}</div></div>
    ${ent.kind !== 'master' ? steps(spec, ent, rec) : ''}
    ${ts.length || editable ? `<div class="erp-acts">${ts.map((t) => actionBtn(ent, rec, t)).join('')}${editable ? `<button class="c-btn" data-kind="quiet" type="button" data-act="edit" data-id="${esc(rec.id)}">고치기</button>` : ''}</div>` : `<p class="c-note">${icon('lock')} ${esc(person().name)} 역할로 이 상태에서 할 수 있는 동작이 없습니다.</p>`}
    ${ts.filter((t) => t.blocked).map((t) => `<div class="c-note-box" data-tone="warn">${icon('lock')}<span><b>${esc(t.label)}</b> 불가 — ${esc(t.blocked)}</span></div>`).join('')}
    <dl class="c-facts">${facts}</dl>
    ${long}
    ${lines}
    <details class="c-fold" open><summary><svg class="c-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>이력 ${rec.history.length}건</summary>
      <div class="c-timeline">${[...rec.history].reverse().map((h) => `<div class="c-tl" ${h.tone ? `data-tone="${h.tone}"` : ''}><span class="dot"></span><div><div class="when">${esc(h.at)} · ${esc(h.by)}</div><div class="what">${esc(h.what)}</div>${h.note ? `<div class="said">${esc(h.note)}</div>` : ''}</div></div>`).join('')}</div></details>
  </aside>`;
}

function refName(entId, id) {
  const t = E.find(store, entId, id);
  return t ? t[E.entityOf(spec, entId).title_field] : id;
}

/* ── 입력 대화상자 ──────────────────────────────────────────────────────── */

function inputFor(ent, f, v, err) {
  const id = `f-${f.id}`;
  const req = f.required ? ' <b class="erp-req" aria-label="필수">*</b>' : '';
  const errHtml = err ? `<span class="c-err" id="${id}-e">${esc(err)}</span>` : f.help ? `<span class="c-note">${esc(f.help)}</span>` : '';
  const aria = `${err ? `aria-invalid="true" aria-describedby="${id}-e"` : ''}`;
  let control;
  if (f.type === 'enum') control = `<select class="c-select" id="${id}" name="${f.id}" ${aria}><option value="">고르세요</option>${f.options.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  else if (f.type === 'ref') control = `<select class="c-select" id="${id}" name="${f.id}" ${aria}><option value="">고르세요</option>${store.records[f.ref].filter((r) => r.status !== 'inactive').map((r) => `<option value="${esc(r.id)}" ${r.id === v ? 'selected' : ''}>${esc(refName(f.ref, r.id))} · ${esc(r.id)}</option>`).join('')}</select>`;
  else if (f.type === 'user') control = `<select class="c-select" id="${id}" name="${f.id}" ${aria}><option value="">—</option>${store.records.employee.map((r) => `<option ${r.name === v ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>`;
  else if (f.type === 'longtext') control = `<textarea class="c-area" id="${id}" name="${f.id}" rows="2" ${aria}>${esc(v ?? '')}</textarea>`;
  else control = `<input class="c-input" id="${id}" name="${f.id}" ${aria} type="${f.type === 'date' ? 'date' : ['number', 'money', 'percent'].includes(f.type) ? 'number' : 'text'}" ${f.type === 'number' ? 'step="any"' : ''} value="${esc(v ?? '')}">`;
  return `<label class="c-field ${f.type === 'longtext' ? 'erp-wide' : ''}" ${err ? 'data-invalid="true"' : ''}><span>${esc(f.label)}${req}</span>${control}${errHtml}</label>`;
}

function linesEditor(f, lines, err) {
  return `<fieldset class="erp-wide erp-lineset"><legend class="erp-sub">${esc(f.label)}</legend>
    ${lines.map((l, i) => `<div class="erp-line">${f.columns.map((c) => {
      const name = `${f.id}.${i}.${c.id}`;
      if (c.type === 'ref') return `<select class="c-select" name="${name}" aria-label="${esc(c.label)}"><option value="">${esc(c.label)}</option>${store.records[c.ref].map((r) => `<option value="${esc(r.id)}" ${r.id === l[c.id] ? 'selected' : ''}>${esc(refName(c.ref, r.id))}</option>`).join('')}</select>`;
      if (c.type === 'enum') return `<select class="c-select" name="${name}" aria-label="${esc(c.label)}"><option value="">${esc(c.label)}</option>${c.options.map((o) => `<option ${o === l[c.id] ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
      return `<input class="c-input" type="number" step="any" name="${name}" placeholder="${esc(c.label)}" aria-label="${esc(c.label)}" value="${esc(l[c.id] ?? '')}">`;
    }).join('')}<button class="c-btn" data-kind="quiet" type="button" data-act="line-del" data-i="${i}" aria-label="${i + 1}번째 줄 지우기">${icon('x')}</button></div>`).join('')}
    <button class="c-btn" data-kind="quiet" type="button" data-act="line-add">${icon('plus')}줄 더하기</button>
    ${err ? `<span class="c-err">${esc(err)}</span>` : ''}</fieldset>`;
}

let form = null; // { ent, id, values, errors }

function openForm(ent, rec) {
  const values = {};
  for (const f of ent.fields) if (f.type !== 'computed' && !f.readonly) values[f.id] = rec ? E.clone(rec[f.id] ?? (f.type === 'lines' ? [] : '')) : f.type === 'lines' ? [{}] : f.type === 'date' ? store.today : f.type === 'user' ? person().person : '';
  form = { ent, id: rec?.id ?? null, values, errors: {} };
  drawForm();
  document.getElementById('erp-dialog').showModal();
}

function readForm() {
  const dlg = document.getElementById('erp-dialog');
  for (const el of dlg.querySelectorAll('[name]')) {
    const [fid, i, col] = el.name.split('.');
    const f = form.ent.fields.find((x) => x.id === fid);
    const cast = (type, v) => (v === '' ? '' : ['number', 'money', 'percent'].includes(type) ? Number(v) : v);
    if (i !== undefined) { const c = f.columns.find((x) => x.id === col); form.values[fid][Number(i)][col] = cast(c.type, el.value); }
    else form.values[fid] = cast(f.type, el.value);
  }
  for (const f of form.ent.fields.filter((x) => x.type === 'lines')) form.values[f.id] = form.values[f.id].filter((l) => Object.values(l).some((v) => v !== '' && v !== undefined));
}

function drawForm() {
  const { ent, values, errors, id } = form;
  const dlg = document.getElementById('erp-dialog');
  const preview = E.computeRecord(spec, ent, values);
  const totals = ent.fields.filter((f) => f.type === 'computed').map((f) => `<div><dt>${esc(f.label)}</dt><dd>${Number(preview[f.id] ?? 0).toLocaleString('ko-KR')}</dd></div>`).join('');
  const no = ent.kind === 'master' ? '' : id ?? E.nextNumber(store, ent, values.date ?? values.start);
  dlg.innerHTML = `<form class="c-dialog-in erp-form" method="dialog" novalidate>
    <h3>${id ? `${esc(ent.name)} 고치기` : `새 ${esc(ent.name)}`}${no ? ` · <span class="erp-mono">${esc(no)}</span>` : ''}</h3>
    ${errors._ ? `<div class="c-note-box" data-tone="risk">${esc(errors._)}</div>` : ''}
    <div class="erp-grid">${ent.fields.filter((f) => f.type !== 'computed' && !f.readonly).map((f) => (f.type === 'lines' ? linesEditor(f, values[f.id].length ? values[f.id] : [{}], errors[f.id]) : inputFor(ent, f, values[f.id], errors[f.id]))).join('')}</div>
    ${totals ? `<dl class="c-facts">${totals}</dl>` : ''}
    <div class="c-actions"><span class="c-spacer"></span>
      <button class="c-btn" data-kind="quiet" type="button" data-act="form-cancel">그만두기</button>
      <button class="c-btn" data-kind="primary" type="button" data-act="form-save">${id ? '저장' : '작성'}</button></div></form>`;
  if (!values[ent.fields.find((f) => f.type === 'lines')?.id]?.length) for (const f of ent.fields.filter((x) => x.type === 'lines')) values[f.id] = [{}];
}

/* ── 사건 ───────────────────────────────────────────────────────────────── */

function toast(root, msg) { ui.toast = msg; render(root); clearTimeout(toast.t); toast.t = setTimeout(() => { ui.toast = ''; const d = root.querySelector('.erp-toast-dock'); if (d) d.innerHTML = ''; }, 2600); }

function doTransition(root, entId, id, tId) {
  const ent = E.entityOf(spec, entId);
  const rec = E.find(store, entId, id);
  const t = E.transitionsFor(spec, ent, rec, ui.role).find((x) => x.id === tId);
  if (!t) return;
  if (t.confirm || t.comment) return confirmBox(root, ent, rec, t);
  finish(root, ent, rec, t);
}

function finish(root, ent, rec, t, comment) {
  const res = E.applyTransition(store, ent.id, rec.id, t.id, { role: ui.role, by: person().person, at: now(), comment });
  if (!res.ok) return toast(root, res.error);
  save();
  toast(root, `${rec.no ?? rec.id} · ${t.label} 완료${res.changes ? ` (재고 등 ${res.changes}건 반영)` : ''}`);
}

function confirmBox(root, ent, rec, t) {
  const dlg = document.getElementById('erp-dialog');
  form = null;
  dlg.innerHTML = `<form class="c-dialog-in" method="dialog"><h3>${esc(rec.no ?? rec.id)} · ${esc(t.label)}할까요?</h3>
    ${t.confirm ? `<p>${esc(t.confirm)}</p>` : ''}
    ${t.comment ? `<label class="c-field"><span>사유 <b class="erp-req" aria-label="필수">*</b></span><textarea class="c-area" rows="2" id="erp-comment"></textarea></label>` : ''}
    <div class="c-actions"><span class="c-spacer"></span><button class="c-btn" data-kind="quiet" type="button" data-act="form-cancel">그만두기</button>
    <button class="c-btn" data-kind="${t.kind === 'risk' ? 'risk' : 'primary'}" type="button" data-act="confirm" data-ent="${ent.id}" data-id="${esc(rec.id)}" data-t="${t.id}">${esc(t.label)}</button></div></form>`;
  dlg.showModal();
}

function onClick(ev, root) {
  const el = ev.target.closest('[data-act]');
  const r = route();
  if (!el) {
    const tr = ev.target.closest('tr[data-row]');
    if (tr && !ev.target.closest('a,label,button,input')) { location.hash = `#/e/${r.ent}/${encodeURIComponent(tr.dataset.row)}`; }
    return;
  }
  const act = el.dataset.act;
  const ent = r.ent ? E.entityOf(spec, r.ent) : null;
  if (act === 'go') doTransition(root, el.dataset.ent, el.dataset.id, el.dataset.t);
  else if (act === 'confirm') {
    const comment = document.getElementById('erp-comment')?.value;
    const e2 = E.entityOf(spec, el.dataset.ent); const rec = E.find(store, e2.id, el.dataset.id);
    const t = E.transitionsFor(spec, e2, rec, ui.role).find((x) => x.id === el.dataset.t);
    if (t.comment && !String(comment ?? '').trim()) { document.getElementById('erp-comment').focus(); return; }
    document.getElementById('erp-dialog').close(); finish(root, e2, rec, t, comment);
  }
  else if (act === 'chip') { const v = el.dataset.v; ui.chips.has(v) ? ui.chips.delete(v) : ui.chips.add(v); ui.page = 1; render(root); }
  else if (act === 'sort') { const f = el.dataset.f; const cur = ui.sort ?? ent.list.sort; ui.sort = { field: f, dir: cur.field === f && cur.dir === 'asc' ? 'desc' : 'asc' }; render(root); }
  else if (act === 'page') { ui.page = Number(el.dataset.p); render(root); }
  else if (act === 'qclear' || act === 'clear') { ui.q = ''; ui.chips.clear(); render(root); }
  else if (act === 'close') { location.hash = `#/e/${r.ent}`; }
  else if (act === 'unpick') { ui.picked.clear(); render(root); }
  else if (act === 'bulk') {
    let ok = 0; const fails = [];
    for (const id of ui.picked) { const res = E.applyTransition(store, ent.id, id, el.dataset.t, { role: ui.role, by: person().person, at: now() }); res.ok ? ok++ : fails.push(`${id}: ${res.error}`); }
    ui.picked.clear(); save(); toast(root, `${ok}건 처리${fails.length ? ` · ${fails.length}건 실패 (${fails[0]})` : ''}`);
  }
  else if (act === 'new') openForm(ent, null);
  else if (act === 'edit') openForm(ent, E.find(store, ent.id, el.dataset.id));
  else if (act === 'form-cancel') { document.getElementById('erp-dialog').close(); form = null; }
  else if (act === 'line-add' || act === 'line-del') {
    readForm(); const lf = form.ent.fields.find((f) => f.type === 'lines');
    if (act === 'line-add') form.values[lf.id].push({}); else form.values[lf.id].splice(Number(el.dataset.i), 1);
    drawForm();
  }
  else if (act === 'form-save') {
    readForm();
    const meta = { by: person().person, at: now() };
    const res = form.id ? E.updateRecord(store, form.ent.id, form.id, form.values, meta) : E.createRecord(store, form.ent.id, form.values, meta);
    if (!res.ok) { form.errors = res.errors; drawForm(); document.querySelector('#erp-dialog [aria-invalid="true"]')?.focus(); return; }
    document.getElementById('erp-dialog').close(); save();
    const id = res.record.id; form = null;
    location.hash = `#/e/${ent.id}/${encodeURIComponent(id)}`; ui.open = id; toast(root, `${id} 저장했습니다`);
  }
  else if (act === 'csv') {
    const cols = ent.list.columns; const rows = rowsFor(ent);
    const csv = [cols.map((c) => E.fieldOf(spec, ent.id, c).label), ...rows.map((rw) => cols.map((c) => E.display(store, ent.id, c, rw)))].map((line) => line.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = `${ent.name}-${store.today}.csv`; a.click();
  }
  else if (act === 'reset') { store = E.createStore(spec, seed); try { localStorage.removeItem(KEY); } catch {} toast(root, '시안 데이터를 처음으로 되돌렸습니다'); }
}

function onInput(ev, root) {
  if (ev.target.dataset.act === 'q') { ui.q = ev.target.value; ui.page = 1; render(root); const i = root.querySelector('[data-act="q"]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  else if (form && ev.target.closest('#erp-dialog') && /\.(qty|price|debit|credit)$|^supply$/.test(ev.target.name ?? '')) {
    readForm(); const p = E.computeRecord(spec, form.ent, form.values);
    const dds = document.querySelectorAll('#erp-dialog .c-facts dd');
    form.ent.fields.filter((f) => f.type === 'computed').forEach((f, i) => { if (dds[i]) dds[i].textContent = Number(p[f.id] ?? 0).toLocaleString('ko-KR'); });
    for (const f of form.ent.fields.filter((x) => x.type === 'lines')) if (!form.values[f.id].length) form.values[f.id] = [{}];
  }
}

function onChange(ev, root) {
  const act = ev.target.dataset.act;
  if (act === 'role') { ui.role = ev.target.value; try { localStorage.setItem(KEY + ':role', ui.role); } catch {} render(root); }
  else if (act === 'goto') location.hash = ev.target.value;
  else if (act === 'pick') { const id = ev.target.dataset.id; ev.target.checked ? ui.picked.add(id) : ui.picked.delete(id); render(root); }
  else if (act === 'pickall') {
    const ent = E.entityOf(spec, route().ent); const rows = rowsFor(ent).slice((ui.page - 1) * PAGE, ui.page * PAGE);
    rows.forEach((r) => (ev.target.checked ? ui.picked.add(r.id) : ui.picked.delete(r.id))); render(root);
  }
}
