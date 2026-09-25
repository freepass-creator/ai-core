import test from 'node:test';
import assert from 'node:assert/strict';
import { scanText } from '../shared-services/security/secret-scan.mjs';

const rules = (path, text = '') => scanText(path, text).map(f => f.rule);
const fakeKey = 'AIza' + 'Sy' + 'A'.repeat(33);
const fakeRrn = ['850315', '1' + '8' + '3' + '4' + '5' + '6' + '1'].join('-');

test('keys and tokens are caught by content', () => {
  assert.deepEqual(rules('a.js', `const k = '${fakeKey}';`), ['GOOGLE_API_KEY']);
  assert.deepEqual(rules('k.pem.txt', '-----BEGIN ' + 'PRIVATE KEY-----'), ['PRIVATE_KEY']);
  assert.deepEqual(rules('sa.txt', '{"private' + '_key": "-----BEGIN RSA'), ['SERVICE_ACCOUNT_KEY']);
  assert.deepEqual(rules('t.md', 'ghp_' + 'a'.repeat(36)), ['GITHUB_TOKEN']);
});

test('a full resident registration number is caught, obvious dummies are not', () => {
  assert.deepEqual(rules('doc.md', `고객 ${fakeRrn}`), ['KR_RRN']);
  assert.deepEqual(rules('doc.md', '예시 900101-1234567 · 110111-1234567 · 000000-1000000'), []);
  assert.deepEqual(rules('doc.md', '마스킹 850315-1******'), []);
});

test('credential file paths are blocked, templates and design tokens are not', () => {
  assert.deepEqual(rules('.env'), ['ENV_FILE']);
  assert.deepEqual(rules('app/.env.local'), ['ENV_FILE']);
  assert.deepEqual(rules('.env.local.example'), []);
  assert.deepEqual(rules('tmp/firebase-auth/sa.json'), ['SERVICE_ACCOUNT_FILE']);
  assert.deepEqual(rules('server/token.json'), ['TOKEN_FILE']);
  assert.deepEqual(rules('design-system/tokens.json'), []);
});

test('a line can be exempted only with an explicit reason marker, and values are never returned', () => {
  assert.deepEqual(rules('a.js', `const k = '${fakeKey}'; // secret-scan: allow public web key`), []);
  const [finding] = scanText('a.js', `x\nconst k = '${fakeKey}';`);
  assert.deepEqual(finding, { path: 'a.js', rule: 'GOOGLE_API_KEY', line: 2 });
});
