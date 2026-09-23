// ERP 플랫폼 시연 2 — 같은 명세(../erp.spec.json)·같은 엔진(../erp-engine.js), 화면만 새로 짰다.
// 시연 1이 «규격이 돈다»를 보였다면, 시연 2는 «매일 열고 싶은 업무 화면»을 노린다:
// 오늘 브리핑 · 한 번에 처리하는 할 일 · 실데이터 차트 · 칸반 보드(끌어서 상태 전이) · ⌘K 명령창 · 밀려 나오는 상세.
// 색·글자·모서리는 claude-v1 토큰만 쓴다. 업무별 분기 없이 명세만 읽는다.
import * as E from '../erp-engine.js';

const P = {
  home: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  handshake: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  'shopping-cart': '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  package: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 8.7 5 8.7-5"/>',
  landmark: '<path d="M3 22h18"/><path d="M6 18v-7"/><path d="M10 18v-7"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="m12 2 8 5H4z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  spark: '<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/>',
  board: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/>',
  table: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'
};
const icon = (n) => `<svg class="c-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] ?? ''}</svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = (v) => Number(v ?? 0).toLocaleString('ko-KR');
const man = (v) => (Math.abs(v) >= 1e8 ? `${(v / 1e8).toFixed(1)}억` : `${Math.round(v / 1e4).toLocaleString('ko-KR')}만`);
const KEY = 'erp-platform:v2';

let spec, seed, store, root;
const ui = { role: 'manager', q: '', chips: new Set(), view: 'board', tab: 'info', toast: '', drag: null };

export async function boot(el, { specData, seedData } = {}) {
  root = el;
  spec = specData ?? await (await fetch('../erp.spec.json')).json();
  seed = seedData ?? await (await fetch('../erp.seed.json')).json();
  store = E.createStore(spec, seed);
  try { const s = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (s?.version === spec.version) store.records = s.records; } catch {}
  try { ui.role = localStorage.getItem(KEY + ':role') ?? ui.role; ui.view = localStorage.getItem(KEY + ':view') ?? ui.view; } catch {}
  addEventListener('hashchange', () => { ui.q = ''; ui.chips.clear(); ui.tab = 'info'; render(); });
  addEventListener('keydown', onKey);
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  root.addEventListener('dragstart', onDragStart);
  root.addEventListener('dragover', onDragOver);
  root.addEventListener('dragleave', (ev) => ev.target.closest?.('[data-drop]')?.removeAttribute('data-over'));
  root.addEventListener('drop', onDrop);
  root.addEventListener('pointermove', onTip);
  root.addEventListener('pointerleave', () => tip(null), true);
  render();
}

const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ version: spec.version, records: store.records })); } catch {} };
const me = () => spec.roles.find((r) => r.id === ui.role);
const route = () => { const [, a, b, c] = (location.hash || '#/home').split('/'); return { view: a || 'home', ent: b, id: c ? decodeURIComponent(c) : null }; };
const modOf = (entId) => spec.modules.find((m) => m.entities.some((e) => e.id === entId));
const stateTag = (st) => `<span class="c-state" data-tone="${st.tone}">${esc(st.label)}</span>`;
const title = (ent, rec) => E.display(store, ent.id, ent.title_field, E.computeRecord(spec, ent, rec));
const sub = (ent, rec) => { const f = E.computeRecord(spec, ent, rec); return (ent.subtitle_fields ?? []).map((k) => E.display(store, ent.id, k, f)).join(' · '); };
const link = (ent, rec) => `#/e/${ent.id}/${encodeURIComponent(rec.id)}`;

/* ── 뼈대 ───────────────────────────────────────────────────────────────── */

function render() {
  const r = route();
  const inbox = E.approvalsFor(store, ui.role).length;
  const curMod = r.view === 'e' ? modOf(r.ent) : null;
  const rail = `
    <nav class="x-rail" aria-label="모듈">
      <a class="x-logo" href="#/home" aria-label="${esc(spec.company.name)} 홈">한</a>
      <a class="x-ri" href="#/home" ${r.view === 'home' ? 'aria-current="page"' : ''}>${icon('home')}<span>홈</span></a>
      <a class="x-ri" href="#/inbox" ${r.view === 'inbox' ? 'aria-current="page"' : ''}>${icon('inbox')}<span>결재함</span>${inbox ? `<b class="x-dot" aria-label="${inbox}건">${inbox}</b>` : ''}</a>
      <span class="x-rsep" aria-hidden="true"></span>
      ${spec.modules.map((m) => `<a class="x-ri" href="#/e/${m.entities.find((e) => e.kind !== 'master')?.id ?? m.entities[0].id}" ${curMod?.id === m.id ? 'aria-current="page"' : ''}>${icon(m.icon)}<span>${esc(m.name)}</span></a>`).join('')}
    </nav>`;
  const tabs = curMod ? `<nav class="x-subnav" aria-label="${esc(curMod.name)}">${curMod.entities.map((e) => `<a href="#/e/${e.id}" ${e.id === r.ent ? 'aria-current="page"' : ''}>${esc(e.name)}<span class="x-n">${store.records[e.id].length}</span></a>`).join('')}</nav>` : '';
  const ent = r.view === 'e' ? E.entityOf(spec, r.ent) : null;
  const top = `
    <header class="x-top">
      <div class="x-where">${r.view === 'home' ? esc(spec.company.name) : r.view === 'inbox' ? '전자결재' : esc(curMod.name)}</div>
      <button class="x-cmd" type="button" data-act="palette">${icon('search')}<span>문서·거래처·품목 찾기, 명령 실행</span><kbd>⌘K</kbd></button>
      <div class="x-roles" role="group" aria-label="역할 바꿔 보기">${spec.roles.map((x) => `<button type="button" class="x-role" data-act="role" data-v="${x.id}" aria-pressed="${x.id === ui.role}" title="${esc(x.person)} · ${esc(x.dept)}"><span class="c-avatar" aria-hidden="true">${esc(x.person[0])}</span><span class="x-rn">${esc(x.name)}</span></button>`).join('')}</div>
      ${ent ? `<button class="c-btn" data-kind="primary" type="button" data-act="new">${icon('plus')}새 ${esc(ent.name)}</button>` : ''}
    </header>`;
  const body = r.view === 'inbox' ? viewInbox() : ent ? viewEntity(ent, r) : viewHome();
  root.innerHTML = `<div class="x-app">${rail}<div class="x-main">${top}${tabs}<main class="x-body">${body}</main></div></div>
    ${ent && r.id && E.find(store, ent.id, r.id) ? drawer(ent, E.find(store, ent.id, r.id)) : ''}
    <dialog class="c-dialog x-dialog" id="x-dialog"></dialog>
    <dialog class="c-dialog x-pal" id="x-pal" aria-label="명령창"></dialog>
    <div class="x-tip" id="x-tip" role="tooltip" hidden></div>
    <div class="x-toast" role="status" aria-live="polite">${ui.toast ? `<span class="c-toast">${icon('check')}${esc(ui.toast)}</span>` : ''}</div>`;
}

