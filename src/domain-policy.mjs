export const SUPPORTED_DOMAINS = new Set([
  'development', 'document', 'legal', 'business', 'communication'
]);

export const SUPPORTED_RISKS = new Set(['A', 'B', 'C', 'D']);

const DEV_HINTS = [
  '개발', '코드', 'ui', 'ux', 'erp', '웹', '앱', '버그', '기능',
  'firebase', 'react', 'typescript', 'javascript', 'api', 'web', 'app', 'software',
  'frontend', 'backend', 'database', 'server', 'deploy'
];
const DOC_HINTS = ['문서', '보고서', '계약서', '양식', 'document', 'report', 'pdf', 'form'];
const LEGAL_HINTS = [
  '법률', '소송', '준비서면', '고소', '판례', '법원', '법령', '계약', '약관',
  '개인정보', '프라이버시', '규제', '준법', '컴플라이언스', '노동', '근로',
  '해고', '세금', '세무', '허가', '면허', '저작권', '상표', '특허', '분쟁', '중재',
  'law', 'legal', 'litigation', 'lawsuit', 'court', 'statute', 'case law', 'contract',
  'contractual', 'terms of service', 'privacy', 'personal data', 'regulation', 'regulatory',
  'compliance', 'gdpr', 'ccpa', 'labor', 'employment', 'dismissal', 'termination', 'tax',
  'permit', 'license', 'licensing', 'copyright', 'trademark', 'patent', 'dispute',
  'arbitration'
];
const COMMUNICATION_HINTS = [
  '이메일', '메일', '메시지', '공문', '안내문', '회신', 'email', 'message', 'reply'
];

function matchesHint(normalizedGoal, hint) {
  if (!/^[a-z0-9 ]+$/.test(hint)) return normalizedGoal.includes(hint);
  const escaped = hint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(normalizedGoal);
}

function inferSignaledDomains(goal) {
  if (typeof goal !== 'string') throw new Error('goal must be a string');
  const normalized = goal.toLowerCase();
  const domains = [];
  if (LEGAL_HINTS.some(hint => matchesHint(normalized, hint))) domains.push('legal');
  if (DEV_HINTS.some(hint => matchesHint(normalized, hint))) domains.push('development');
  if (DOC_HINTS.some(hint => matchesHint(normalized, hint))) domains.push('document');
  if (COMMUNICATION_HINTS.some(hint => matchesHint(normalized, hint))) {
    domains.push('communication');
  }
  return domains;
}

export function inferApplicableDomains(goal) {
  const domains = inferSignaledDomains(goal);
  return domains.length ? domains : ['business'];
}

export function effectiveDomains(task = {}) {
  if (task.applicable_domains != null && !Array.isArray(task.applicable_domains)) {
    throw new Error('applicable_domains must be an array');
  }
  const inferred = typeof task.goal === 'string' && task.goal.trim()
    ? inferSignaledDomains(task.goal)
    : [];
  const domains = [...new Set([
    task.domain,
    ...(task.applicable_domains ?? []),
    ...inferred
  ].filter(Boolean))];
  if (!domains.length && typeof task.goal === 'string' && task.goal.trim()) {
    domains.push('business');
  }
  if (!domains.length) throw new Error('domain is required');
  for (const domain of domains) {
    if (!SUPPORTED_DOMAINS.has(domain)) throw new Error(`unsupported domain: ${domain}`);
  }
  return domains;
}

export function effectiveRisk(task = {}, domains = effectiveDomains(task)) {
  const requested = task.risk ?? (domains.includes('legal') ? 'C' : 'A');
  if (!SUPPORTED_RISKS.has(requested)) throw new Error(`unsupported risk: ${requested}`);
  return domains.includes('legal') && ['A', 'B'].includes(requested) ? 'C' : requested;
}
