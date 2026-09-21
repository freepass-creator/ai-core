import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const path=resolve(process.argv[2]??'registry/operating-knowledge.json');
const j=JSON.parse(await readFile(path,'utf8'));
const errors=[];
if(j.schema_version!=='1.0')errors.push('SCHEMA_VERSION_INVALID');
if(!Array.isArray(j.confirmed_decisions)||!j.confirmed_decisions.length)errors.push('DECISIONS_REQUIRED');
if(!Array.isArray(j.methods)||!j.methods.length)errors.push('METHODS_REQUIRED');
if(!j.user_work_style||Object.keys(j.user_work_style).length<6)errors.push('USER_WORK_STYLE_INCOMPLETE');
if(!Array.isArray(j.platforms)||j.platforms.length<5)errors.push('PLATFORM_CATALOG_INCOMPLETE');
const ids=[...(j.confirmed_decisions??[]),...(j.methods??[])].map(x=>x.id);
if(new Set(ids).size!==ids.length)errors.push('DUPLICATE_ID');
for(const m of j.methods??[]){if(!m.canonical_refs?.length)errors.push(`CANONICAL_REFS_REQUIRED:${m.id}`);if(!m.do_not_ask?.length)errors.push(`DO_NOT_ASK_REQUIRED:${m.id}`);if(!m.ask_only_if_missing?.length)errors.push(`ASK_BOUNDARY_REQUIRED:${m.id}`);if(JSON.stringify(m).match(/password|access_token|refresh_token/i))errors.push(`SECRET_FIELD_FORBIDDEN:${m.id}`)}
for(const p of j.platforms??[]){if(!p.canonical_refs?.length||!p.procedure?.length||!p.completion_evidence?.length||!p.do_not_ask?.length||!p.forbidden?.length)errors.push(`PLATFORM_INCOMPLETE:${p.id}`)}
console.log(JSON.stringify({schema:'ai-core-operating-knowledge-validation/v1',status:errors.length?'INVALID':'VALID',errors},null,2));if(errors.length)process.exitCode=1;
