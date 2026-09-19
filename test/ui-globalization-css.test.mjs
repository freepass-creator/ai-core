import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../design-system/components.css', import.meta.url), 'utf8');

test('common components use logical direction properties for bidi safety', () => {
  assert.doesNotMatch(css, /\bborder-(left|right)\s*:/);
  assert.doesNotMatch(css, /(^|[;{]\s*)(left|right)\s*:/m);
  assert.match(css, /border-inline-start\s*:/);
  assert.match(css, /inset-inline-end\s*:/);
});

test('bottom action bar accounts for safe area and mobile reachability', () => {
  assert.match(css, /\.ui-action-bar\s*\{/);
  assert.match(css, /inset-block-end\s*:\s*0/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /\.ui-action-bar\s*>\s*\.ui-button\s*\{\s*width:\s*100%/s);
});

test('forced color environments retain explicit control boundaries', () => {
  assert.match(css, /@media\s*\(forced-colors:\s*active\)/);
  assert.match(css, /border-color:\s*CanvasText/);
  assert.match(css, /border-color:\s*Highlight/);
});
