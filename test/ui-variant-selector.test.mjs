import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const registry=JSON.parse(await readFile(new URL('../registry/ui-ux-features.json',import.meta.url),'utf8'));
const patterns=JSON.parse(await readFile(new URL('../design-system/patterns.registry.json',import.meta.url),'utf8'));
const interactions=JSON.parse(await readFile(new URL('../design-system/interaction.contract.json',import.meta.url),'utf8'));
const css=await readFile(new URL('../design-system/runtime-v2.css',import.meta.url),'utf8');

test('direct variant selector is canonical and distinct from search quick filters',()=>{
  const feature=registry.features.find((x)=>x.id==='data.variant-selector');
  assert.ok(feature);
  assert.match(feature.rules.join('\n'),/not a search quick filter/);
  assert.ok(patterns.patterns.some((x)=>
    x.feature_id==='data.variant-selector'
    &&x.css_selector==='.ui-variant-selector'
    &&x.implementation_status==='RUNTIME_V2'
  ));
  assert.ok(interactions.rules.variant_selection);
  assert.match(css,/\.ui-variant-selector/);
});

test('variant contract forbids fabricated choices and preserves subordinate conditions',()=>{
  const rule=interactions.rules.variant_selection.invariants.join('\n');
  assert.match(rule,/source data/);
  assert.match(rule,/not padded/);
  assert.match(rule,/subordinate variants/);
  assert.match(rule,/stable variant identity/);
});
