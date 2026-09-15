import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectMailConnections, summarizeAuth } from '../scripts/mail-connection-status.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'mail-connection-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const home = join(root, 'home'), localAppData = join(root, 'local');
  const install = join(localAppData, 'Programs', 'gws', '0.22.5');
  mkdirSync(install, { recursive: true });
  writeFileSync(join(install, 'gws.exe'), 'fixture only; never executed');
  const profile = join(home, '.config', 'gws');
  mkdirSync(profile, { recursive: true });
  writeFileSync(join(profile, 'credentials.enc'), 'DO_NOT_READ');
  const mailtoolPath = join(root, 'send_mail.py');
  writeFileSync(mailtoolPath, 'raise Exception("must never execute")');
  return { home, localAppData, mailtoolPath };
}
const metadata = { user: 'account@example.test', token_valid: true, encrypted_credentials_exists: true,
  scopes: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'] };

test('default checks version only, never auth/login/install/send', (t) => {
  const options = fixture(t), calls = [];
  const result = inspectMailConnections(options, { env: {}, execute: (file, args) => { calls.push(args); return 'gws 0.22.5\n'; } });
  assert.deepEqual(calls, [['--version']]);
  assert.equal(result.profiles[0].auth.status, 'UNVERIFIED');
  assert.equal(result.profiles[1].profile_status, 'MISSING');
  assert.equal(result.gws.version, '0.22.5');
  assert.equal(result.smtp.execution, 'NOT_INVOKED');
  assert.equal(result.accounts.default_sender, null);
});

test('auth output allowlist drops secrets and distinguishes scope from operation proof', () => {
  const result = summarizeAuth(JSON.stringify({ ...metadata, access_token: 'LEAK', client_id: 'LEAK', credentials: 'LEAK', extra: 'LEAK' }));
  assert.equal(JSON.stringify(result).includes('LEAK'), false);
  assert.equal(result.read_scope, 'PRESENT');
  assert.equal(result.send_scope, 'PRESENT');
  assert.equal(result.send_operation, 'NOT_TESTED');
  assert.equal(result.status, 'METADATA_OBSERVED');
});

test('explicit auth mode uses isolated existing profiles and never reads password values', (t) => {
  const options = { ...fixture(t), checkAuth: true };
  const env = { GMAIL_ADDRESS: 'account@example.test', USERPROFILE: options.home };
  Object.defineProperty(env, 'GMAIL_APP_PASSWORD', { get() { throw new Error('password read'); }, enumerable: true });
  Object.defineProperty(env, 'GOOGLE_WORKSPACE_CLI_TOKEN', { get() { throw new Error('token read'); }, enumerable: true });
  const calls = [];
  const result = inspectMailConnections(options, { env, execute: (file, args, config) => {
    calls.push(args);
    assert.equal(config.shell, false);
    assert.equal(config.env.GMAIL_APP_PASSWORD, undefined);
    assert.equal(config.env.GOOGLE_WORKSPACE_CLI_TOKEN, undefined);
    if (args[0] === 'auth') assert.equal(config.env.GOOGLE_WORKSPACE_CLI_CONFIG_DIR, join(options.home, '.config', 'gws'));
    return args[0] === '--version' ? 'gws 0.22.5' : JSON.stringify(metadata);
  } });
  assert.deepEqual(calls, [['--version'], ['auth', 'status']]);
  assert.equal(result.accounts.registered_unique, 1);
  assert.equal(result.smtp.password_variable_present, true);
  assert.equal(result.smtp.identity_status, 'REGISTERED_NOT_TESTED');
  assert.equal(result.smtp.send_authorized, false);
});

test('same account in three profiles is not counted as three accounts', (t) => {
  const options = { ...fixture(t), checkAuth: true };
  for (const name of ['gws-collab', 'gws-admin']) mkdirSync(join(options.home, '.config', name), { recursive: true });
  const r = inspectMailConnections(options, { env: {}, execute: (file, args) => args[0] === '--version' ? 'gws 0.22.5' : JSON.stringify(metadata) });
  assert.equal(r.accounts.metadata_observed_unique, 1);
  assert.equal(r.accounts.total_mail_accounts, 'UNKNOWN');
});

test('failure output is never returned or treated as installation absence', (t) => {
  const options = { ...fixture(t), checkAuth: true };
  const r = inspectMailConnections(options, { env: {}, execute: () => { throw new Error('SECRET stderr token'); } });
  assert.equal(r.gws.status, 'PRESENT');
  assert.equal(r.gws.version_status, 'FAILED');
  assert.equal(r.profiles[0].auth.status, 'FAILED');
  assert.equal(JSON.stringify(r).includes('SECRET'), false);
});

test('malformed metadata, absent scope and invalid token remain distinct', () => {
  assert.equal(summarizeAuth('SECRET invalid JSON').status, 'FAILED');
  assert.equal(summarizeAuth('{}').status, 'UNVERIFIED');
  assert.equal(summarizeAuth(JSON.stringify({ ...metadata, token_valid: false })).status, 'FAILED');
  assert.equal(summarizeAuth(JSON.stringify({ ...metadata, scopes: [] })).send_scope, 'NOT_OBSERVED');
  assert.equal(summarizeAuth(JSON.stringify({ ...metadata, scopes: null })).send_scope, 'UNKNOWN');
});

test('multiple installed versions require explicit host selection, never pick latest', (t) => {
  const options = fixture(t), extra = join(options.localAppData, 'Programs', 'gws', '0.23.0');
  mkdirSync(extra); writeFileSync(join(extra, 'gws.exe'), 'fixture');
  const r = inspectMailConnections(options, { env: {}, execute: () => assert.fail('must not execute') });
  assert.equal(r.gws.status, 'AMBIGUOUS');
  assert.equal(r.gws.executable, null);
});

test('missing paths never cause installation or credential creation', (t) => {
  const options = fixture(t);
  options.localAppData = join(options.home, 'absent');
  const r = inspectMailConnections(options, { env: {}, execute: () => assert.fail('must not execute') });
  assert.equal(r.gws.status, 'MISSING');
  assert.equal(r.persistent_registry_created, false);
});

test('filesystem permission errors remain FAILED rather than MISSING', (t) => {
  const options = fixture(t);
  const r = inspectMailConnections(options, { env: {}, stat: () => { const e = new Error('SECRET'); e.code = 'EACCES'; throw e; },
    list: () => { const e = new Error('SECRET'); e.code = 'EACCES'; throw e; }, execute: () => assert.fail('must not execute') });
  assert.equal(r.gws.status, 'FAILED');
  assert.equal(r.smtp.status, 'FAILED');
  assert.equal(JSON.stringify(r).includes('SECRET'), false);
});

test('an unreadable binary candidate is not silently omitted during discovery', (t) => {
  const options = fixture(t);
  const r = inspectMailConnections(options, { env: {}, stat: () => { const e = new Error('denied'); e.code = 'EACCES'; throw e; },
    execute: () => assert.fail('must not execute') });
  assert.equal(r.gws.status, 'FAILED');
  assert.equal(r.gws.executable, null);
});