/* ── 홈: 오늘 브리핑 ────────────────────────────────────────────────────── */

function todos() {
  const out = [];
  for (const { ent, rec, transitions } of E.approvalsFor(store, ui.role)) {
    out.push({ kind: 'approval', tone: 'warn', icon: 'inbox', ent, rec, head: `${ent.name} 결재`, transitions });
  }
  for (const ent of E.entities(spec)) {
    for (const rec of store.records[ent.id]) {
      const st = E.stateOf(spec, ent, rec);
      if (st.tone !== 'risk' || st.final) continue;
      const ts = E.transitionsFor(spec, ent, rec, ui.role).filter((t) => t.kind === 'primary' && !t.blocked);
      out.push({ kind: 'risk', tone: 'risk', icon: 'alert', ent, rec, head: `${ent.name} ${st.label}`, transitions: ts });
    }
  }
  for (const { sug, rec } of E.suggestionsFor(store, ui.role)) {
    const ent = E.entityOf(spec, sug.source);
    out.push({ kind: 'suggest', tone: 'accent', icon: 'spark', ent, rec, head: '제안', sug });
  }
  return out;
}

function viewHome() {
  const t = todos();
  const nA = t.filter((x) => x.kind === 'approval').length, nR = t.filter((x) => x.kind === 'risk').length, nS = t.filter((x) => x.kind === 'suggest').length;
  const brief = [nA && `<a href="#/inbox">결재 ${nA}건</a>`, nR && `<a href="#todo">위험 ${nR}건</a>`, nS && `<a href="#todo">제안 ${nS}건</a>`].filter(Boolean);
  const d = new Date(store.today + 'T09:00:00');
  const dateLabel = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${'일월화수목금토'[d.getDay()]}요일`;
  const kpis = spec.dashboard.metrics.map((m) => {
    const v = E.metricValue(store, m, ui.role);
    const trend = m.trend ? spark(E.monthlySeries(store, spec.dashboard.charts.find((c) => c.id === m.trend))) : '';
    const big = m.unit === '원' ? `${man(v)}<small>원</small>` : `${won(v)}<small>${esc(m.unit)}</small>`;
    const toneOn = m.tone && v > 0;
    return `<div class="x-kpi" ${toneOn ? `data-tone="${m.tone}"` : ''}><span class="k">${toneOn ? icon(m.tone === 'risk' ? 'alert' : 'inbox') : ''}${esc(m.label)}</span><span class="v">${big}</span>${trend || `<span class="s">${esc(kpiNote(m, v))}</span>`}</div>`;
  }).join('');
  const charts = spec.dashboard.charts;
  return `
  <section class="x-hero">
    <p class="x-date">${dateLabel}</p>
    <h1>좋은 하루예요, ${esc(me().person)}님</h1>
    <p class="x-brief">${brief.length ? `오늘 ${brief.join(', ')}이 기다리고 있어요.` : '오늘 처리할 일이 모두 끝났어요.'}</p>
  </section>
  <div class="x-kpis">${kpis}</div>
  <div class="x-grid">
    <section class="x-card x-span2" aria-labelledby="c-trend"><header><h2 id="c-trend">${esc(charts[0].title)}</h2><span class="x-meta">최근 ${charts[0].months}개월 · 승인 이후 기준 · 단위 원</span></header>${barChart(charts[0])}</section>
    <section class="x-card x-todo" id="todo" aria-labelledby="c-todo"><header><h2 id="c-todo">할 일</h2><span class="x-meta">${t.length}건</span></header>
      ${t.length ? `<ul class="x-feed">${mix(t, 8).map(todoItem).join('')}</ul>${t.length > 8 ? `<a class="x-more" href="#/inbox">결재함에서 모두 보기</a>` : ''}` : '<p class="c-note">모두 처리했어요.</p>'}</section>
    <section class="x-card" aria-labelledby="c-pipe"><header><h2 id="c-pipe">${esc(charts[1].title)}</h2><span class="x-meta">진행 중 금액</span></header>${pipeline(charts[1])}</section>
    <section class="x-card" aria-labelledby="c-stock"><header><h2 id="c-stock">${esc(charts[2].title)}</h2><span class="x-meta">안전재고 대비</span></header>${targetBars(charts[2])}</section>
    <section class="x-card" aria-labelledby="c-act"><header><h2 id="c-act">최근 활동</h2></header>${activity()}</section>
  </div>`;
}

/** 종류별로 돌아가며 뽑는다 — 결재가 많아도 위험·제안이 묻히지 않게. */
function mix(list, n) {
  const groups = ['approval', 'risk', 'suggest'].map((k) => list.filter((x) => x.kind === k));
  const out = [];
  for (let i = 0; out.length < n && groups.some((g) => g.length > i); i++) for (const g of groups) if (g[i] && out.length < n) out.push(g[i]);
  return out.sort((a, b) => ['approval', 'risk', 'suggest'].indexOf(a.kind) - ['approval', 'risk', 'suggest'].indexOf(b.kind));
}

/** 지표 아래 한 줄 — 숫자 뒤의 «무엇»을 이름으로 보여 준다. 명세의 where 로만 고른다. */
function kpiNote(m, v) {
  if (!v) return '없음';
  if (m.agg === 'approvals') { const a = E.approvalsFor(store, ui.role); return `가장 오래된 건 ${a[0].rec.updated_at} · ${a[0].ent.name}`; }
  const ent = E.entityOf(spec, m.entity);
  const rows = store.records[ent.id].map((r) => E.computeRecord(spec, ent, r)).filter((r) => E.matchWhere(r, m.where, store.today));
  const names = rows.slice(0, 2).map((r) => E.display(store, ent.id, ent.kind === 'master' ? ent.title_field : (ent.subtitle_fields ?? [ent.title_field])[0], r));
  return `${m.unit === '원' ? `${won(v)}원 · ` : ''}${names.join(', ')}${rows.length > 2 ? ` 외 ${rows.length - 2}` : ''}`;
}

function todoItem(x) {
  const full = E.computeRecord(spec, x.ent, x.rec);
  const amount = full.total ?? full.debit_total;
  let acts = '';
  if (x.kind === 'suggest') acts = `<button class="c-btn" type="button" data-act="suggest" data-s="${x.sug.id}" data-id="${esc(x.rec.id)}">${icon('spark')}${esc(x.sug.label)}</button>`;
  else acts = (x.transitions ?? []).map((t) => `<button class="c-btn" type="button" ${t.kind === 'risk' ? 'data-kind="risk"' : t.kind === 'quiet' ? 'data-kind="quiet"' : ''} data-act="go" data-ent="${x.ent.id}" data-id="${esc(x.rec.id)}" data-t="${t.id}">${esc(t.label)}</button>`).join('');
  const line = x.kind === 'suggest'
    ? `${esc(x.rec.name)} · 재고 ${won(x.rec.stock)} / 안전 ${won(x.rec.safety_stock)} ${esc(x.rec.unit)}`
    : `<a href="${link(x.ent, x.rec)}">${esc(title(x.ent, x.rec))}</a> · ${esc(sub(x.ent, x.rec).split(' · ')[0])}${amount !== undefined ? ` · ${won(amount)}원` : ''}`;
  return `<li class="x-fi" data-tone="${x.tone}"><span class="x-fic" aria-hidden="true">${icon(x.icon)}</span>
    <div class="x-fb"><span class="x-fh">${esc(x.head)}</span><span class="x-fl">${line}</span></div><div class="x-fa">${acts}</div></li>`;
}

/* 차트 — 한 계열은 강조색 하나. 진행 중인 달은 옅은 면 + «진행 중» 글자(색 하나로 말하지 않는다). */
function barChart(chart) {
  const data = E.monthlySeries(store, chart);
  const W = 640, H = 220, L = 44, B = 28, T = 18;
  const max = Math.max(...data.map((d) => d.value), 1);
  const step = Math.pow(10, Math.floor(Math.log10(max))) * (max / Math.pow(10, Math.floor(Math.log10(max))) > 5 ? 2 : 1);
  const top = Math.ceil(max / step) * step;
  const y = (v) => T + (H - T - B) * (1 - v / top);
  const bw = (W - L) / data.length;
  const peak = data.reduce((a, d, i) => (d.value > data[a].value ? i : a), 0);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const bars = data.map((d, i) => {
    const x = L + i * bw + bw * 0.22, w = bw * 0.56, h = Math.max(0, y(0) - y(d.value)), r = Math.min(4, h);
    const cur = i === data.length - 1;
    const path = h ? `M${x},${y(0)} V${y(d.value) + r} Q${x},${y(d.value)} ${x + r},${y(d.value)} H${x + w - r} Q${x + w},${y(d.value)} ${x + w},${y(d.value) + r} V${y(0)} Z` : '';
    const label = i === peak || cur ? `<text class="x-vl" x="${x + w / 2}" y="${y(d.value) - 6}" text-anchor="middle">${man(d.value)}${cur ? ' · 진행 중' : ''}</text>` : '';
    return `<g class="x-bar ${cur ? 'is-cur' : ''}" data-tip="${Number(d.month.slice(5))}월 수주 ${won(d.value)}원${cur ? ' (이번 달, 진행 중)' : ''}">
      <rect class="x-hit" x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}"/>${h ? `<path d="${path}"/>` : ''}${label}
      <text class="x-xl" x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${Number(d.month.slice(5))}월</text></g>`;
  }).join('');
  const grid = ticks.map((v) => `<line class="x-gl" x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="x-yl" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v ? man(v) : '0'}</text>`).join('');
  const table = `<table class="x-sr"><caption>${esc(chart.title)}</caption><tr><th>월</th><th>수주 금액(원)</th></tr>${data.map((d) => `<tr><td>${d.month}</td><td>${won(d.value)}</td></tr>`).join('')}</table>`;
  return `<svg class="x-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(chart.title)}: ${data.map((d) => `${Number(d.month.slice(5))}월 ${man(d.value)}원`).join(', ')}">${grid}${bars}</svg>${table}`;
}

function spark(data) {
  const W = 120, H = 32, max = Math.max(...data.map((d) => d.value), 1);
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * (W - 4) + 2},${H - 3 - (d.value / max) * (H - 6)}`);
  const last = pts.at(-1).split(',');
  return `<svg class="x-spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${pts.join(' ')}"/><circle cx="${last[0]}" cy="${last[1]}" r="3"/></svg>`;
}

