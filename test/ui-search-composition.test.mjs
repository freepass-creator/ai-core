import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const registry=JSON.parse(await readFile(new URL('../registry/ui-ux-features.json',import.meta.url),'utf8'));
const patterns=JSON.parse(await readFile(new URL('../design-system/patterns.registry.json',import.meta.url),'utf8'));
const interactions=JSON.parse(await readFile(new URL('../design-system/interaction.contract.json',import.meta.url),'utf8'));
const css=await readFile(new URL('../design-system/runtime-v2.css',import.meta.url),'utf8');
const standard=await readFile(new URL('../docs/UI_COMPOSITION_STANDARD.md',import.meta.url),'utf8');

test('search discovery composition is a canonical registered pattern',()=>{
  const feature=registry.features.find((x)=>x.id==='data.search-discovery');
  assert.ok(feature);
  assert.deepEqual(feature.required_states,[
    'search-only','search-filter','search-quick','search-filter-quick'
  ]);
  assert.ok(patterns.patterns.some((x)=>
    x.feature_id==='data.search-discovery'
    &&x.implementation_status==='RUNTIME_V2'
    &&x.css_selector==='.ui-search-discovery'
  ));
  assert.ok(interactions.rules.search_discovery_composition);
});

test('composition standard fixes adjacency, quick-filter row and lightweight default',()=>{
  assert.match(standard,/SEARCH_ONLY/);
  assert.match(standard,/SEARCH_FILTER/);
  assert.match(standard,/SEARCH_QUICK/);
  assert.match(standard,/SEARCH_FILTER_QUICK/);
  assert.match(standard,/같은 row, 바로 인접한 trailing 위치/);
  assert.match(standard,/바로 아래 별도 row/);
  assert.match(standard,/가벼운 모드부터/);
});

test('runtime exposes one shell with declared modes rather than local layout forks',()=>{
  assert.match(css,/\.ui-search-discovery/);
  assert.match(css,/data-ui-search-mode="search-only"/);
  assert.match(css,/data-ui-quick-filters/);
  assert.match(css,/data-ui-filter-trigger/);
  assert.match(css,/data-ui-applied-filters/);
});
