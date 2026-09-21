import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const digest = body => createHash('sha256').update(body).digest('hex');
const portable = path => path.replaceAll('\\', '/').replace(/^docs\//, 'standards/');

async function put(path, body) {
  await mkdir(dirname(path), { recursive: true });
  try {
    const current = await readFile(path, 'utf8');
    if (current !== body) throw new Error(`KIT_FILE_CONFLICT:${path}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeFile(path, body, { flag: 'wx' });
  }
}

export async function installAcademyStarterKit({ output, receipt, readings, coreRevision }) {
  if (receipt?.status !== 'READY') throw new Error('READY_RECEIPT_REQUIRED');
  const files = [];
  for (const item of readings) {
    const path = portable(item.path);
    await put(join(output, path), item.body);
    files.push({ path, sha256: digest(item.body), source: item.path });
  }
  const manifest = {
    schema: 'ai-core-starter-kit/v1', core_revision: coreRevision, generated_at: receipt.observed_at,
    task: receipt.task, track: receipt.track, target: receipt.target, files,
    verification: receipt.precheck.completion_verification,
    reuse_policy: 'New assets require a recorded reuse decision before creation.',
  };
  const start = `# AI 작업 시작 키트\n\n1. \`kit.json\`의 대상 repository와 baseline revision을 확인한다.\n2. \`standards/\`의 규격만 적용하고 대상 프로젝트 지침을 우선한다.\n3. 기존 자산을 먼저 찾고, 새 자산은 재사용 판정을 기록한다.\n4. \`node .ai-core/verify-kit.mjs\`로 키트 무결성을 확인한다.\n5. 완료 시 \`WORK_RESULT.md\`를 채운다.\n`;
  const result = `# AI Work Result\n\n- 목적: ${receipt.task}\n- 대상 revision: ${receipt.target.revision}\n- 변경:\n- 검증:\n- 남음:\n- next_start_here:\n`;
  const verifier = `import{createHash}from'node:crypto';import{readFile}from'node:fs/promises';import{dirname,join}from'node:path';import{fileURLToPath}from'node:url';const root=dirname(fileURLToPath(import.meta.url));const m=JSON.parse(await readFile(join(root,'kit.json'),'utf8'));const bad=[];for(const f of m.files){const b=await readFile(join(root,f.path),'utf8');if(createHash('sha256').update(b).digest('hex')!==f.sha256)bad.push(f.path)}console.log(JSON.stringify({schema:'ai-core-starter-kit-check/v1',status:bad.length?'FAIL':'PASS',core_revision:m.core_revision,changed:bad},null,2));if(bad.length)process.exitCode=1;\n`;
  await put(join(output, 'START_HERE.md'), start);
  await put(join(output, 'WORK_RESULT.md'), result);
  await put(join(output, 'verify-kit.mjs'), verifier);
  await put(join(output, 'kit.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { status: 'INSTALLED', output, manifest, entrypoint: join(output, 'START_HERE.md') };
}
