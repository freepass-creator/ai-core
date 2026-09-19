import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { buildProjectCapsule } from '../src/engine/project-capsule.mjs';

const schema=JSON.parse(await readFile(new URL('../contracts/project-capsule.schema.json',import.meta.url),'utf8'));
const ajv=new Ajv2020({allErrors:true,strict:true});
addFormats(ajv);
const validate=ajv.compile(schema);

test('생성된 capsule이 계약 schema를 만족한다',()=>{
  const capsule=buildProjectCapsule({
    project_id:'sample-project',repository:'owner/sample',default_branch:'main',
    subject_revision:'a'.repeat(40),observed_at:'2026-09-19T03:40:00Z',
    tree_paths:['README.md','package.json','package-lock.json','src/app.js'],
    package_json:{scripts:{test:'node --test',build:'node build.mjs'}},
  });
  assert.equal(validate(capsule),true,JSON.stringify(validate.errors));
});
