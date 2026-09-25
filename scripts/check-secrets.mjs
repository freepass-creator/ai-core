// 추적 파일(기본) 또는 스테이징된 파일(--staged)에서 비밀·주민번호를 찾는다.
//   node scripts/check-secrets.mjs            exit 0 통과 · 1 발견
//   node scripts/check-secrets.mjs --staged   커밋 전 훅용
// 결과에는 파일·줄·규칙만 찍는다. 값은 찍지 않는다.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { scanFiles, scanText } from '../shared-services/security/secret-scan.mjs';

// --self-test: 알려진 나쁜 표본은 전부 잡고, 알려진 안전한 표본은 하나도 안 잡아야 한다.
//   표본 글자는 실행 중에 이어 붙인다 — 저장소 검사에 표본 자체가 걸리지 않게.
if (process.argv.includes('--self-test')) {
  const j = (...parts) => parts.join('');
  const mustCatch = [
    ['GOOGLE_API_KEY', 'a.js', j('AIza', 'Sy', 'B'.repeat(33))],
    ['PRIVATE_KEY', 'k.txt', j('-----BEGIN ', 'PRIVATE KEY-----')],
    ['SERVICE_ACCOUNT_KEY', 's.txt', j('{"private', '_key": "-----BEGIN RSA')],
    ['GITHUB_TOKEN', 'g.md', j('ghp', '_', 'c'.repeat(36))],
    ['GITHUB_PAT', 'g.md', j('github', '_pat_', 'd'.repeat(40))],
    ['SLACK_TOKEN', 's.md', j('xox', 'b-', 'e'.repeat(24))],
    ['OPENAI_KEY', 'o.md', j('sk', '-', 'f'.repeat(40))],
    ['AWS_ACCESS_KEY', 'a.md', j('AK', 'IA', 'G'.repeat(16))],
    ['KR_RRN', 'r.md', j('850315', '-', '1', '834561')],
    ['ENV_FILE', '.env', ''],
    ['SERVICE_ACCOUNT_FILE', 'tmp/sa.json', ''],
    ['TOKEN_FILE', 'srv/token.json', ''],
    ['KEY_FILE', 'certs/prod.pem', ''],
  ];
  const mustPass = [
    ['dummy RRN', 'r.md', j('900101', '-', '1234567')],
    ['allow marker', 'a.js', j('AIza', 'Sy', 'B'.repeat(33), ' // secret-scan: allow public web key')],
    ['design tokens.json', 'design-system/tokens.json', ''],
    ['env template', '.env.local.example', ''],
  ];
  const broken = [];
  for (const [rule, path, text] of mustCatch) {
    if (!scanText(path, text).some(f => f.rule === rule)) broken.push(`missed ${rule}`);
  }
  for (const [name, path, text] of mustPass) {
    if (scanText(path, text).length) broken.push(`false positive: ${name}`);
  }
  if (broken.length) { console.error(`CHECKER BROKEN: ${broken.join(' · ')}`); process.exit(1); }
  console.log(`PASS: self-test ${mustCatch.length} caught · ${mustPass.length} left alone`);
  process.exit(0);
}

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