function pipeline(chart) {
  const rows = E.stateBreakdown(store, chart);
  const live = rows.filter((r) => !r.state.final && r.count);
  const total = live.reduce((a, r) => a + r.value, 0) || 1;
  const ent = E.entityOf(spec, chart.entity);
  return `<div class="x-pipe" role="img" aria-label="${live.map((r) => `${r.state.label} ${r.count}건 ${man(r.value)}원`).join(', ')}">
    ${live.map((r) => `<a href="#/e/${ent.id}" class="x-seg" data-tone="${r.state.tone}" style="flex-grow:${Math.max(r.value / total, 0.06)}" data-tip="${esc(r.state.label)} · ${r.count}건 · ${won(r.value)}원"></a>`).join('')}</div>
    <ul class="x-legend">${live.map((r) => `<li data-tone="${r.state.tone}"><i aria-hidden="true"></i><span>${esc(r.state.label)}</span><b>${man(r.value)}</b><small>${r.count}건</small></li>`).join('')}</ul>
    <p class="x-meta">끝난 건: ${rows.filter((r) => r.state.final).map((r) => `${esc(r.state.label)} ${r.count}건`).join(' · ')}</p>`;
}

function targetBars(chart) {
  const rows = E.targetSeries(store, chart).sort((a, b) => a.value / a.target - b.value / b.target);
  return `<ul class="x-tg">${rows.map((r) => {
    const pct = Math.min(r.value / (r.target * 2), 1) * 100;
    return `<li ${r.below ? 'data-tone="warn"' : ''} data-tip="${esc(r.label)} · 재고 ${won(r.value)} / 안전재고 ${won(r.target)}">
      <span class="x-tn">${esc(r.label)}</span>
      <span class="x-tv">${r.below ? `<span class="c-badge" data-tone="warn">부족</span>` : ''}${won(r.value)}<small> / ${won(r.target)}</small></span>
      <span class="x-track"><span class="x-fill" style="inline-size:${pct}%"></span><span class="x-mark" aria-hidden="true"></span></span></li>`;
  }).join('')}</ul><p class="x-meta">가운데 눈금 = 안전재고. 막대 끝 = 안전재고의 2배.</p>`;
}

