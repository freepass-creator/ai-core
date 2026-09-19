import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubProjectInspector } from '../src/engine/github-project-inspector.mjs';

const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64');

test('GitHub inspector는 branch→commit→tree→package만 읽고 비밀 파일 본문은 읽지 않는다',async()=>{
  const calls=[];
  const gh=async args=>{
    const path=args[0];calls.push(path);
    if(path==='repos/freepass-creator/freepass-admin') return{default_branch:'main'};
    if(path==='repos/freepass-creator/freepass-admin/commits/main') return{sha:'a'.repeat(40)};
    if(path.startsWith('repos/freepass-creator/freepass-admin/git/trees/')) return{
      truncated:false,
      tree:[
        {type:'blob',path:'README.md'},
        {type:'blob',path:'package.json'},
        {type:'blob',path:'package-lock.json'},
        {type:'blob',path:'.env'},
        {type:'blob',path:'.env.example'},
        {type:'blob',path:'src/app.ts'},
      ],
    };
    if(path.startsWith('repos/freepass-creator/freepass-admin/contents/package.json')) return{
      encoding:'base64',content:b64({scripts:{test:'node --test',build:'tsc'}}),
    };
    throw new Error('unexpected '+path);
  };
  const inspect=createGitHubProjectInspector({gh,clock:()=>Date.parse('2026-09-19T03:40:00Z')});
  const result=await inspect({project_id:'freepass-admin',repository:'freepass-creator/freepass-admin'});
  assert.equal(result.subject_revision,'a'.repeat(40));
  assert.equal(result.commands.test,'npm run test');
  assert.equal(calls.some(x=>x.includes('contents/.env')),false);
  assert.equal(calls.filter(x=>x.includes('/contents/')).length,1);
});

test('truncated Git tree는 불완전 source review라 거절한다',async()=>{
  const gh=async args=>{
    const path=args[0];
    if(path==='repos/x/y') return{default_branch:'main'};
    if(path==='repos/x/y/commits/main') return{sha:'a'.repeat(40)};
    return{truncated:true,tree:[]};
  };
  const inspect=createGitHubProjectInspector({gh});
  await assert.rejects(inspect({project_id:'xy',repository:'x/y'}),/PROJECT_TREE_INCOMPLETE/);
});
