import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const registry=JSON.parse(await readFile(new URL('../registry/ui-ux-features.json',import.meta.url),'utf8'));
const interactions=JSON.parse(await readFile(new URL('../design-system/interaction.contract.json',import.meta.url),'utf8'));

test('list presentation is role based, not route-local taste',()=>{
  const feature=registry.features.find((item)=>item.id==='data.list-presentation');
  assert.ok(feature);
  assert.deepEqual(feature.required_states,[
    'product-media-row',
    'business-row',
    'variant-card',
    'data-table',
  ]);
  const rules=feature.rules.join('\n');
  assert.match(rules,/product-media-row/);
  assert.match(rules,/business-row/);
  assert.match(rules,/variant-card/);
  assert.match(rules,/data-table/);
  assert.match(rules,/must not silently change its semantic mode/);
  assert.ok(interactions.rules.list_presentation);
});

test('consumer may map domain entities but may not fork semantic selection',()=>{
  const text=interactions.rules.list_presentation.invariants.join('\n');
  assert.match(text,/Product identity rows/);
  assert.match(text,/operational records/);
  assert.match(text,/Commercial\/configuration variants/);
  assert.match(text,/consumer may map domain entities/);
});
