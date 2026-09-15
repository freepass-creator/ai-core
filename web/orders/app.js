const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const states = { NEW: '접수', ACTIVE: '작업 중', BLOCKED: '인계 대기', EXPIRED: '확보 만료 · 확인 필요', REVIEW: '결과 확인 필요', CLOSED: '완료', CANCELLED: '취소', PENDING: '담당 대기', RUNNING: '작업 확보', REPORTED: '결과 접수' };
const eventNames = { CREATED: '오더 접수', ASSIGN: '담당 변경', CLAIM: '작업 확보', HEARTBEAT: '작업 확보 연장', REPORT: '결과 접수', BLOCK: '인계 대기', REVISE: '요구 수정', NOTE: '메모', CLOSE: '사용자 완료 확인', CANCEL: '취소' };
let orders = [], selected = location.hash.startsWith('#ORD-') ? location.hash.slice(1) : '', current, busy = false;
const time = value => new Date(value).toLocaleString('ko-KR');
const badge = state => `<span class="badge ${esc(state)}">${esc(states[state] ?? state)}</span>`;
const splitLines = value => value.split('\n').filter(v => v.trim());
const expired = t => t.status === 'RUNNING' && t.lease && Date.parse(t.lease.expiresAt) <= Date.now();
const visibleStatus = o => o.tasks.some(expired) && !['CLOSED', 'CANCELLED'].includes(o.status) ? 'EXPIRED' : o.status;
function notify(message, error = false) { $('notice').textContent = message; $('notice').className = error ? 'error' : ''; }
async function api(path, payload) {
  const response = await fetch(path, payload ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {});
  const body = await response.json(); if (!response.ok) throw new Error(body.message ?? `HTTP ${response.status}`); return body;
}
async function submit(path, payload) {
  const key = `pending:${path}`, serialized = JSON.stringify(payload);
  let saved; try { saved = JSON.parse(sessionStorage.getItem(key)); } catch { /* absent draft */ }
  if (!saved || saved.serialized !== serialized) saved = { serialized, requestId: crypto.randomUUID() };
  sessionStorage.setItem(key, JSON.stringify(saved));
  const result = await api(path, { ...payload, requestId: saved.requestId }); sessionStorage.removeItem(key); return result;
}
async function guarded(fn) {
  if (busy) return; busy = true;
  const buttons = [...document.querySelectorAll('button')].map(b => [b, b.disabled]); buttons.forEach(([b]) => { b.disabled = true; });
  try { await fn(); } catch (e) { notify(`확인이 필요합니다. ${e.message} 연결 오류라면 새로고침으로 처리 여부를 확인하세요.`, true); }
  finally { busy = false; buttons.forEach(([b, disabled]) => { if (b.isConnected) b.disabled = disabled; }); }
}
function bindForm(form, fn) { if (form) form.addEventListener('submit', e => { e.preventDefault(); guarded(() => fn(Object.fromEntries(new FormData(form)))); }); }
function renderList() {
  const query = $('search').value.toLowerCase(), filter = $('filter').value;
  const filtered = orders.filter(o => `${o.title} ${o.project} ${o.id}`.toLowerCase().includes(query) && (filter === 'all' || (filter === 'open' ? !['CLOSED', 'CANCELLED'].includes(o.status) : filter === 'BLOCKED' ? ['BLOCKED', 'EXPIRED'].includes(visibleStatus(o)) : visibleStatus(o) === filter)));
  $('orders').innerHTML = filtered.length ? filtered.map(o => `<button class="order-card ${o.id === selected ? 'selected' : ''}" data-order="${esc(o.id)}" ${o.id === selected ? 'aria-current="true"' : ''}>${badge(visibleStatus(o))}<strong>${esc(o.title)}</strong><span class="muted small">${esc(o.project)} · ${time(o.updatedAt)}</span></button>`).join('') : '<p class="muted">표시할 오더가 없습니다. 새 오더를 등록해보세요.</p>';
  $('orders').querySelectorAll('[data-order]').forEach(b => b.addEventListener('click', () => guarded(async () => { selected = b.dataset.order; history.replaceState(null, '', `#${selected}`); await loadDetail(); renderList(); })));
  const values = [['전체 오더', orders.length], ['작업 중', orders.filter(o => ['NEW', 'ACTIVE'].includes(visibleStatus(o))).length], ['인계·확인 필요', orders.filter(o => ['BLOCKED', 'EXPIRED', 'REVIEW'].includes(visibleStatus(o))).length], ['완료', orders.filter(o => o.status === 'CLOSED').length]];
  $('stats').innerHTML = values.map(([label, count]) => `<div class="stat"><span>${label}</span><strong>${count}</strong></div>`).join('');
}
function taskHtml(t, index, order) {
  const terminal = ['CLOSED', 'CANCELLED'].includes(order.status), active = t.lease && Date.parse(t.lease.expiresAt) > Date.now();
  const dependency = order.tasks.slice(0, index).every(p => p.status === 'REPORTED');
  return `<article class="task" data-task="${esc(t.id)}"><div class="task-top"><div><h3>${index + 1}. ${esc(t.title)}</h3><span class="small muted">${esc(t.assigned)} · ${t.attempt}회 작업 확보</span></div>${badge(expired(t) ? 'EXPIRED' : t.status)}</div>
    ${active ? `<p class="small muted">작업 확보 만료: ${time(t.lease.expiresAt)} · AI 자동 실행 상태가 아닙니다.</p>` : t.status === 'RUNNING' ? '<p class="small muted">작업 확보가 만료됐습니다. 재확보하거나 담당을 바꿀 수 있습니다.</p>' : ''}
    ${t.blockedReason ? `<p class="result">대기 이유: ${esc(t.blockedReason)}</p>` : ''}
    ${t.report ? `<p class="result">${esc(t.report.summary)}</p><ul class="evidence">${t.report.evidence.map(v => `<li>${esc(v)}</li>`).join('')}</ul><p class="small muted">담당자 기록 · 요구 버전 ${t.report.revision} · 독립 검증 자동 판정 아님</p>` : ''}
    <div class="actions"><button class="secondary" data-action="packet">인계 자료 보기</button>${!terminal && t.status !== 'REPORTED' ? `<button data-action="claim" ${active || !dependency ? 'disabled' : ''}>${t.attempt ? '작업 다시 확보' : '담당 작업 시작'}</button>${active ? '<button class="secondary" data-action="heartbeat">확보 시간 연장</button>' : ''}` : ''}</div>
    ${!dependency && !terminal ? '<p class="small muted">앞선 작업의 결과를 먼저 접수하세요.</p>' : ''}
    ${active && !terminal ? `<details open><summary>작업 결과 또는 대기 이유 기록</summary><form data-report><label>결과 요약<textarea name="summary" rows="3" required></textarea></label><label>근거 위치·검증 결과 <span class="small muted">한 줄에 하나</span><textarea name="evidence" rows="2" required placeholder="파일 경로, 커밋, 검사 결과 등"></textarea></label><button type="submit">결과 접수</button></form><form data-block><label>이어갈 수 없는 이유<input name="reason" required placeholder="예: 도구 사용 한도, 자료 확인 필요"></label><button class="secondary" type="submit">인계 대기로 전환</button></form></details>` : ''}
    ${!terminal && !active && t.status !== 'REPORTED' ? `<details><summary>담당 AI 변경</summary><form data-assign><label>담당<select name="actor">${['claude', 'codex', 'cursor', 'gemini'].map(a => `<option ${a === t.assigned ? 'selected' : ''}>${a}</option>`).join('')}</select></label><label>변경 이유<input name="reason" required></label><button class="secondary" type="submit">담당 변경</button></form></details>` : ''}<div data-packet></div></article>`;
}
async function loadDetail() {
  if (!selected) return;
  const { order: o, events } = await api(`/api/orders/${selected}`); current = o;
  const terminal = ['CLOSED', 'CANCELLED'].includes(o.status);
  const nextTask = o.tasks.find(t => t.status !== 'REPORTED');
  const next = o.status === 'REVIEW' ? '모든 결과가 접수됐습니다. 근거와 완료 조건을 확인하세요.' : terminal ? '종료된 오더입니다. 기록과 인계 자료를 확인할 수 있습니다.' : expired(nextTask) ? '작업 확보가 만료됐습니다. 실제 처리 여부를 확인한 뒤 다시 확보하거나 담당을 바꾸세요.' : `${nextTask.assigned} · ${nextTask.title}${nextTask.blockedReason ? ` — ${nextTask.blockedReason}` : ' 작업을 이어가세요.'}`;
  const proofOptions = o.tasks.flatMap(t => (t.report?.evidence ?? []).map((e, i) => `<option value="${t.id}:${i}">${esc(t.title)} · ${esc(e)}</option>`)).join('');
  const checksHtml = o.criteria.map((c, i) => `<label>${i + 1}. ${esc(c)}<select name="proof-${i}" required><option value="">이 조건을 확인한 근거 선택</option>${proofOptions}</select></label>`).join('');
  $('detail').innerHTML = `<div class="order-heading"><div>${badge(visibleStatus(o))}<h2>${esc(o.title)}</h2><div class="id">${esc(o.id)}</div></div></div><p class="small muted">${esc(o.project)} · 요구 버전 ${o.revision}</p><div class="intent">${esc(o.intent)}</div><h3>완료 조건</h3><ul class="criteria">${o.criteria.map(c => `<li>${esc(c)}</li>`).join('')}</ul><div class="next"><strong>다음 행동</strong><p>${esc(next)}</p></div><h3>함께 처리할 작업</h3>${o.tasks.map((t, i) => taskHtml(t, i, o)).join('')}
    ${o.status === 'REVIEW' ? `<section class="task"><h3>최종 결과 확인</h3><form id="close-form">${checksHtml}<label><input class="check" type="checkbox" name="confirmed" required> 현재 완료 조건과 각 결과의 근거를 확인했습니다.</label><label>확인 메모<textarea name="note" required rows="2"></textarea></label><button type="submit">확인하고 완료</button></form><p class="small muted">사용자 확인 기록입니다. 외부 실행 승인이나 자동 검증 인증을 만들지 않습니다.</p></section>` : ''}
    ${o.closure ? `<p class="intent">완료 확인: ${esc(o.closure.note)}</p>` : ''}
    ${!terminal ? '<details><summary>메모 추가</summary><form id="note-form"><label>판단·다음 행동·참고사항<textarea name="note" required rows="3"></textarea></label><button class="secondary">메모 저장</button></form></details><details><summary>요구사항 수정</summary><p class="small muted">수정하면 모든 작업을 다시 확인합니다. 이전 결과는 이력에 보존됩니다.</p><form id="revise-form"><label>현재 요청<textarea name="intent" required rows="3"></textarea></label><label>완료 조건<textarea name="criteria" required rows="3"></textarea></label><label>수정 이유<input name="reason" required></label><button class="secondary">요구 수정</button></form></details><details><summary>오더 취소</summary><form id="cancel-form"><label>취소 이유<input name="reason" required></label><button class="danger">오더 취소</button></form><p class="small muted">이미 외부에서 실행한 일은 취소되지 않습니다.</p></details>' : ''}
    <details open><summary>처리 이력 · ${events.length}건</summary><ol class="timeline">${events.slice().reverse().map(e => `<li><strong>${esc(eventNames[e.type] ?? e.type)}</strong> · ${esc(e.by)}<div class="time">${time(e.at)} · 요구 버전 ${e.revision}</div><p>${esc(e.detail.note ?? e.detail.reason ?? e.detail.report?.summary ?? e.detail.intent ?? (e.detail.taskId ? `${e.detail.taskId}${e.detail.to ? ` → ${e.detail.to}` : ''}` : ''))}</p></li>`).join('')}</ol></details>`;
  for (const el of $('detail').querySelectorAll('[data-task]')) {
    const t = o.tasks.find(t => t.id === el.dataset.task);
    for (const b of el.querySelectorAll('[data-action]')) b.addEventListener('click', () => guarded(async () => {
      if (b.dataset.action === 'packet') {
        const packet = await api(`/api/orders/${o.id}/packet?task=${t.id}`);
        const area = document.createElement('textarea'); area.className = 'packet'; area.readOnly = true; area.setAttribute('aria-label', '공통 인계 자료'); area.value = JSON.stringify(packet, null, 2);
        const copy = document.createElement('button'); copy.className = 'secondary'; copy.textContent = '인계 자료 복사'; copy.addEventListener('click', () => guarded(async () => { await navigator.clipboard.writeText(area.value); notify('인계 자료를 복사했습니다. 전달할 자료 범위를 확인한 뒤 다른 AI에 붙여넣으세요.'); }));
        el.querySelector('[data-packet]').replaceChildren(area, copy); return;
      }
      await act({ action: b.dataset.action, taskId: t.id, actor: t.assigned, ...(t.lease ? { token: t.lease.token } : {}) });
    }));
    bindForm(el.querySelector('[data-report]'), d => act({ action: 'report', taskId: t.id, actor: t.assigned, token: t.lease.token, revision: o.revision, summary: d.summary, evidence: splitLines(d.evidence) }));
    bindForm(el.querySelector('[data-block]'), d => act({ action: 'block', taskId: t.id, actor: t.assigned, token: t.lease.token, reason: d.reason }));
    bindForm(el.querySelector('[data-assign]'), d => act({ action: 'assign', taskId: t.id, ...d }));
  }
  bindForm($('close-form'), d => act({ action: 'close', confirmed: d.confirmed === 'on', revision: o.revision, note: d.note, checks: o.criteria.map((_, i) => { const [taskId, evidenceIndex] = d[`proof-${i}`].split(':'); return { criterion: i, taskId, evidenceIndex: Number(evidenceIndex) }; }) }));
  bindForm($('note-form'), d => act({ action: 'note', ...d })); bindForm($('cancel-form'), d => act({ action: 'cancel', ...d }));
  if ($('revise-form')) { $('revise-form').elements.intent.value = o.intent; $('revise-form').elements.criteria.value = o.criteria.join('\n'); }
  bindForm($('revise-form'), d => act({ action: 'revise', ...d, criteria: splitLines(d.criteria) }));
  $('detail').inert = false;
}
async function afterSave(order, message) {
  current = order;
  try { await refresh(); notify(message); }
  catch { $('detail').inert = true; notify('기록은 저장됐습니다. 최신 화면을 불러오지 못했으니 새로고침하세요. 같은 내용을 다시 등록할 필요는 없습니다.', true); }
}
async function act(payload) { const saved = await submit(`/api/orders/${current.id}`, { ...payload, version: current.version }); await afterSave(saved, '처리 기록을 저장했습니다.'); }
async function refresh() {
  const meta = await api('/api/meta'); $('name').textContent = meta.name; $('provisional').textContent = meta.provisional ? '이름 상의 중' : ''; document.title = `${meta.name} · 오더 데스크`; $('display-name').value = meta.name;
  $('actors').innerHTML = meta.actors.map(a => `<div class="actor"><strong>${esc(a.name)}</strong><p>${esc(a.strength)}</p></div>`).join('');
  orders = await api('/api/orders'); renderList(); if (selected) await loadDetail(); $('detail').inert = false;
}
$('order-form').addEventListener('input', () => localStorage.setItem('order-draft', JSON.stringify(Object.fromEntries(new FormData($('order-form'))))));
try { const draft = JSON.parse(localStorage.getItem('order-draft')); if (draft) for (const [key, value] of Object.entries(draft)) if ($('order-form').elements[key]) $('order-form').elements[key].value = value; } catch { /* malformed local draft */ }
bindForm($('order-form'), async data => {
  const o = await submit('/api/orders', { ...data, criteria: splitLines(data.criteria), source: 'local-web' }); selected = o.id; history.replaceState(null, '', `#${selected}`); $('order-form').reset(); localStorage.removeItem('order-draft'); await afterSave(o, '오더가 등록됐습니다. 담당과 다음 행동을 확인하세요.'); $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
bindForm($('name-form'), async () => { await api('/api/name', { name: $('display-name').value }); await refresh(); notify('표시 이름을 저장했습니다.'); });
$('refresh').addEventListener('click', () => guarded(async () => { await refresh(); notify('최신 기록을 불러왔습니다.'); }));
$('search').addEventListener('input', renderList); $('filter').addEventListener('change', renderList);
guarded(refresh);
