import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const registry=JSON.parse(await readFile(new URL('../registry/ui-ux-features.json',import.meta.url),'utf8'));
const interactions=JSON.parse(await readFile(new URL('../design-system/interaction.contract.json',import.meta.url),'utf8'));
const profile=await readFile(new URL('../docs/FREEPASS_PRODUCT_UI_PROFILE.md',import.meta.url),'utf8');

test('bottom action boundary persists while its action set follows screen and workflow state',()=>{
  const feature=registry.features.find((item)=>item.id==='navigation.bottom-action');
  assert.ok(feature);
  assert.match(feature.rules.join('\n'),/shared persistent UI region/);
  assert.match(feature.rules.join('\n'),/replace its action set/);
  assert.match(interactions.rules.action_placement.invariants.join('\n'),/persists across screen transitions/);
  assert.match(profile,/보조 3 : 주행동 7/);
  assert.match(profile,/상품 상세/);
  assert.match(profile,/신규 접수/);
  assert.match(profile,/청구/);
  assert.match(profile,/지급/);
});
