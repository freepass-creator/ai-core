import { statSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const GMAIL = 'https://www.googleapis.com/auth/';
const booleanOrNull = (value) => typeof value === 'boolean' ? value : null;

/** Allowlist only. Never return raw auth output, exceptions, credential paths or tokens. */
export function summarizeAuth(raw) {
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value) || value.error) return { status: 'FAILED', reason: 'INVALID_AUTH_STATUS' };
    const email = typeof value.user === 'string' && EMAIL.test(value.user) ? value.user : null;
    const scopes = Array.isArray(value.scopes) ? value.scopes : [];
    const scopeListKnown = Array.isArray(value.scopes) && scopes.every((v) => typeof v === 'string');
    const fullMail = scopes.includes('https://mail.google.com/');
    return {
      status: value.token_valid === false ? 'FAILED' : email && value.token_valid === true ? 'METADATA_OBSERVED' : 'UNVERIFIED',
      email,
      encrypted_credentials_exists: booleanOrNull(value.encrypted_credentials_exists),
      encryption_valid: booleanOrNull(value.encryption_valid),
      token_valid: booleanOrNull(value.token_valid),
      read_scope: scopeListKnown ? (fullMail || scopes.includes(`${GMAIL}gmail.readonly`) || scopes.includes(`${GMAIL}gmail.modify`) ? 'PRESENT' : 'NOT_OBSERVED') : 'UNKNOWN',
      send_scope: scopeListKnown ? (fullMail || scopes.includes(`${GMAIL}gmail.send`) || scopes.includes(`${GMAIL}gmail.compose`) || scopes.includes(`${GMAIL}gmail.modify`) ? 'PRESENT' : 'NOT_OBSERVED') : 'UNKNOWN',
      read_operation: 'NOT_TESTED', send_operation: 'NOT_TESTED',
    };
  } catch { return { status: 'FAILED', reason: 'INVALID_AUTH_STATUS' }; }
}

