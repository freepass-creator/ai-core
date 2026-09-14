import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../examples/ui-components.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../design-system/tokens.css', import.meta.url), 'utf8');

test('sample declares language viewport and labeled regions', () => { assert.match(html, /<html lang="ko">/); assert.match(html, /name="viewport"/); assert.match(html, /aria-labelledby=/); });
test('buttons expose action busy disabled and live-feedback states', () => { assert.match(html, /type="button"/); assert.match(html, /aria-busy="true" disabled/); assert.match(html, /disabled aria-describedby="disabled-reason"/); assert.match(html, /role="status" aria-live="polite"/); assert.match(html, /\.button:active/); });
test('dropdown has a persistent label and explicit empty option', () => { assert.match(html, /<label for="coverage">/); assert.match(html, /<select id="coverage"/); assert.match(html, /<option value="">선택하세요<\/option>/); });
test('table has caption scoped headers and keyboard-scroll region', () => { assert.match(html, /<caption>/); assert.match(html, /scope="col"/); assert.match(html, /scope="row"/); assert.match(html, /tabindex="0" role="region"/); });
test('tokens define touch target focus and reduced motion', () => { assert.match(css, /--control-height: 44px/); assert.match(css, /:focus-visible/); assert.match(css, /prefers-reduced-motion/); });
