const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const form = $('#profile-form');
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const fields = [['#name', '#name-error', '이름을 입력하세요.'], ['#email', '#email-error', '올바른 이메일을 입력하세요.']];
  let firstInvalid = null;
  for (const [inputSelector, errorSelector, message] of fields) {
    const input = $(inputSelector);
    const invalid = !input.validity.valid;
    input.setAttribute('aria-invalid', String(invalid));
    $(errorSelector).textContent = invalid ? message : '';
    if (invalid && !firstInvalid) firstInvalid = input;
  }
  if (!$('#terms').checked) firstInvalid ??= $('#terms');
  if (firstInvalid) {
    $('#form-status').textContent = '입력 내용을 확인하세요.';
    firstInvalid.focus();
    return;
  }
  $('#form-status').textContent = '설정을 저장했습니다.';
});
form.addEventListener('reset', () => requestAnimationFrame(() => {
  $$('.ui-input').forEach(input => input.removeAttribute('aria-invalid'));
  $$('.ui-error').forEach(error => { error.textContent = ''; });
  $('#form-status').textContent = '입력을 초기화했습니다.';
}));

const tabs = $$('.ui-tab');
function activateTab(tab, moveFocus = true) {
  for (const candidate of tabs) {
    const selected = candidate === tab;
    candidate.setAttribute('aria-selected', String(selected));
    candidate.tabIndex = selected ? 0 : -1;
    $('#' + candidate.getAttribute('aria-controls')).hidden = !selected;
  }
  if (moveFocus) tab.focus();
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activateTab(tab, false));
  tab.addEventListener('keydown', (event) => {
    const keys = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1 };
    if (keys[event.key] == null) return;
    event.preventDefault();
    activateTab(tabs[keys[event.key]]);
  });
});

const stateViews = {
  loading: '<div><div class="ui-progress" aria-label="불러오는 중"></div><p>데이터를 불러오는 중입니다.</p></div>',
  empty: '<div><strong>표시할 결과가 없습니다.</strong><p>필터를 바꾸거나 새 항목을 추가하세요.</p></div>',
  error: '<div class="ui-alert error" role="alert"><strong>데이터를 불러오지 못했습니다.</strong><p>연결을 확인한 뒤 다시 시도하세요.</p><button class="ui-button secondary" type="button" data-state="loading">다시 시도</button></div>',
  populated: '<ul class="ui-list"><li><strong>회원 화면</strong><span>PASS</span></li><li><strong>결제 API</strong><span>HOLD</span></li><li><strong>배포</strong><span>검토 중</span></li></ul>'
};
function renderState(name) { $('#data-state').innerHTML = stateViews[name]; }
document.addEventListener('click', event => { const name = event.target.closest('[data-state]')?.dataset.state; if (name) renderState(name); });
renderState('populated');

let toastTimer;
function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3000);
}
$('#toast-open').addEventListener('click', () => showToast('변경사항을 저장했습니다.'));

let currentPage = 1;
const pageCount = 3;
function renderPage() {
  $('#page-status').textContent = `${currentPage} / ${pageCount} 페이지`;
  $('#page-prev').disabled = currentPage === 1;
  $('#page-next').disabled = currentPage === pageCount;
}
$('#page-prev').addEventListener('click', () => { currentPage = Math.max(1, currentPage - 1); renderPage(); });
$('#page-next').addEventListener('click', () => { currentPage = Math.min(pageCount, currentPage + 1); renderPage(); });
renderPage();

const dialog = $('#confirm-dialog');
$('#dialog-open').addEventListener('click', () => dialog.showModal());
$('#dialog-cancel').addEventListener('click', () => dialog.close('cancel'));
$('#dialog-confirm').addEventListener('click', () => { dialog.close('confirmed'); showToast('샘플에서는 삭제를 실행하지 않습니다.'); });
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close('backdrop'); });

const workflowKey = 'ai-core:ui-patterns:workflow-v1';
const note = $('#work-note');
const saveButton = $('#draft-save');
const externalButton = $('#external-action');
const workflowStatus = $('#workflow-status');
let savedValue = '';
let saveRevision = 0;
let saveInFlight = false;

function readDraft() {
  try { return JSON.parse(localStorage.getItem(workflowKey) || 'null'); } catch { return null; }
}
function writeDraft(value) {
  localStorage.setItem(workflowKey, JSON.stringify({ value, updatedAt: new Date().toISOString() }));
}
function setWorkflowStatus(message, error = false) {
  workflowStatus.textContent = message;
  workflowStatus.classList.toggle('error', error);
}
function markDirty() {
  if (saveRevision > 0 && note.value === savedValue) {
    localStorage.removeItem(workflowKey);
    externalButton.disabled = false;
    $('#save-receipt').hidden = false;
    setWorkflowStatus(`revision local-demo-r${saveRevision} 저장 내용과 같습니다.`);
    return;
  }
  writeDraft(note.value);
  externalButton.disabled = true;
  $('#save-receipt').hidden = true;
  setWorkflowStatus('초안을 이 기기에 보존했습니다. 서버 저장이 필요합니다.');
}

const recoveredDraft = readDraft();
if (recoveredDraft?.value) {
  note.value = recoveredDraft.value;
  setWorkflowStatus('이 기기에서 이전 초안을 복구했습니다. 서버 저장이 필요합니다.');
}
note.addEventListener('input', markDirty);

saveButton.addEventListener('click', async () => {
  if (saveInFlight) return;
  saveInFlight = true;
  saveButton.disabled = true;
  saveButton.setAttribute('aria-busy', 'true');
  setWorkflowStatus('저장 중입니다. 중복 저장을 잠시 막았습니다. 입력 변경은 새 초안으로 보존됩니다.');
  const valueAtStart = note.value;
  await new Promise(resolve => setTimeout(resolve, 450));
  const shouldFail = $('#simulate-save-failure').checked;
  $('#simulate-save-failure').checked = false;
  saveInFlight = false;
  saveButton.disabled = false;
  saveButton.removeAttribute('aria-busy');
  if (shouldFail) {
    writeDraft(note.value);
    externalButton.disabled = true;
    setWorkflowStatus('저장하지 못했습니다. 입력은 보존했습니다. 다시 시도하세요.', true);
    saveButton.textContent = '저장 다시 시도';
    saveButton.focus();
    return;
  }
  savedValue = valueAtStart;
  saveRevision += 1;
  localStorage.removeItem(workflowKey);
  $('#receipt-key').textContent = workflowKey;
  $('#receipt-revision').textContent = `local-demo-r${saveRevision}`;
  $('#receipt-time').textContent = new Date().toLocaleString('ko-KR');
  $('#save-receipt').hidden = false;
  saveButton.textContent = '서버 저장 시뮬레이션';
  if (note.value !== valueAtStart) {
    writeDraft(note.value);
    externalButton.disabled = true;
    setWorkflowStatus('저장 중 바뀐 입력은 새 초안으로 보존했습니다. 다시 저장하세요.');
    return;
  }
  externalButton.disabled = false;
  setWorkflowStatus(`revision local-demo-r${saveRevision} 저장을 확인했습니다.`);
});

externalButton.addEventListener('click', () => {
  showToast('외부 실행은 별도 승인·실행 단계입니다. 샘플에서는 실행하지 않습니다.');
});