/** Local paths are supplied by the host; no home scan or credential file reads. */
export function inspectMailConnections(options, dependencies = {}) {
  const stat = dependencies.stat ?? statSync;
  const list = dependencies.list ?? readdirSync;
  const execute = dependencies.execute ?? execFileSync;
  const env = dependencies.env ?? process.env;
  const presence = (path, directory = false) => {
    try { const item = stat(path); return (directory ? item.isDirectory() : item.isFile()) ? 'PRESENT' : 'MISSING'; }
    catch (error) { return error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 'MISSING' : 'FAILED'; }
  };
  const installRoot = join(options.localAppData, 'Programs', 'gws');
  let binary = options.gwsExecutable ?? null;
  let discovery = 'UNVERIFIED';
  if (!binary) {
    try {
      const versions = list(installRoot, { withFileTypes: true })
        .filter((item) => item.isDirectory() && /^\d+\.\d+\.\d+$/.test(item.name))
        .map((item) => item.name);
      // Do not silently choose a different version when multiple installs exist.
      const candidates = versions.map((v) => join(installRoot, v, 'gws.exe')).map((path) => ({ path, status: presence(path) }));
      const paths = candidates.filter((c) => c.status === 'PRESENT').map((c) => c.path);
      const failed = candidates.some((c) => c.status === 'FAILED');
      if (!failed && paths.length === 1) binary = paths[0];
      discovery = failed ? 'FAILED' : paths.length > 1 ? 'AMBIGUOUS' : paths.length === 0 ? 'MISSING' : 'PRESENT';
    } catch (error) { discovery = error.code === 'ENOENT' ? 'MISSING' : 'FAILED'; }
  }
  const binaryStatus = binary ? presence(binary) : discovery;
  // Status checks only ever run the known gws binary, without a shell.
  const executableAllowed = binary && ['gws.exe', 'gws'].includes(basename(binary).toLowerCase());
  // Do not read/copy token/password environment values into a child process.
  const childEnv = {};
  for (const key of ['SystemRoot', 'SYSTEMROOT', 'WINDIR', 'PATH', 'Path', 'USERPROFILE', 'HOME', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'ProgramData']) {
    if (typeof env[key] === 'string') childEnv[key] = env[key];
  }
  const run = (args, configDir) => execute(binary, args, {
    encoding: 'utf8', timeout: 10000, maxBuffer: 256 * 1024, windowsHide: true,
    shell: false, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...childEnv, ...(configDir ? { GOOGLE_WORKSPACE_CLI_CONFIG_DIR: configDir } : {}) },
  });
  let version = null;
  let versionStatus = 'UNVERIFIED';
  if (binaryStatus === 'PRESENT' && executableAllowed) {
    try {
      const match = String(run(['--version'])).match(/^gws (\d+\.\d+\.\d+)(?:\s|$)/);
      version = match?.[1] ?? null;
      versionStatus = version ? 'OBSERVED' : 'FAILED';
    } catch { versionStatus = 'FAILED'; }
  }
  const profiles = ['gws', 'gws-collab', 'gws-admin'].map((alias) => {
    const directory = join(options.home, '.config', alias);
    const profileStatus = presence(directory, true);
    let auth = { status: 'UNVERIFIED' };
    if (options.checkAuth === true && profileStatus === 'PRESENT' && binaryStatus === 'PRESENT' && executableAllowed) {
      try { auth = summarizeAuth(String(run(['auth', 'status'], directory))); }
      catch { auth = { status: 'FAILED', reason: 'AUTH_STATUS_FAILED' }; }
    }
    return { alias, provider: 'google', profile_ref: directory, profile_status: profileStatus,
      encrypted_credentials_file: presence(join(directory, 'credentials.enc')),
      auth, send_authorized: false };
  });
  const emails = [...new Set(profiles.map((p) => p.auth.email).filter(Boolean))];
  const smtpEmail = typeof env.GMAIL_ADDRESS === 'string' && EMAIL.test(env.GMAIL_ADDRESS) ? env.GMAIL_ADDRESS : null;
  return {
    schema: 'mail-connection-observation/v1',
    observed_at: new Date().toISOString(),
    persistent_registry_created: false,
    gws: { executable: binary, status: binaryStatus, version, version_status: versionStatus },
    profiles,
    smtp: { script: options.mailtoolPath, status: presence(options.mailtoolPath),
      credential_ref: 'existing environment: GMAIL_ADDRESS / GMAIL_APP_PASSWORD',
      address_variable_present: Object.hasOwn(env, 'GMAIL_ADDRESS'),
      password_variable_present: Object.hasOwn(env, 'GMAIL_APP_PASSWORD'),
      email: smtpEmail, identity_status: smtpEmail ? 'REGISTERED_NOT_TESTED' : 'UNVERIFIED', execution: 'NOT_INVOKED', send_authorized: false },
    accounts: { metadata_observed_unique: emails.length, emails, total_mail_accounts: 'UNKNOWN',
      registered_unique: new Set([...emails, ...(smtpEmail ? [smtpEmail] : [])]).size,
      smtp_identity_unverified: smtpEmail === null, default_sender: null },
    next_action: 'REUSE_EXISTING_PROFILE_OR_RESOLVE_UNVERIFIED_STATUS; DO_NOT_AUTO_INSTALL_OR_LOGIN',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--check-auth') || args.length > 1) {
    process.stderr.write('Usage: node scripts/mail-connection-status.mjs [--check-auth]\n');
    process.exitCode = 2;
  } else {
    const home = process.env.USERPROFILE;
    const localAppData = process.env.LOCALAPPDATA;
    if (!home || !localAppData) {
      process.stdout.write('{"status":"UNVERIFIED","reason":"WINDOWS_PATH_CONTEXT_MISSING"}\n');
    } else {
      const result = inspectMailConnections({ home, localAppData, mailtoolPath: 'C:/dev/mailtool/send_mail.py', checkAuth: args.includes('--check-auth') });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    }
  }
}
