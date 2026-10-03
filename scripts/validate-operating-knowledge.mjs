import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
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
// ★2026-10-03: 교훈이 각 AI 의 개인 메모리에만 있어 다른 AI 가 못 배웠다 → lessons 를 여기 두고 꼴을 강제한다.
//   깨진 ref(없는 파일)를 가리키던 것도 이때 드러났다 → canonical_refs 는 실재해야 하고, 사라진 것은 retired_refs 에 까닭과 함께 남긴다.
const root=resolve(dirname(path),'..');
for(const x of [...(j.methods??[]),...(j.platforms??[])]){for(const r of x.canonical_refs??[]){if(/^[\w.-]+\//.test(r)&&!existsSync(resolve(root,r)))errors.push(`CANONICAL_REF_MISSING:${x.id}:${r}`)}for(const r of x.retired_refs??[]){if(!r.path||!r.status||!r.note||!r.evidence)errors.push(`RETIRED_REF_INCOMPLETE:${x.id}`)}}
if(!Array.isArray(j.lessons)||!j.lessons.length)errors.push('LESSONS_REQUIRED');
const lessonIds=(j.lessons??[]).map(x=>x.id);
if(new Set([...ids,...lessonIds]).size!==ids.length+lessonIds.length)errors.push('DUPLICATE_ID');
for(const l of j.lessons??[]){
  if(!/^lesson\.[a-z0-9-]+$/.test(l.id??''))errors.push(`LESSON_ID_INVALID:${l.id}`);
  if(!l.lesson||!l.how_to_apply)errors.push(`LESSON_INCOMPLETE:${l.id}`);
  if(!Array.isArray(l.evidence)||!l.evidence.length||l.evidence.some(e=>!/^\d{4}-\d{2}-\d{2}$/.test(e.date??'')||!e.observed))errors.push(`LESSON_EVIDENCE_REQUIRED:${l.id}`);
  // 헌법 §5: 노하우는 현재 상태와 적용 범위·적용하면 안 되는 조건을 가진다. 한 프로젝트의 성공은 ADOPTED_LOCAL 이다.
  if(!['CANDIDATE','ADOPTED_LOCAL','ADOPTED_DOMAIN','ADOPTED_UNIVERSAL','HOLD','REJECTED','SUPERSEDED'].includes(l.status))errors.push(`LESSON_STATUS_INVALID:${l.id}`);
  if(!l.applies_to||!l.not_applicable_when)errors.push(`LESSON_SCOPE_REQUIRED:${l.id}`);
  if(!('check' in l))errors.push(`LESSON_CHECK_FIELD_REQUIRED:${l.id}`);
  else if(l.check!==null){const c=l.check;if(typeof c.command!=='string'||c.cwd!=='ai-core-root'||c.read_only!==true||c.pass_exit_code!==0)errors.push(`LESSON_CHECK_INVALID:${l.id}`);else{const s=c.command.match(/^node (scripts\/\S+\.mjs)/);if(!s||!existsSync(resolve(root,s[1])))errors.push(`LESSON_CHECK_NOT_FOUND:${l.id}`)}}
  if(JSON.stringify(l).match(/\d{6}-?[1-4]\d{6}|password|access_token|refresh_token/i))errors.push(`LESSON_SENSITIVE:${l.id}`);
}
console.log(JSON.stringify({schema:'ai-core-operating-knowledge-validation/v1',status:errors.length?'INVALID':'VALID',errors},null,2));if(errors.length)process.exitCode=1;
