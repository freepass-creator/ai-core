import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../examples/ui-globalization.html', import.meta.url), 'utf8');

test('globalization probe loads B2 runtime layers', () => {
  assert.match(html, /tokens\.runtime\.css/);
  assert.match(html, /components\.css/);
  assert.match(html, /runtime-v2\.css/);
});

test('globalization probe contains LTR RTL and mixed-direction isolation', () => {
  assert.match(html, /dir="ltr"/);
  assert.match(html, /dir="rtl" lang="ar"/);
  assert.match(html, /<bdi>/);
  assert.match(html, /data-mirror="true"/);
});

test('globalization probe covers long text numeric alignment and bottom action', () => {
  assert.match(html, /data-ui-expandable-copy/);
  assert.match(html, /data-ui-align="numeric"/);
  assert.match(html, /class="ui-table-number"/);
  assert.match(html, /class="ui-bottom-action"/);
});

test('globalization probe exposes real labels and status text', () => {
  assert.match(html, /<label class="ui-field" for="probe-input">/);
  assert.match(html, /class="ui-error" role="alert"/);
  assert.match(html, /class="ui-source" data-state="verified"/);
});
