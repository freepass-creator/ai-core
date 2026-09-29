// 비밀·개인정보 검사 — 본사 공통판.
//
// 두 원본을 합쳤다:
//   · renman scripts/check-secrets.mts   — 추적 파일 전체에서 키·토큰 패턴(Google·개인키·GitHub·Slack)
//   · aiops  scripts/check-staged.mjs    — 커밋 전: .env·서비스계정 json·백업·원문 파일 경로 차단, "private_key" json
// 그리고 2026-09-25 aiops 에서 실제로 나온 사고를 막는 규칙을 더했다: 주민등록번호 전체(앞6-뒤7).
//
// 예외는 줄 끝 표시 하나뿐이다 — `secret-scan: allow` (왜 괜찮은지 같은 줄에 적는다).
// 흔한 가짜 예시(123456-1234567 · 110111-1234567 · 900101-1234567 등 뒤 1234567)는 주민번호로 세지 않는다.

export const CONTENT_RULES = [
  { id: 'GOOGLE_API_KEY', name: 'Google/Firebase API key', pattern: /AIza[0-9A-Za-z_-]{35}/g },
  { id: 'PRIVATE_KEY', name: 'private key block', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
  { id: 'SERVICE_ACCOUNT_KEY', name: 'service-account private_key field', pattern: /"private_key"\s*:\s*"-----BEGIN/g },
  { id: 'GITHUB_TOKEN', name: 'GitHub token', pattern: /\bgh[opsu]_[0-9A-Za-z]{36,}\b/g },
  { id: 'GITHUB_PAT', name: 'GitHub fine-grained token', pattern: /\bgithub_pat_[0-9A-Za-z_]{40,}\b/g },
  { id: 'SLACK_TOKEN', name: 'Slack token', pattern: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/g },
  { id: 'OPENAI_KEY', name: 'OpenAI-style secret key', pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/g },
  { id: 'AWS_ACCESS_KEY', name: 'AWS access key id', pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { id: 'KR_RRN', name: '주민등록번호(전체)', pattern: /(?<![0-9])[0-9]{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12][0-9]|3[01])-[1-4][0-9]{6}(?![0-9])/g,
    ignore: match => /-[1-4]234567$/.test(match) || /-[1-4]000000$/.test(match) },
];

export const PATH_RULES = [
  { id: 'ENV_FILE', pattern: /(^|\/)\.env(?:\.[^/]+)?$/i, ignore: path => /\.(?:example|sample|template)$/i.test(path) },
  { id: 'SERVICE_ACCOUNT_FILE', pattern: /(^|\/)(?:sa|service-account[^/]*|credentials?)\.json$/i },
  { id: 'TOKEN_FILE', pattern: /(^|\/)(?:oauth[-_]?)?token(?:[-_](?:cache|store))?\.json$/i }, // tokens.json(디자인 토큰)은 아니다
  { id: 'KEY_FILE', pattern: /(\.key\.json|\.pem|\.p12|\.pfx|id_rsa|id_ed25519)$/i },
];

const ALLOW = /secret-scan:\s*allow/;

/** 한 파일을 본다. 돌려주는 것은 {rule, line} 목록 — 값 자체는 절대 돌려주지 않는다(로그로 새지 않게). */
export function scanText(path, text) {
  const findings = [];
  for (const rule of PATH_RULES) if (rule.pattern.test(path) && !rule.ignore?.(path)) findings.push({ path, rule: rule.id, line: 0 });
  const lines = text.split(/\r?\n/);
  lines.forEach((lineText, index) => {
    if (ALLOW.test(lineText)) return;
    for (const rule of CONTENT_RULES) {
      rule.pattern.lastIndex = 0;
      for (const match of lineText.matchAll(rule.pattern)) {
        if (rule.ignore?.(match[0])) continue;
        findings.push({ path, rule: rule.id, line: index + 1 });
        break;
      }
    }
  });
  return findings;
}

/** 여러 파일을 본다. readFile(path) → Buffer|null. 바이너리(NUL 포함)는 경로 규칙만 본다. */
export function scanFiles(paths, readFile) {
  const findings = [];
  for (const path of paths) {
    let buffer = null;
    try { buffer = readFile(path); } catch { buffer = null; }
    const text = buffer && !buffer.includes(0) ? buffer.toString('utf8') : '';
    findings.push(...scanText(path.replaceAll('\\', '/'), text));
  }
  return findings;
}
