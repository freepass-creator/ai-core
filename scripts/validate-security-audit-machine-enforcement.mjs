import Ajv2020 from 'ajv/dist/2020.js';
import { readFile } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessSecurityMachineEnforcement } from '../src/security/machine-enforcement-gate.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const schema=JSON.parse(await readFile(resolve(root,'contracts/security-machine-enforcement-gate.schema.json'),'utf8'));
const registry=JSON.parse(await readFile(resolve(root,'registry/security-audit-machine-enforcement.json'),'utf8'));

const ajv=new Ajv2020({allErrors:true,strict:false});
const validate=ajv.compile(schema);
if(!validate(registry)) {
  console.error(JSON.stringify({status:'INVALID_SCHEMA',errors:validate.errors},null,2));
  process.exit(1);
}

let report;
try {
  report=assessSecurityMachineEnforcement(registry);
} catch(error) {
  console.error(JSON.stringify({status:'INVALID_SEMANTICS',error:error.message},null,2));
  process.exit(1);
}

console.log(JSON.stringify(report,null,2));
if(process.argv.includes('--require-ready')&&!report.machine_enforcement_allowed) process.exitCode=1;
