import test from 'node:test';
import assert from 'node:assert/strict';
import { collectUsedClasses, evaluateUiMachineConformance } from '../src/engine/ui-ux-machine-conformance.mjs';

const manifest = {
  contract: 'ai-core-ui-machine-conformance/v1',
  version: '1.0.0',
  style_files: ['x.css'],
  usage_files: ['x.tsx'],
  rules: [{
    id: 'row.height',
    target_classes: ['ui-row'],
    property: 'height',
    allowed_values: ['var(--row-height)'],
    require_match: true
  }]
};

test('collects literal and template className usage', () => {
  const source = '<div class="ui-row a"></div>' + '<div className={`ui-cell ${active ? "on" : ""}`}></div>' + '<input className={\'ui-input\'} />' + '<span className={"ui-label"}></span>';
  const used = collectUsedClasses(source);
  assert.equal(used.has('ui-row'), true);
  assert.equal(used.has('ui-cell'), true);
  assert.equal(used.has('ui-input'), true);
  assert.equal(used.has('ui-label'), true);
});

test('later declaration for a used selector is treated as effective', () => {
  const result = evaluateUiMachineConformance({
    manifest,
    styleSources: [{ id: 'x.css', content: '.ui-row{height:43px}.ui-row{height:var(--row-height)}' }],
    usageSources: [{ id: 'x.tsx', content: '<div className="ui-row" />' }]
  });
  assert.equal(result.status, 'PASS');
  assert.equal(result.violations.length, 0);
});

test('later partial selector override preserves earlier allowed properties', () => {
  const result = evaluateUiMachineConformance({
    manifest,
    styleSources: [{ id: 'x.css', content: '.ui-row{height:var(--row-height);padding:4px}.ui-row{padding:8px}' }],
    usageSources: [{ id: 'x.tsx', content: '<div className="ui-row" />' }]
  });
  assert.equal(result.status, 'PASS');
});
test('off-grid value on an actually used class fails', () => {
  const result = evaluateUiMachineConformance({
    manifest,
    styleSources: [{ id: 'x.css', content: '.ui-row{height:43px}' }],
    usageSources: [{ id: 'x.tsx', content: '<div className="ui-row" />' }]
  });
  assert.equal(result.status, 'FAIL');
  assert.equal(result.violations[0].value, '43px');
});

test('unused legacy selectors do not create false failures', () => {
  const result = evaluateUiMachineConformance({
    manifest,
    styleSources: [{ id: 'x.css', content: '.ui-row{height:var(--row-height)}.legacy{height:17px}' }],
    usageSources: [{ id: 'x.tsx', content: '<div className="ui-row" />' }]
  });
  assert.equal(result.status, 'PASS');
  assert.equal(result.used_classes.includes('legacy'), false);
});

test('required rule fails when the used class has no effective declaration', () => {
  const result = evaluateUiMachineConformance({
    manifest,
    styleSources: [{ id: 'x.css', content: '.ui-row{padding:8px}' }],
    usageSources: [{ id: 'x.tsx', content: '<div className="ui-row" />' }]
  });
  assert.equal(result.status, 'FAIL');
  assert.equal(result.violations[0].code, 'REQUIRED_EFFECTIVE_DECLARATION_MISSING');
});
