// Static development inventory. Never imports or runs the inspected projects.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import ts from '../portal/node_modules/typescript/lib/typescript.js';
const here=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.resolve(process.argv[2]||'C:/dev');
const output=path.resolve(process.argv[3]||path.join(here,'portal/public/catalog/functions.json'));
const excluded={},errors=[],projects=[],modules=[],functions=[],pythonFiles=[];
const skip=new Set(['node_modules','.git','.next','.vercel','.wrangler','.firebase','.venv','venv','dist','build','out','coverage','__pycache__','reviews','runs','sessions','logs','data','exports','uploads','downloads','generated','generated_images','vendor','vendors','private','secrets','고객','계약','사건','증거','첨부']);
const sensitive=/credential|secret|service.?account|private.?key|oauth|customer|client.?data|고객|주민|급여|소송|판결|개인정보|지분인수/i;
const code=/\.(?:[cm]?[jt]sx?|py|gs|vue|svelte|ps1|sh)$/i;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const bump=k=>{excluded[k]=(excluded[k]||0)+1};
const relative=p=>path.relative(root,p).replaceAll('\\','/');
const category=p=>p.includes('/portal/app/')?'ui':/auth|permission|session|access|인증|권한/i.test(p)?'security':/api\/|route\.|adapter|integration|webhook|연결/i.test(p)?'integrations':/calc|estimate|price|payment|settle|금액|정산/i.test(p)?'calculation':/format|date|time|parse|convert|normaliz|표기|변환/i.test(p)?'conversion':/valid|schema|verify|audit|check|검증/i.test(p)?'validation':/store|repository|database|firebase|firestore|query|sync/i.test(p)?'data':/components\/|hooks\/|use[A-Z]/.test(p)?'ui':'shared';
function git(p,args){const r=spawnSync('git',['-C',p,...args],{encoding:'utf8',timeout:10000,windowsHide:true});return r.status===0?r.stdout.trim():null}
function typeName(node){if(!node)return '미명시';if(ts.isTypeReferenceNode(node))return node.typeName.getText();return ts.SyntaxKind[node.kind]||'미확인'}
function scan(file,project){
 const rel=relative(file),ext=path.extname(file).toLowerCase();
 if(sensitive.test(path.basename(file))){bump('sensitive_name');return}
 let bytes;try{if(fs.statSync(file).size>1500000){bump('over_1_5MB');return}bytes=fs.readFileSync(file)}catch{errors.push({path:rel,reason:'read_failed'});return}
 const id=sha(rel).slice(0,16),m={id,project:project.name,path:rel,sha256:sha(bytes),category:category(rel),language:ext.slice(1),inspection:'static_only',functions:0,callableNodes:0,imports:[],consumers:[],unresolvedLocalImports:0,parseErrors:[],isTest:/(?:^|\/)(?:__tests__|tests?|specs?)\/|\.(?:test|spec)\.|(?:^|\/)test_[^/]+\.py$/.test(rel)};
 modules.push(m);
 if(ext==='.py'){pythonFiles.push({file,id,path:rel,project:project.name});return}
 if(['.vue','.svelte','.ps1','.sh'].includes(ext)){m.inspection='file_only_unsupported_parser';return}
 const text=bytes.toString('utf8'),sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ext.includes('x')?ts.ScriptKind.TSX:ext==='.js'||ext==='.mjs'||ext==='.cjs'||ext==='.gs'?ts.ScriptKind.JS:ts.ScriptKind.TS);
 m.parseErrors=sf.parseDiagnostics.map(d=>({line:sf.getLineAndCharacterOfPosition(d.start||0).line+1,code:d.code}));
 function add(node,name,kind){
  const start=node.getStart(sf);functions.push({id:sha(rel+':'+start).slice(0,16),moduleId:id,project:project.name,name,line:sf.getLineAndCharacterOfPosition(start).line+1,endLine:sf.getLineAndCharacterOfPosition(node.end).line+1,kind,parameters:(node.parameters||[]).map(p=>({name:ts.isIdentifier(p.name)?p.name.text:'destructured',type:typeName(p.type),optional:!!(p.questionToken||p.initializer),rest:!!p.dotDotDotToken})),output:typeName(node.type),async:!!node.modifiers?.some(x=>x.kind===ts.SyntaxKind.AsyncKeyword),runtimeVerified:false});m.functions++;
 }
 function walk(n){
  if((ts.isFunctionDeclaration(n)||ts.isFunctionExpression(n)||ts.isArrowFunction(n)||ts.isMethodDeclaration(n)||ts.isConstructorDeclaration(n)||ts.isGetAccessorDeclaration(n)||ts.isSetAccessorDeclaration(n))&&n.body)m.callableNodes++;
  if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier&&ts.isStringLiteral(n.moduleSpecifier))m.imports.push(n.moduleSpecifier.text);
  if(ts.isCallExpression(n)&&n.arguments.length===1&&ts.isStringLiteral(n.arguments[0])&&(n.expression.kind===ts.SyntaxKind.ImportKeyword||(ts.isIdentifier(n.expression)&&n.expression.text==='require')))m.imports.push(n.arguments[0].text);
  if(ts.isFunctionDeclaration(n)&&n.body)add(n,n.name?.text||'default','function');
  else if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.initializer&&(ts.isArrowFunction(n.initializer)||ts.isFunctionExpression(n.initializer)))add(n.initializer,n.name.text,'function-variable');
  else if(ts.isMethodDeclaration(n)&&n.body&&ts.isIdentifier(n.name))add(n,n.name.text,'method');
  else if((ts.isPropertyAssignment(n)||ts.isPropertyDeclaration(n))&&ts.isIdentifier(n.name)&&n.initializer&&(ts.isArrowFunction(n.initializer)||ts.isFunctionExpression(n.initializer)))add(n.initializer,n.name.text,'property-function');
  else if(ts.isConstructorDeclaration(n)&&n.body)add(n,'constructor','constructor');
  else if((ts.isGetAccessorDeclaration(n)||ts.isSetAccessorDeclaration(n))&&n.body&&ts.isIdentifier(n.name))add(n,n.name.text,'accessor');
  ts.forEachChild(n,walk);
 }
 walk(sf);
}
function walk(dir,project){let entries;try{entries=fs.readdirSync(dir,{withFileTypes:true})}catch{errors.push({path:relative(dir),reason:'directory_read_failed'});return}
 if(project.name==='aiops'&&dir===path.join(root,'aiops'))entries=entries.filter(e=>{const allowed=e.isDirectory()?['lib','src','scripts','engine','engines','tests','adapters','components','apps','packages','routes','api'].includes(e.name):code.test(e.name);if(!allowed)bump('aiops_outside_code_allowlist');return allowed});
 for(const e of entries){const p=path.join(dir,e.name);if(e.isSymbolicLink()){bump('link');continue}if(e.isDirectory()){if(skip.has(e.name)||e.name.startsWith('.')||/^(?:backup|tmp|temp)/i.test(e.name)||sensitive.test(e.name)){bump('excluded_directory');continue}if(p===path.join(here,'ssot/work')){bump('derived_ssot_work');continue}if(p===path.join(here,'portal')){walk(path.join(p,'app'),project);scan(path.join(p,'build-static.mjs'),project);bump('generated_portal');continue}walk(p,project)}else if(e.isFile()&&code.test(e.name)&&!e.name.endsWith('.d.ts')&&!e.name.endsWith('.min.js'))scan(p,project)}
}
for(const e of fs.readdirSync(root,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){if(!e.isDirectory()||e.isSymbolicLink()||(e.name.startsWith('.')&&!fs.existsSync(path.join(root,e.name,'.git')))||skip.has(e.name.toLowerCase())||sensitive.test(e.name)){bump('excluded_root_entry');continue}const p=path.join(root,e.name);const project={name:e.name,head:git(p,['rev-parse','HEAD']),dirty:git(p,['status','--porcelain','--untracked-files=no']),authority:'unconfirmed'};project.dirty=project.dirty===null?null:!!project.dirty;projects.push(project);walk(p,project);console.log(e.name)}
if(pythonFiles.length){const result=spawnSync('python',[path.join(here,'scripts/function-python-index.py')],{input:JSON.stringify(pythonFiles),encoding:'utf8',maxBuffer:100*1024*1024,windowsHide:true});if(result.status!==0)throw Error('Python static parser failed');const parsed=JSON.parse(result.stdout);functions.push(...parsed.functions);const byId=new Map(modules.map(m=>[m.id,m]));for(const item of parsed.modules){const m=byId.get(item.id);if(item.sha256&&item.sha256!==m.sha256)throw Error('Python source changed during collection');m.functions=item.functions;m.callableNodes=item.callableNodes;m.parseErrors=item.parseErrors}}
const byPath=new Map(modules.map(m=>[m.path,m]));
for(const m of modules){let external=0;for(const imp of new Set(m.imports)){const base=imp.startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(m.path),imp)):null;if(!base){if(imp.startsWith('@/')||imp.startsWith('~/'))m.unresolvedLocalImports++;else external++;continue}const paths=[base,...['.ts','.tsx','.js','.jsx','.mjs','.cjs','/index.ts','/index.tsx','/index.js'].map(e=>base+e)];if(/\.js$/.test(base))paths.push(base.slice(0,-3)+'.ts',base.slice(0,-3)+'.tsx');const found=[...new Set(paths.map(p=>byPath.get(p)).filter(Boolean))];if(found.length===1){found[0].consumers.push(m.id)}else m.unresolvedLocalImports++}m.consumers=[...new Set(m.consumers)];m.externalImports=external;delete m.imports}
for(const m of modules){m.consumers=[...new Set(m.consumers)];m.unindexedCallables=Math.max(0,m.callableNodes-m.functions)}
// A module import is evidence of a reference, never evidence that a function ran.
const rawGroups=new Map();for(const m of modules){const group=rawGroups.get(m.sha256)||[];group.push(m.id);rawGroups.set(m.sha256,group)}
const data={capturedAt:new Date().toISOString(),scope:root.replaceAll('\\','/'),kind:'derived_inventory_not_authority',coverage:{projects:projects.length,modules:modules.length,functions:functions.length,unindexedCallables:modules.reduce((n,m)=>n+m.unindexedCallables,0),uniqueFileContents:rawGroups.size,pythonFiles:pythonFiles.length,unsupportedModules:modules.filter(m=>m.inspection==='file_only_unsupported_parser').length,parseErrorFiles:modules.filter(m=>m.parseErrors.length).length,readErrors:errors.length,excluded},limitations:['일반 개발 소스의 정적 선언 목록. 실행 여부·업무 의미·승인된 정본은 개별 대조 필요','익명 콜백·동적 생성·래퍼로 감싼 함수·재수출 별칭은 독립 기능으로 완전히 추출하지 못함','상대경로 import만 직접 연결. 별칭·동적 경로·Python 호출 그래프는 미해결','입력 기본값·구현 본문·주석·접속정보는 게시하지 않음. 반환 타입 미명시는 결함 판정이 아님','민감 경로·생성물·링크·1.5MB 초과 파일·원격 전용 프로젝트는 조사 범위 밖','Vue/Svelte/PowerShell/Shell은 파일만 등록. 테스트 파일 존재는 검증 통과가 아님'],projects,modules,functions,duplicates:[...rawGroups].filter(([,ids])=>ids.length>1).map(([sha256,moduleIds])=>({sha256,moduleIds})),errors};
fs.mkdirSync(path.dirname(output),{recursive:true});const temporary=output+'.tmp';fs.writeFileSync(temporary,JSON.stringify(data));fs.renameSync(temporary,output);console.log(JSON.stringify(data.coverage));
