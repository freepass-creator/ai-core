const need=(condition,code)=>{if(!condition) throw new Error(code);};
const nonempty=value=>typeof value==='string'&&value.trim()===value&&value.length>0;
const sha=value=>typeof value==='string'&&/^[0-9a-f]{40}$/.test(value);
const cleanPaths=paths=>[...new Set((paths??[]).filter(nonempty).map(x=>x.replaceAll('\\','/').replace(/^\.\//,'')))].sort();
const has=(paths,name)=>paths.includes(name);
const any=(paths,predicate)=>paths.some(predicate);

function framework(packageJson,paths){
  const deps={...(packageJson?.dependencies??{}),...(packageJson?.devDependencies??{})};
  if(deps.next||has(paths,'next.config.js')||has(paths,'next.config.mjs')||has(paths,'next.config.ts')) return 'Next.js';
  if(deps.vite||any(paths,p=>/^vite\.config\./.test(p))) return 'Vite';
  if(deps.react) return 'React';
  if(deps.vue) return 'Vue';
  return null;
}
function packageManager(paths){
  if(has(paths,'pnpm-lock.yaml')) return 'pnpm';
  if(has(paths,'yarn.lock')) return 'yarn';
  if(has(paths,'package-lock.json')) return 'npm';
  if(has(paths,'package.json')) return 'npm';
  return null;
}
function command(manager,script){
  if(!script) return null;
  if(manager==='pnpm') return `pnpm run ${script}`;
  if(manager==='yarn') return `yarn ${script}`;
  return `npm run ${script}`;
}
function installCommand(manager,paths){
  if(manager==='npm') return has(paths,'package-lock.json')?'npm ci':'npm install';
  if(manager==='pnpm') return 'pnpm install --frozen-lockfile';
  if(manager==='yarn') return 'yarn install --frozen-lockfile';
  return null;
}
function classify(paths,packageJson){
  if(packageJson) return 'NODE_APP';
  if(has(paths,'index.html')) return 'STATIC_WEB';
  if(any(paths,p=>/^(docs|문서|사건|양식)\//.test(p))||has(paths,'README.md')) return 'DOCUMENT_REPO';
  if(any(paths,p=>/^(scripts|tools|engine|lib)\//.test(p))) return 'TOOLKIT';
  return 'UNKNOWN';
}
function delivery(paths,pkg){
  const targets=[];
  if(has(paths,'vercel.json')||any(paths,p=>/^\.vercel\//.test(p))||framework(pkg,paths)==='Next.js') targets.push('Vercel-candidate');
  if(has(paths,'firebase.json')||has(paths,'.firebaserc')||has(paths,'firebase.auth.json')) targets.push('Firebase-candidate');
  const workflows=paths.filter(p=>/^\.github\/workflows\/[^/]+\.(ya?ml)$/.test(p));
  return {targets:[...new Set(targets)],workflows};
}
function dataEvidence(paths,pkg){
  const deps={...(pkg?.dependencies??{}),...(pkg?.devDependencies??{})};
  const evidence=[];
  if(deps.firebase||deps['firebase-admin']||has(paths,'firebase.json')||has(paths,'firebase.auth.json')) evidence.push('firebase-present');
  if(deps['@supabase/supabase-js']) evidence.push('supabase-present');
  if(any(paths,p=>/(firestore|rtdb|database|schema|migration)/i.test(p))) evidence.push('data-contract-or-migration-files-present');
  if(has(paths,'.env.example')) evidence.push('environment-contract-present');
  return evidence;
}
function instructions(paths){
  return ['README.md','AGENTS.md','CLAUDE.md','GEMINI.md','WORK_READ_FIRST.md']
    .filter(name=>has(paths,name));
}

export function buildProjectCapsule(observation){
  need(observation&&typeof observation==='object','PROJECT_OBSERVATION_REQUIRED');
  const {project_id,repository,default_branch,subject_revision,observed_at}=observation;
  need(nonempty(project_id)&&/^[a-z][a-z0-9-]{1,62}$/.test(project_id),'PROJECT_ID_INVALID');
  need(nonempty(repository)&&/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository),'REPOSITORY_INVALID');
  need(nonempty(default_branch),'DEFAULT_BRANCH_REQUIRED');
  need(sha(subject_revision),'SUBJECT_REVISION_INVALID');
  need(Number.isFinite(Date.parse(observed_at)),'OBSERVED_AT_INVALID');

  const paths=cleanPaths(observation.tree_paths);
  need(paths.length>0,'PROJECT_TREE_EMPTY');
  const pkg=observation.package_json??null;
  if(pkg!==null) need(pkg&&typeof pkg==='object'&&!Array.isArray(pkg),'PACKAGE_JSON_INVALID');
  const manager=packageManager(paths);
  const scripts=pkg?.scripts??{};
  const kind=classify(paths,pkg);
  const fw=framework(pkg,paths);

  const test=scripts.test?command(manager,'test'):null;
  const build=scripts.build?command(manager,'build'):null;
  const start=scripts.start?command(manager,'start'):scripts.dev?command(manager,'dev'):null;
  const install=installCommand(manager,paths);
  const absent={};
  if(!test) absent.test=kind==='STATIC_WEB'?'정적 웹 저장소로 package test 스크립트가 없다.':'package test 스크립트가 확인되지 않았다.';
  if(!build) absent.build=kind==='STATIC_WEB'?'정적 파일 자체가 배포 산출물이며 별도 build 스크립트가 없다.':'build 스크립트가 확인되지 않았다.';
  if(!install) absent.install='패키지 매니저 manifest/lockfile이 확인되지 않았다.';

  const blockers=[];
  if(!has(paths,'README.md')) blockers.push('README_MISSING');
  if(kind==='UNKNOWN') blockers.push('PROJECT_KIND_UNKNOWN');
  if(kind==='NODE_APP'&&!pkg) blockers.push('PACKAGE_JSON_MISSING');
  if(kind==='NODE_APP'&&!test&&!build) blockers.push('NO_TEST_OR_BUILD_ENTRYPOINT');
  if(!instructions(paths).length) blockers.push('OPERATING_INSTRUCTIONS_MISSING');

  const deliveryInfo=delivery(paths,pkg);
  const evidenceRefs=[
    `GIT:${repository}@${subject_revision}`,
    ...['README.md','package.json','package-lock.json','pnpm-lock.yaml','yarn.lock','vercel.json','firebase.json','.env.example']
      .filter(p=>has(paths,p)).map(p=>`READ:${repository}/${p}@${subject_revision}`),
    ...deliveryInfo.workflows.map(p=>`READ:${repository}/${p}@${subject_revision}`),
  ];

  return {
    schema:'ai-core-project-capsule/v1',
    project_id,repository,default_branch,subject_revision,observed_at,
    classification:{kind,framework:fw,package_manager:manager},
    commands:{install,test,build,start,absent_reason:absent},
    delivery:deliveryInfo,
    instructions:instructions(paths),
    data_evidence:dataEvidence(paths,pkg),
    readiness:{
      status:blockers.length?'HOLD':'READY_FOR_REGISTRY_REVIEW',
      blockers,
      review_required:true,
    },
    evidence_refs:[...new Set(evidenceRefs)],
  };
}

export function buildProjectCapsuleAdapter(input){
  const observation=input?.observation??input;
  const capsule=buildProjectCapsule(observation);
  return {
    status:capsule.readiness.status==='READY_FOR_REGISTRY_REVIEW'?'SUCCEEDED':'HOLD',
    summary:capsule.readiness.status==='READY_FOR_REGISTRY_REVIEW'
      ?'프로젝트 source-review capsule을 만들었습니다. registry 반영은 별도 검토가 필요합니다.'
      :'프로젝트 capsule에 source-review blocker가 남았습니다.',
    data:capsule,
    evidence:[...capsule.evidence_refs],
    artifacts:[],
    checks:[{name:'project.capsule',status:capsule.readiness.status==='READY_FOR_REGISTRY_REVIEW'?'PASS':'FAIL',detail:capsule.readiness.blockers.join(',')||null}],
    blockers:[...capsule.readiness.blockers],
    next_action:'capsule 근거를 검토한 뒤 registry 상태·명령·배포 경계를 별도 변경합니다.',
    external_effect:false,
  };
}