function activity() {
  const all = [];
  for (const ent of E.entities(spec)) for (const rec of store.records[ent.id]) for (const h of rec.history) if (h.what !== '등록') all.push({ ent, rec, h });
  if (all.length < 6) for (const ent of E.entities(spec)) for (const rec of store.records[ent.id]) if (ent.kind !== 'master') all.push({ ent, rec, h: rec.history[0] });
  const rows = all.sort((a, b) => String(b.h.at).localeCompare(String(a.h.at))).slice(0, 6);
  return `<ul class="x-act">${rows.map(({ ent, rec, h }) => `<li><span class="c-avatar" aria-hidden="true">${esc(String(h.by)[0])}</span><div><span class="x-fl"><b>${esc(h.by)}</b> · ${esc(h.what)}</span><a class="x-meta" href="${link(ent, rec)}">${esc(ent.name)} ${esc(title(ent, rec))} · ${esc(h.at)}</a></div></li>`).join('')}</ul>`;
}

/* ── 결재함 ─────────────────────────────────────────────────────────────── */

function viewInbox() {
  const list = E.approvalsFor(store, ui.role);
  return `<section class="x-hero x-hero-sm"><h1>결재함</h1><p class="x-brief">${esc(me().person)} · ${esc(me().name)} 역할로 처리할 문서 ${list.length}건</p></section>
    ${list.length ? `<ul class="x-feed x-feed-lg">${list.map(({ ent, rec, transitions }) => todoItem({ kind: 'approval', tone: 'warn', icon: 'inbox', ent, rec, head: `${ent.name} · ${E.stateOf(spec, ent, rec).label}`, transitions })).join('')}</ul>`
      : `<div class="c-empty"><b>결재할 문서가 없어요</b><p>위의 역할을 바꾸면 그 사람의 결재함이 보입니다.</p></div>`}`;
}

/* ── entity: 보드 · 표 ─────────────────────────────────────────────────── */

function rowsOf(ent) {
  const q = ui.q.trim().toLowerCase();
  let rows = store.records[ent.id];
  if (q) rows = rows.filter((r) => ent.list.search.some((f) => E.display(store, ent.id, f, r).toLowerCase().includes(q) || String(r[f] ?? '').toLowerCase().includes(q)));
  if (ui.chips.size) rows = rows.filter((r) => ui.chips.has(r.status));
  const s = ent.list.sort, f = E.fieldOf(spec, ent.id, s.field);
  return [...rows].map((r) => E.computeRecord(spec, ent, r)).sort((a, b) => {
    const x = E.isNumeric(f) ? Number(a[s.field] ?? 0) - Number(b[s.field] ?? 0) : String(a[s.field] ?? '').localeCompare(String(b[s.field] ?? ''), 'ko');
    return s.dir === 'desc' ? -x : x;
  });
}

function viewEntity(ent, r) {
  const wf = E.workflowOf(spec, ent);
  const canBoard = ent.kind !== 'master';
  const view = canBoard ? ui.view : 'table';
  const rows = rowsOf(ent);
  const tools = `<div class="x-tools">
      <div class="c-search">${icon('search')}<input type="search" data-act="q" value="${esc(ui.q)}" placeholder="${esc(ent.list.search.map((f) => E.fieldOf(spec, ent.id, f).label).join(' · '))}" aria-label="${esc(ent.name)} 검색"></div>
      ${view === 'table' ? `<div class="c-chips" role="group" aria-label="상태로 거르기">${wf.states.map((s) => `<button class="c-chip" type="button" data-act="chip" data-v="${s.id}" aria-pressed="${ui.chips.has(s.id)}">${icon('check')}${esc(s.label)}</button>`).join('')}</div>` : ''}
      <span class="c-spacer"></span>
      ${canBoard ? `<div class="x-seg2" role="group" aria-label="보기">${[['board', '보드'], ['table', '표']].map(([v, l]) => `<button type="button" data-act="view" data-v="${v}" aria-pressed="${view === v}">${icon(v)}${l}</button>`).join('')}</div>` : ''}
      <button class="c-btn" data-kind="quiet" type="button" data-act="csv" aria-label="CSV 내보내기">${icon('download')}</button>
    </div>`;
  const total = rows.reduce((a, x) => a + Number(x.total ?? 0), 0);
  return `<section class="x-hero x-hero-sm"><h1>${esc(ent.name)}</h1><p class="x-brief">${rows.length}건${total ? ` · 합계 ${man(total)}원` : ''} · ${esc(spec.standard.entity_kinds[ent.kind].split('.')[0])}</p></section>
    ${tools}${view === 'board' ? board(ent, wf, rows) : table(ent, rows, r.id)}`;
}

function board(ent, wf, rows) {
  return `<div class="x-board" role="list" aria-label="${esc(ent.name)} 보드 — 카드를 다른 열로 끌면 상태가 바뀝니다">${wf.states.map((s) => {
    const inCol = rows.filter((x) => x.status === s.id);
    const sum = inCol.reduce((a, x) => a + Number(x.total ?? x.debit_total ?? 0), 0);
    const shown = s.final ? inCol.slice(0, 4) : inCol;
    return `<section class="x-col" role="listitem" data-drop="${s.id}" data-tone="${s.tone}" aria-label="${esc(s.label)} ${inCol.length}건">
      <header><i aria-hidden="true"></i><h3>${esc(s.label)}</h3><span class="x-n">${inCol.length}</span>${sum ? `<span class="x-meta">${man(sum)}</span>` : ''}</header>
      <div class="x-cards">${shown.map((x) => card(ent, x)).join('')}${inCol.length > shown.length ? `<button class="x-more" type="button" data-act="chipOnly" data-v="${s.id}">+ ${inCol.length - shown.length}건 더 보기</button>` : ''}${inCol.length ? '' : '<p class="x-empty">여기로 끌어 놓기</p>'}</div></section>`;
  }).join('')}</div>`;
}

function card(ent, x) {
  const amount = x.total ?? x.debit_total ?? (x.days !== undefined ? `${x.days}일` : x.qty);
  const who = x.owner ?? (x.employee ? E.display(store, ent.id, 'employee', x) : '');
  const date = x.due ?? x.date ?? x.start;
  const flags = E.transitionsFor(spec, ent, x, ui.role).some((t) => t.approval) ? '<span class="c-badge" data-tone="warn">내 결재</span>' : '';
  return `<a class="x-card2" href="${link(ent, x)}" draggable="true" data-card="${esc(x.id)}">
    <span class="x-c1"><span class="x-no">${esc(x.no ?? x.id)}</span>${flags}</span>
    <span class="x-c2">${esc(sub(ent, x).split(' · ')[0])}</span>
    <span class="x-c3"><b>${typeof amount === 'number' ? won(amount) : esc(amount ?? '')}</b>${who ? `<span class="c-avatar" title="${esc(who)}" aria-label="담당 ${esc(who)}">${esc(String(who)[0])}</span>` : ''}</span>
    ${date ? `<span class="x-meta">${ent.fields.find((f) => f.id === (x.due ? 'due' : x.date ? 'date' : 'start'))?.label ?? ''} ${esc(date)}</span>` : ''}</a>`;
}

