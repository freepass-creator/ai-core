import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const html = await readFile(new URL('../examples/ui-patterns.html', import.meta.url), 'utf8');
const js = await readFile(new URL('../examples/ui-patterns.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../design-system/components.css', import.meta.url), 'utf8');
const receipt = JSON.parse(await readFile(new URL('../docs/evidence/UI-PATTERNS-BROWSER.json', import.meta.url), 'utf8'));

test('form controls have labels hints types and error associations', () => {
  assert.match(html, /<label class="ui-field" for="name">/);
  assert.match(html, /type="email"/);
  assert.match(html, /aria-describedby="email-error"/);
  assert.match(html, /type="radio"/);
  assert.match(html, /type="checkbox"/);
  assert.match(js, /firstInvalid\.focus\(\)/);
});

test('tabs expose APG roles and keyboard navigation', () => {
  assert.match(html, /role="tablist"/);
  assert.match(html, /role="tab" aria-selected="true"/);
  assert.match(html, /role="tabpanel"/);
  for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) assert.match(js, new RegExp(key));
  assert.match(html, /role="tabpanel"[^>]*tabindex="0"/);
});

test('feedback covers loading empty error populated toast and retry', () => {
  for (const state of ['loading', 'empty', 'error', 'populated']) assert.match(js, new RegExp(`${state}:`));
  assert.match(html, /class="ui-toast"[^>]*role="status"/);
  assert.match(js, /다시 시도/);
  assert.match(css, /prefers-reduced-motion/);
});

test('dialog has name description and explicit cancel and confirm actions', () => {
  assert.match(html, /<dialog[^>]*aria-labelledby="dialog-title"[^>]*aria-describedby="dialog-description"/);
  assert.match(js, /showModal\(\)/);
  assert.match(js, /close\('cancel'\)/);
  assert.match(js, /close\('confirmed'\)/);
});

test('navigation and disclosure use native and programmatic semantics', () => {
  assert.match(html, /<details class="ui-disclosure"><summary>/);
  assert.match(html, /<nav class="ui-pagination" aria-label="결과 페이지">/);
  assert.match(html, /id="page-status" role="status" aria-live="polite"/);
  assert.match(js, /currentPage = Math\.min/);
  assert.match(js, /currentPage = Math\.max/);
});

test('browser receipt binds current sources and complete interaction checks', async () => {
  for (const [path, expected] of Object.entries(receipt.source_sha256)) {
    const bytes = await readFile(new URL(`../${path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected);
  }
  assert.deepEqual(receipt.results.wcag2a_wcag2aa, { violations: 0, incomplete: 0, passes: 24 });
  assert.equal(receipt.results.body_overflow, false);
  assert.ok(receipt.results.visible_button_min_height_px >= 44);
  assert.ok(receipt.results.input_height_px >= 44);
  assert.equal(receipt.results.invalid_submit.focused_id, 'name');
  assert.equal(receipt.results.keyboard_tab.selected, true);
  assert.equal(receipt.results.tab_to_panel_focus_id, 'panel-checks');
  assert.equal(receipt.results.pagination.upper_next_disabled, true);
  assert.equal(receipt.results.dialog.returned_focus_id, 'dialog-open');
  assert.equal(receipt.results.dialog_dismissal.escape.returned_focus_id, 'dialog-open');
  assert.equal(receipt.results.dialog_dismissal.backdrop.returned_focus_id, 'dialog-open');
  assert.equal(receipt.results.toast_timer_reset.visible_after_prior_timer_deadline, true);
  assert.equal(receipt.results.reduced_motion_animation_name, 'none');
  assert.equal(receipt.results.page_errors, 0);
});
