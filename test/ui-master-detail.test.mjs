import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const registry=JSON.parse(await readFile(new URL('../registry/ui-ux-features.json',import.meta.url),'utf8'));
const patterns=JSON.parse(await readFile(new URL('../design-system/patterns.registry.json',import.meta.url),'utf8'));
const interactions=JSON.parse(await readFile(new URL('../design-system/interaction.contract.json',import.meta.url),'utf8'));
const css=await readFile(new URL('../design-system/runtime-v2.css',import.meta.url),'utf8');

test('master detail is multi-pane on desktop but single-pane on mobile',()=>{
  const feature=registry.features.find((x)=>x.id==='data.master-detail');
  assert.ok(feature);
  assert.match(feature.rules.join('\n'),/Mobile must not stack desktop panes/);
  assert.ok(patterns.patterns.some((x)=>
    x.feature_id==='data.master-detail'
    &&x.css_selector==='.ui-master-detail'
    &&x.implementation_status==='RUNTIME_V2'
  ));
  assert.ok(interactions.rules.master_detail_navigation);
  assert.match(css,/data-mobile-view="list"/);
  assert.match(css,/data-mobile-view="detail"/);
});
