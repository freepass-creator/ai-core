// 추적 파일(기본) 또는 스테이징된 파일(--staged)에서 비밀·주민번호를 찾는다.
//   node scripts/check-secrets.mjs            exit 0 통과 · 1 발견
//   node scripts/check-secrets.mjs --staged   커밋 전 훅용
// 결과에는 파일·줄·규칙만 찍는다. 값은 찍지 않는다.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { scanFiles } from '../shared-services/security/secret-scan.mjs';

const staged = process.argv.includes('--staged');
const list = staged
  ? execFileSync('git', ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  : execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const paths = list.split('\0').filter(Boolean);
const read = staged
  ? path => execFileSync('git', ['show', `:${path}`], { maxBuffer: 64 * 1024 * 1024 })
  : path => readFileSync(path);
const findings = scanFiles(paths, read);
if (findings.length) {
  console.error(`FAIL: 비밀·개인정보 패턴 ${findings.length}건 — 값은 찍지 않는다`);
  for (const f of findings) console.error(`- ${f.path}${f.line ? `:${f.line}` : ''} ${f.rule}`);
  process.exit(1);
}
console.log(`PASS: ${staged ? '스테이징' : '추적'} 파일 ${paths.length}개에서 비밀·주민번호 없음`);
