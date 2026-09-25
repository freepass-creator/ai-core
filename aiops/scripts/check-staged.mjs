/** Git에 원문·백업·실행 상태·인증정보가 들어가는 것을 막는 최소 pre-commit 검사. */
import { execFileSync } from 'node:child_process';

// ★maxBuffer 를 주지 않으면 스테이징이 많을 때 ENOBUFS 로 죽는다 (2026-08-23 실측 · 170개)
const staged = execFileSync('git', ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  .split('\0').filter(Boolean).map((path) => path.replaceAll('\\', '/'));
const blockedPath = [
  /^\.coordination\//i, /^backups\//i, /^tmp\//i,
  /(^|\/)\.env(?:\.|$)/i, /(^|\/)(?:sa\.json|token[^/]*\.json)$/i,
  /\.key\.json$/i, /\.(?:xlsx|xls|pdf|jpe?g|png)$/i,
];
const bad = staged.filter((path) => blockedPath.some((rule) => rule.test(path)));

for (const path of staged.filter((entry) => !bad.includes(entry))) {
  // 큰 파일 하나에 막히지 않게 — 못 읽으면 «검사 못 함» 으로 남기고 넘어간다
  let text = '';
  try { text = execFileSync('git', ['show', `:${path}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
  catch { continue; }
  if (/-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----|"private_key"\s*:/i.test(text)) bad.push(`${path} (비밀키 형식)`);
}

if (bad.length) {
  process.stderr.write(`커밋 차단: 운영 원문·백업·실행 상태·인증정보는 Git에 올릴 수 없습니다.\n- ${bad.join('\n- ')}\n`);
  process.exit(1);
}