function table(ent, rows, openId) {
  const cols = ent.list.columns;
  return rows.length ? `<div class="x-card x-tablewrap"><table class="c-table"><thead><tr>${cols.map((c) => `<th class="${E.isNumeric(E.fieldOf(spec, ent.id, c)) ? 'num' : ''}">${esc(E.fieldOf(spec, ent.id, c).label)}</th>`).join('')}</tr></thead><tbody>
    ${rows.map((x) => `<tr data-row="${esc(x.id)}" ${openId === x.id ? 'aria-selected="true"' : ''}>${cols.map((c, i) => {
      if (c === 'status') return `<td>${stateTag(E.stateOf(spec, ent, x))}${E.flagsOf(ent, x).map((fl) => ` <span class="c-badge" data-tone="${fl.tone}">${esc(fl.label)}</span>`).join('')}</td>`;
      const v = esc(E.display(store, ent.id, c, x));
      return i === 0 ? `<td><a class="x-key" href="${link(ent, x)}">${v}</a></td>` : `<td class="${E.isNumeric(E.fieldOf(spec, ent.id, c)) ? 'num' : ''}">${v}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>`
    : `<div class="c-empty"><b>조건에 맞는 ${esc(ent.name)}이(가) 없어요</b><button class="c-btn" type="button" data-act="clear">조건 지우기</button></div>`;
}

/* ── 밀려 나오는 상세 ──────────────────────────────────────────────────── */

function drawer(ent, rec) {
  const full = E.computeRecord(spec, ent, rec);
  const st = E.stateOf(spec, ent, rec);
  const ts = E.transitionsFor(spec, ent, rec, ui.role);
  const wf = E.workflowOf(spec, ent);
  const path = wf.states.filter((s) => !(s.final && s.tone !== 'ok') || s.id === st.id);
  const at = path.findIndex((s) => s.id === st.id);
  const steps = ent.kind === 'master' ? '' : `<div class="c-steps">${path.map((s, i) => `<span class="c-step" ${i < at ? 'data-state="done"' : i === at ? 'data-state="now"' : ''}>${esc(s.label)}</span>`).join('')}</div>`;
  const linesF = ent.fields.find((f) => f.type === 'lines');
  const tabs = [['info', '개요'], ...(linesF ? [['lines', `${linesF.label} ${(full[linesF.id] ?? []).length}`]] : []), ['history', `이력 ${rec.history.length}`]];
  const tab = tabs.some(([k]) => k === ui.tab) ? ui.tab : 'info';
  let pane = '';
  if (tab === 'info') {
    pane = `<dl class="c-facts">${ent.fields.filter((f) => !['lines', 'longtext'].includes(f.type)).map((f) => `<div><dt>${esc(f.label)}</dt><dd>${f.type === 'ref' && full[f.id] ? `<a href="#/e/${f.ref}/${encodeURIComponent(full[f.id])}">${esc(E.display(store, ent.id, f.id, full))}</a>` : esc(E.display(store, ent.id, f.id, full))}</dd></div>`).join('')}</dl>
      ${ent.fields.filter((f) => f.type === 'longtext' && full[f.id]).map((f) => `<p class="c-note"><b>${esc(f.label)}</b> · ${esc(full[f.id])}</p>`).join('')}`;
  } else if (tab === 'lines') {
    const ls = full[linesF.id] ?? [];
    const amt = linesF.columns.some((c) => c.id === 'qty') && linesF.columns.some((c) => c.id === 'price');
    pane = ls.length ? `<table class="c-table"><thead><tr>${linesF.columns.map((c) => `<th class="${E.isNumeric(c) ? 'num' : ''}">${esc(c.label)}</th>`).join('')}${amt ? '<th class="num">금액</th>' : ''}</tr></thead><tbody>${ls.map((l) => `<tr>${linesF.columns.map((c) => `<td class="${E.isNumeric(c) ? 'num' : ''}">${esc(c.type === 'ref' ? (E.find(store, c.ref, l[c.id])?.name ?? l[c.id]) : E.isNumeric(c) ? won(l[c.id]) : l[c.id])}</td>`).join('')}${amt ? `<td class="num">${won(l.qty * l.price)}</td>` : ''}</tr>`).join('')}</tbody></table>
      <dl class="c-facts x-totals">${ent.fields.filter((f) => f.type === 'computed').map((f) => `<div><dt>${esc(f.label)}</dt><dd>${won(full[f.id])}</dd></div>`).join('')}</dl>` : '<p class="c-note">줄이 없어요.</p>';
  } else {
    pane = `<div class="c-timeline">${[...rec.history].reverse().map((h) => `<div class="c-tl" ${h.tone ? `data-tone="${h.tone}"` : ''}><span class="dot"></span><div><div class="when">${esc(h.at)} · ${esc(h.by)}</div><div class="what">${esc(h.what)}</div>${h.note ? `<div class="said">${esc(h.note)}</div>` : ''}</div></div>`).join('')}</div>`;
  }
  const editable = E.canEdit(spec, ent, rec);
  return `<div class="x-scrim" data-act="close"></div>
  <aside class="x-drawer" role="dialog" aria-modal="true" aria-labelledby="x-dt">
    <header class="x-dh"><span class="x-meta">${esc(modOf(ent.id).name)} · ${esc(ent.name)}</span><button class="c-btn" data-kind="quiet" type="button" data-act="close" aria-label="닫기">${icon('x')}</button></header>
    <h2 id="x-dt">${esc(title(ent, rec))}</h2>
    <p class="x-brief">${esc(sub(ent, rec))}</p>
    <div class="x-inline">${stateTag(st)}${E.flagsOf(ent, full).map((fl) => `<span class="c-badge" data-tone="${fl.tone}">${esc(fl.label)}</span>`).join('')}</div>
    ${steps}
    <div class="x-acts">${ts.map((t) => `<button class="c-btn" type="button" data-kind="${t.kind}" data-act="go" data-ent="${ent.id}" data-id="${esc(rec.id)}" data-t="${t.id}" ${t.blocked ? 'disabled' : ''}>${t.blocked ? icon('lock') : ''}${esc(t.label)}</button>`).join('')}${editable ? `<button class="c-btn" data-kind="quiet" type="button" data-act="edit" data-id="${esc(rec.id)}">고치기</button>` : ''}</div>
    ${ts.filter((t) => t.blocked).map((t) => `<div class="c-note-box" data-tone="warn">${icon('lock')}<span><b>${esc(t.label)}</b> 불가 — ${esc(t.blocked)}</span></div>`).join('')}
    ${!ts.length && !editable ? `<p class="c-note">${icon('lock')} ${esc(me().name)} 역할로 지금 할 수 있는 동작이 없어요.</p>` : ''}
    <div class="c-tabs" role="tablist">${tabs.map(([k, l]) => `<button class="c-tab" role="tab" type="button" data-act="tab" data-v="${k}" aria-selected="${k === tab}">${esc(l)}</button>`).join('')}</div>
    <div class="x-pane" role="tabpanel">${pane}</div>
  </aside>`;
}

/* ── 입력 대화상자 (명세의 필드로 그린다) ────────────────────────────────── */

let form = null;
const optRef = (entId, v) => store.records[entId].filter((r) => r.status !== 'inactive').map((r) => `<option value="${esc(r.id)}" ${r.id === v ? 'selected' : ''}>${esc(title(E.entityOf(spec, entId), r))}</option>`).join('');

function field(f, v, err) {
  const id = `f-${f.id}`;
  const aria = err ? `aria-invalid="true" aria-describedby="${id}-e"` : '';
  let c;
  if (f.type === 'enum') c = `<select class="c-select" id="${id}" name="${f.id}" ${aria}><option value="">고르세요</option>${f.options.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  else if (f.type === 'ref') c = `<select class="c-select" id="${id}" name="${f.id}" ${aria}><option value="">고르세요</option>${optRef(f.ref, v)}</select>`;
  else if (f.type === 'user') c = `<select class="c-select" id="${id}" name="${f.id}"><option value="">—</option>${store.records.employee.map((r) => `<option ${r.name === v ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>`;
  else if (f.type === 'longtext') c = `<textarea class="c-area" id="${id}" name="${f.id}" rows="2">${esc(v ?? '')}</textarea>`;
  else c = `<input class="c-input" id="${id}" name="${f.id}" ${aria} type="${f.type === 'date' ? 'date' : ['number', 'money', 'percent'].includes(f.type) ? 'number' : 'text'}" step="any" value="${esc(v ?? '')}">`;
  return `<label class="c-field ${f.type === 'longtext' ? 'x-wide' : ''}" ${err ? 'data-invalid="true"' : ''}><span>${esc(f.label)}${f.required ? ' <b class="x-req" aria-label="필수">*</b>' : ''}</span>${c}${err ? `<span class="c-err" id="${id}-e">${esc(err)}</span>` : f.help ? `<span class="c-note">${esc(f.help)}</span>` : ''}</label>`;
}

function linesField(f, lines, err) {
  return `<fieldset class="x-wide x-lines"><legend>${esc(f.label)}</legend>${lines.map((l, i) => `<div class="x-line">${f.columns.map((c) => {
    const n = `${f.id}.${i}.${c.id}`;
    if (c.type === 'ref') return `<select class="c-select" name="${n}" aria-label="${esc(c.label)}"><option value="">${esc(c.label)}</option>${optRef(c.ref, l[c.id])}</select>`;
    if (c.type === 'enum') return `<select class="c-select" name="${n}" aria-label="${esc(c.label)}"><option value="">${esc(c.label)}</option>${c.options.map((o) => `<option ${o === l[c.id] ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    return `<input class="c-input" type="number" step="any" name="${n}" placeholder="${esc(c.label)}" aria-label="${esc(c.label)}" value="${esc(l[c.id] ?? '')}">`;
  }).join('')}<button class="c-btn" data-kind="quiet" type="button" data-act="ldel" data-i="${i}" aria-label="${i + 1}번째 줄 지우기">${icon('x')}</button></div>`).join('')}
  <button class="c-btn" data-kind="quiet" type="button" data-act="ladd">${icon('plus')}줄 더하기</button>${err ? `<span class="c-err">${esc(err)}</span>` : ''}</fieldset>`;
}

function openForm(ent, rec, prefill, note) {
  const values = {};
  for (const f of ent.fields) if (f.type !== 'computed' && !f.readonly) values[f.id] = prefill?.[f.id] ?? (rec ? E.clone(rec[f.id] ?? '') : f.type === 'lines' ? [{}] : f.type === 'date' ? store.today : f.type === 'user' ? me().person : '');
  form = { ent, id: rec?.id ?? null, values, errors: {}, note };
  drawForm();
  document.getElementById('x-dialog').showModal();
}

function readForm() {
  for (const el of document.querySelectorAll('#x-dialog [name]')) {
    const [fid, i, col] = el.name.split('.');
    const f = form.ent.fields.find((x) => x.id === fid);
    const cast = (t, v) => (v === '' ? '' : ['number', 'money', 'percent'].includes(t) ? Number(v) : v);
    if (i !== undefined) form.values[fid][Number(i)][col] = cast(f.columns.find((c) => c.id === col).type, el.value);
    else form.values[fid] = cast(f.type, el.value);
  }
}

function drawForm() {
  const { ent, values, errors, id, note } = form;
  const lf = ent.fields.find((f) => f.type === 'lines');
  if (lf && !values[lf.id]?.length) values[lf.id] = [{}];
  const pv = E.computeRecord(spec, ent, values);
  const no = ent.kind === 'master' ? '' : id ?? E.nextNumber(store, ent, values.date ?? values.start);
  document.getElementById('x-dialog').innerHTML = `<form class="c-dialog-in x-form" method="dialog" novalidate>
    <h3>${id ? `${esc(ent.name)} 고치기` : `새 ${esc(ent.name)}`}${no ? ` <span class="x-meta">${esc(no)}</span>` : ''}</h3>
    ${note ? `<div class="c-note-box" data-tone="ok">${icon('spark')}<span>${esc(note)}</span></div>` : ''}
    ${errors._ ? `<div class="c-note-box" data-tone="risk">${esc(errors._)}</div>` : ''}
    <div class="x-fgrid">${ent.fields.filter((f) => f.type !== 'computed' && !f.readonly).map((f) => (f.type === 'lines' ? linesField(f, values[f.id], errors[f.id]) : field(f, values[f.id], errors[f.id]))).join('')}</div>
    ${ent.fields.some((f) => f.type === 'computed') ? `<dl class="c-facts x-totals">${ent.fields.filter((f) => f.type === 'computed').map((f) => `<div><dt>${esc(f.label)}</dt><dd>${won(pv[f.id])}</dd></div>`).join('')}</dl>` : ''}
    <div class="c-actions"><span class="c-spacer"></span><button class="c-btn" data-kind="quiet" type="button" data-act="fcancel">그만두기</button><button class="c-btn" data-kind="primary" type="button" data-act="fsave">${id ? '저장' : '작성'}</button></div></form>`;
}

/* ── 명령창 ⌘K ─────────────────────────────────────────────────────────── */

let pal = { q: '', i: 0, items: [] };
function palItems(q) {
  const s = q.trim().toLowerCase();
  const hit = (t) => !s || t.toLowerCase().includes(s);
  const go = [{ g: '이동', label: '홈 · 오늘 브리핑', href: '#/home', icon: 'home' }, { g: '이동', label: '결재함', href: '#/inbox', icon: 'inbox' },
    ...spec.modules.flatMap((m) => m.entities.map((e) => ({ g: '이동', label: `${m.name} · ${e.name}`, href: `#/e/${e.id}`, icon: m.icon })))].filter((x) => hit(x.label));
  const make = E.entities(spec).map((e) => ({ g: '만들기', label: `새 ${e.name}`, run: () => { location.hash = `#/e/${e.id}`; setTimeout(() => openForm(e, null), 0); }, icon: 'plus' })).filter((x) => s && hit(x.label));
  const docs = s ? E.entities(spec).flatMap((e) => store.records[e.id].map((r) => ({ e, r, t: `${title(e, r)} ${sub(e, r)} ${r.id}` }))).filter((x) => hit(x.t)).slice(0, 8)
    .map(({ e, r }) => ({ g: '문서·기준정보', label: `${title(e, r)}`, meta: `${e.name} · ${sub(e, r)}`, href: link(e, r), icon: modOf(e.id).icon })) : [];
  const roles = spec.roles.filter((r) => s && hit(`역할 ${r.name} ${r.person}`)).map((r) => ({ g: '역할', label: `${r.name}(${r.person})로 보기`, run: () => setRole(r.id), icon: 'users' }));
  return [...docs, ...make, ...go, ...roles].slice(0, 12);
}
function openPalette() {
  pal = { q: '', i: 0, items: palItems('') };
  const d = document.getElementById('x-pal');
  d.innerHTML = `<div class="x-pin">${icon('search')}<input id="x-pq" type="text" placeholder="문서번호, 거래처, 품목, '새 발주', '재무'…" aria-label="명령 검색" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="x-pl"><kbd>Esc</kbd></div><ul id="x-pl" role="listbox"></ul>`;
  drawPal(); d.showModal(); document.getElementById('x-pq').focus();
}
function drawPal() {
  let g = '';
  document.getElementById('x-pl').innerHTML = pal.items.length ? pal.items.map((x, i) => `${x.g !== g ? `<li class="x-pg" role="presentation">${esc((g = x.g))}</li>` : ''}<li role="option" id="x-po${i}" aria-selected="${i === pal.i}" data-act="pick" data-i="${i}">${icon(x.icon)}<span>${esc(x.label)}</span>${x.meta ? `<small>${esc(x.meta)}</small>` : ''}${icon('arrow')}</li>`).join('')
    : '<li class="x-pg">찾는 게 없어요</li>';
  document.getElementById('x-pq')?.setAttribute('aria-activedescendant', `x-po${pal.i}`);
}
function runPal(i) {
  const x = pal.items[i]; if (!x) return;
  document.getElementById('x-pal').close();
  if (x.href) location.hash = x.href; else x.run();
}

/* ── 사건 ───────────────────────────────────────────────────────────────── */

function toast(msg) { ui.toast = msg; render(); clearTimeout(toast.t); toast.t = setTimeout(() => { ui.toast = ''; const t = root.querySelector('.x-toast'); if (t) t.innerHTML = ''; }, 2800); }
function setRole(id) { ui.role = id; try { localStorage.setItem(KEY + ':role', id); } catch {} toast(`${me().name}(${me().person}) 역할로 봅니다`); }

function transition(entId, id, tId) {
  const ent = E.entityOf(spec, entId), rec = E.find(store, entId, id);
  const t = E.transitionsFor(spec, ent, rec, ui.role).find((x) => x.id === tId);
  if (!t) return toast(`${me().name} 역할로는 할 수 없는 동작이에요`);
  if (t.blocked) return toast(`${t.label} 불가 — ${t.blocked}`);
  if (!t.confirm && !t.comment) return finish(ent, rec, t);
  const d = document.getElementById('x-dialog'); form = null;
  d.innerHTML = `<form class="c-dialog-in" method="dialog"><h3>${esc(rec.no ?? rec.id)} · ${esc(t.label)}할까요?</h3>${t.confirm ? `<p>${esc(t.confirm)}</p>` : ''}
    ${t.comment ? `<label class="c-field"><span>사유 <b class="x-req" aria-label="필수">*</b></span><textarea class="c-area" rows="2" id="x-comment"></textarea></label>` : ''}
    <div class="c-actions"><span class="c-spacer"></span><button class="c-btn" data-kind="quiet" type="button" data-act="fcancel">그만두기</button>
    <button class="c-btn" data-kind="${t.kind === 'risk' ? 'risk' : 'primary'}" type="button" data-act="confirm" data-ent="${ent.id}" data-id="${esc(rec.id)}" data-t="${t.id}">${esc(t.label)}</button></div></form>`;
  d.showModal(); document.getElementById('x-comment')?.focus();
}
function finish(ent, rec, t, comment) {
  const res = E.applyTransition(store, ent.id, rec.id, t.id, { role: ui.role, by: me().person, at: store.today, comment });
  if (!res.ok) return toast(res.error);
  save(); toast(`${rec.no ?? rec.id} · ${t.label} 완료${res.changes ? ` · 재고 등 ${res.changes}건 반영` : ''}`);
}

function onClick(ev) {
  const el = ev.target.closest('[data-act]');
  if (!el) {
    const tr = ev.target.closest('tr[data-row]');
    if (tr && !ev.target.closest('a')) location.hash = `#/e/${route().ent}/${encodeURIComponent(tr.dataset.row)}`;
    return;
  }
  const a = el.dataset.act, r = route(), ent = r.ent ? E.entityOf(spec, r.ent) : null;
  if (a === 'palette') openPalette();
  else if (a === 'pick') runPal(Number(el.dataset.i));
  else if (a === 'role') setRole(el.dataset.v);
  else if (a === 'go') transition(el.dataset.ent, el.dataset.id, el.dataset.t);
  else if (a === 'confirm') {
    const c = document.getElementById('x-comment');
    const e2 = E.entityOf(spec, el.dataset.ent), rec = E.find(store, e2.id, el.dataset.id);
    const t = E.transitionsFor(spec, e2, rec, ui.role).find((x) => x.id === el.dataset.t);
    if (t.comment && !c.value.trim()) { c.focus(); c.closest('.c-field').dataset.invalid = 'true'; return; }
    document.getElementById('x-dialog').close(); finish(e2, rec, t, c?.value);
  }
  else if (a === 'close') location.hash = `#/e/${r.ent}`;
  else if (a === 'tab') { ui.tab = el.dataset.v; render(); root.querySelector(`[data-act="tab"][data-v="${ui.tab}"]`)?.focus(); }
  else if (a === 'view') { ui.view = el.dataset.v; try { localStorage.setItem(KEY + ':view', ui.view); } catch {} render(); }
  else if (a === 'chip') { ui.chips.has(el.dataset.v) ? ui.chips.delete(el.dataset.v) : ui.chips.add(el.dataset.v); render(); }
  else if (a === 'chipOnly') { ui.view = 'table'; ui.chips = new Set([el.dataset.v]); render(); }
  else if (a === 'clear') { ui.q = ''; ui.chips.clear(); render(); }
  else if (a === 'new') openForm(ent, null);
  else if (a === 'edit') openForm(ent, E.find(store, ent.id, el.dataset.id));
  else if (a === 'suggest') { const d = E.draftFromSuggestion(store, el.dataset.s, el.dataset.id); openForm(E.entityOf(spec, d.entity), null, d.values, `규칙 기반 초안 · ${d.basis}. 확인하고 작성하세요.`); }
  else if (a === 'fcancel') { document.getElementById('x-dialog').close(); form = null; }
  else if (a === 'ladd' || a === 'ldel') { readForm(); const lf = form.ent.fields.find((f) => f.type === 'lines'); a === 'ladd' ? form.values[lf.id].push({}) : form.values[lf.id].splice(Number(el.dataset.i), 1); drawForm(); }
  else if (a === 'fsave') {
    readForm();
    const lf = form.ent.fields.find((f) => f.type === 'lines');
    if (lf) form.values[lf.id] = form.values[lf.id].filter((l) => Object.values(l).some((v) => v !== '' && v !== undefined));
    const meta = { by: me().person, at: store.today };
    const res = form.id ? E.updateRecord(store, form.ent.id, form.id, form.values, meta) : E.createRecord(store, form.ent.id, form.values, meta);
    if (!res.ok) { form.errors = res.errors; drawForm(); document.querySelector('#x-dialog [aria-invalid="true"]')?.focus(); return; }
    const e2 = form.ent; document.getElementById('x-dialog').close(); form = null; save();
    location.hash = link(e2, res.record); toast(`${res.record.id} 저장했어요`);
  }
  else if (a === 'csv') {
    const cols = ent.list.columns, rows = rowsOf(ent);
    const csv = [cols.map((c) => E.fieldOf(spec, ent.id, c).label), ...rows.map((x) => cols.map((c) => E.display(store, ent.id, c, x)))].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const link2 = document.createElement('a'); link2.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); link2.download = `${ent.name}-${store.today}.csv`; link2.click();
  }
}

function onInput(ev) {
  const t = ev.target;
  if (t.id === 'x-pq') { pal.q = t.value; pal.i = 0; pal.items = palItems(t.value); drawPal(); return; }
  if (t.dataset.act === 'q') { ui.q = t.value; render(); const i = root.querySelector('[data-act="q"]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); return; }
  if (form && t.closest('#x-dialog') && /\.(qty|price|debit|credit)$|^supply$/.test(t.name ?? '')) {
    readForm(); const pv = E.computeRecord(spec, form.ent, form.values);
    const dds = document.querySelectorAll('#x-dialog .x-totals dd');
    form.ent.fields.filter((f) => f.type === 'computed').forEach((f, i) => { if (dds[i]) dds[i].textContent = won(pv[f.id]); });
  }
}
function onChange() {}

function onKey(ev) {
  const pd = document.getElementById('x-pal');
  if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); pd?.open ? pd.close() : openPalette(); return; }
  if (ev.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName ?? '')) { ev.preventDefault(); openPalette(); return; }
  if (pd?.open) {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); pal.i = Math.min(pal.i + 1, pal.items.length - 1); drawPal(); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); pal.i = Math.max(pal.i - 1, 0); drawPal(); }
    else if (ev.key === 'Enter') { ev.preventDefault(); runPal(pal.i); }
    return;
  }
  if (ev.key === 'Escape' && route().id && !document.getElementById('x-dialog')?.open) location.hash = `#/e/${route().ent}`;
}

/* 끌어서 상태 바꾸기 — 판정은 엔진이 한다(역할·가드·확인). 안 되면 이유를 말한다. */
function onDragStart(ev) {
  const c = ev.target.closest?.('[data-card]'); if (!c) return;
  ui.drag = c.dataset.card; ev.dataTransfer.setData('text/plain', ui.drag); ev.dataTransfer.effectAllowed = 'move';
}
function onDragOver(ev) {
  const col = ev.target.closest?.('[data-drop]'); if (!col || !ui.drag) return;
  ev.preventDefault(); col.setAttribute('data-over', '');
}
function onDrop(ev) {
  const col = ev.target.closest?.('[data-drop]'); if (!col || !ui.drag) return;
  ev.preventDefault(); col.removeAttribute('data-over');
  const ent = E.entityOf(spec, route().ent), rec = E.find(store, ent.id, ui.drag); ui.drag = null;
  if (!rec || rec.status === col.dataset.drop) return;
  const to = col.dataset.drop;
  const t = E.transitionsFor(spec, ent, rec, ui.role).find((x) => x.to === to);
  if (!t) {
    const any = E.workflowOf(spec, ent).transitions.find((x) => x.from.includes(rec.status) && x.to === to);
    const toL = E.workflowOf(spec, ent).states.find((s) => s.id === to).label;
    return toast(any ? `${toL}(으)로 옮기려면 ${any.roles.map((r) => spec.roles.find((x) => x.id === r).name).join('·')} 역할이 필요해요` : `${E.stateOf(spec, ent, rec).label} → ${toL} 은(는) 정해진 흐름이 아니에요`);
  }
  transition(ent.id, rec.id, t.id);
}

function tip(target, ev) {
  const t = document.getElementById('x-tip'); if (!t) return;
  if (!target) { t.hidden = true; return; }
  t.textContent = target.dataset.tip; t.hidden = false;
  t.style.insetInlineStart = `${Math.min(ev.clientX + 14, innerWidth - t.offsetWidth - 8)}px`;
  t.style.insetBlockStart = `${ev.clientY + 14}px`;
}
function onTip(ev) { tip(ev.target.closest?.('[data-tip]'), ev); }
