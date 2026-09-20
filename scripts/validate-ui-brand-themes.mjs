import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const [schema,registry]=await Promise.all([
  readFile(resolve(root,'contracts/ui-brand-theme-registry.schema.json'),'utf8').then(JSON.parse),
  readFile(resolve(root,'design-system/brand-themes.registry.json'),'utf8').then(JSON.parse)
]);
const ajv=new Ajv2020({allErrors:true,strict:true});
const validate=ajv.compile(schema);
if(!validate(registry)){
  console.error(JSON.stringify(validate.errors,null,2));
  process.exit(1);
}
const ids=new Set();
for(const theme of registry.themes){
  if(ids.has(theme.id)) throw new Error('duplicate theme id: '+theme.id);
  ids.add(theme.id);
  if(theme.mode==='cobrand' && !theme.colors.partner_accent){
    throw new Error('cobrand theme requires partner_accent: '+theme.id);
  }
}
for(const required of ['freepass','cobrand','white-label']){
  if(!registry.theme_modes.includes(required)) throw new Error('missing theme mode: '+required);
}
for(const role of ['semantic.success','semantic.warning','semantic.danger','semantic.focus','semantic.disabled','interaction-state-semantics']){
  if(!registry.invariant_roles.includes(role)) throw new Error('missing invariant role: '+role);
}
console.log('PASS: UI brand themes '+registry.themes.length+' / modes '+registry.theme_modes.join(', '));
