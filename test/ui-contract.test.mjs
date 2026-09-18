import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../web/orders/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../web/orders/style.css', import.meta.url), 'utf8');
const tokens = readFileSync(new URL('../design-system/tokens.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../web/orders/app.js', import.meta.url), 'utf8');

test('order desk keeps the shared work UI contract', () => {
  for (const id of [
    'name','provisional','search','filter','orders','detail','refresh',
    'new-order','new-order-open','new-order-cancel','order-form',
    'actors','name-form','display-name'
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  }

  assert.match(tokens, /--h-chip:22px/);
  assert.match(tokens, /--h-ctl:30px/);
  assert.match(tokens, /--h-row:34px/);
  assert.match(tokens, /--h-act:38px/);
  assert.match(tokens, /--h-top:46px/);
  assert.match(tokens, /--sp:6px/);
  assert.match(tokens, /--sp2:12px/);
  assert.match(tokens, /--sp3:16px/);

  assert.match(css, /grid-template-columns:minmax\(0,7fr\).*minmax\(360px,3fr\)/);
  assert.match(css, /button,.button\{border:0\}/);
  assert.match(css, /body\.detail-open \.list-panel\{display:none\}/);
  assert.match(css, /body\.detail-open \.detail\{display:block\}/);
});

test('order desk exposes modern interaction affordances without changing the API contract', () => {
  assert.match(app, /showModal/);
  assert.match(app, /metaKey \|\| e\.ctrlKey/);
  assert.match(app, /key\.toLowerCase\(\) === 'k'/);
  assert.match(app, /classList\.add\('detail-open'\)/);
  assert.match(app, /class="ai-label"/);
  assert.match(app, /\/api\/orders/);
  assert.match(app, /X-AI-Core-Expected-Ledger/);
});
