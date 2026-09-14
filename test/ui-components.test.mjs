import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../examples/ui-components.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../design-system/tokens.css', import.meta.url), 'utf8');

function token(name) {
  return css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1];
}

function luminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map(value => Number.parseInt(value, 16) / 255);
  const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(first, second) {
  const [high, low] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
}

test('sample declares language viewport and labeled regions', () => { assert.match(html, /<html lang="ko">/); assert.match(html, /name="viewport"/); assert.match(html, /aria-labelledby=/); });
test('buttons expose action busy disabled and live-feedback states', () => { assert.match(html, /type="button"/); assert.match(html, /aria-busy="true" disabled/); assert.match(html, /disabled aria-describedby="disabled-reason"/); assert.match(html, /role="status" aria-live="polite"/); assert.match(html, /\.button:active/); });
test('dropdown has a persistent label and explicit empty option', () => { assert.match(html, /<label for="coverage">/); assert.match(html, /<select id="coverage"/); assert.match(html, /<option value="">선택하세요<\/option>/); });
test('table has caption scoped headers and keyboard-scroll region', () => { assert.match(html, /<caption>/); assert.match(html, /scope="col"/); assert.match(html, /scope="row"/); assert.match(html, /tabindex="0" role="region"/); });
test('tokens define touch target focus and reduced motion', () => { assert.match(css, /--control-height: 44px/); assert.match(css, /:focus-visible/); assert.match(css, /prefers-reduced-motion/); });
test('token contrast meets the documented text and focus floors', () => {
  assert.ok(contrast(token('text'), token('surface')) >= 4.5);
  assert.ok(contrast(token('muted'), token('surface')) >= 4.5);
  assert.ok(contrast(token('focus'), token('surface')) >= 3);
  assert.ok(contrast(token('focus'), token('bg')) >= 3);
});
