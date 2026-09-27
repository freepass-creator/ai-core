import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { delimiter, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

export const TOOL_PROBES = [
  ['git', 'source', ['--version']], ['gh', 'source', ['--version']], ['rg', 'source', ['--version']],
  ['node', 'runtime', ['--version']], ['npm', 'runtime', ['--version']], ['pnpm', 'runtime', ['--version']],
  ['yarn', 'runtime', ['--version']], ['bun', 'runtime', ['--version']], ['python', 'runtime', ['--version']],
  ['uv', 'runtime', ['--version']], ['pipx', 'runtime', ['--version']],
  ['agent-browser', 'browser', ['--version']], ['playwright', 'browser', ['--version']],
  ['jq', 'data', ['--version']], ['fd', 'data', ['--version']], ['sqlite3', 'data', ['--version']],
  ['pandoc', 'document', ['--version']], ['pdftoppm', 'document', ['-v']], ['soffice', 'document', ['--headless', '--version']],
  ['magick', 'media', ['-version']], ['ffmpeg', 'media', ['-version']], ['7z', 'archive', []],
  ['firebase', 'cloud', ['--version']], ['gcloud', 'cloud', ['--version']], ['vercel', 'cloud', ['--version']],
  ['docker', 'infrastructure', ['--version']], ['kubectl', 'infrastructure', ['version', '--client=true']],
  ['helm', 'infrastructure', ['version', '--short']], ['terraform', 'infrastructure', ['version']],
  ['cmake', 'build', ['--version']], ['java', 'build', ['--version']], ['adb', 'mobile', ['version']],
  ['codex', 'ai', ['--version']], ['claude', 'ai', ['--version']], ['gemini', 'ai', ['--version']], ['gws', 'workspace', ['--version']],
];

const oneLine = (value) => String(value ?? '').split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;

function windowsToolPath(env = process.env) {
  if (process.platform !== 'win32') return env.PATH ?? '';
  let persistedUserPath = '';
  try {
    const observed = spawnSync('reg.exe', ['query', 'HKCU\\Environment', '/v', 'Path'], { encoding: 'utf8', timeout: 5000, windowsHide: true, shell: false });
    const match = String(observed.stdout ?? '').match(/\bPath\s+REG_(?:EXPAND_)?SZ\s+(.+)$/im);
    persistedUserPath = (match?.[1] ?? '').replace(/%([^%]+)%/g, (_, key) => env[key] ?? env[key.toUpperCase()] ?? `%${key}%`);
  } catch { /* Current process PATH and known safe locations remain usable. */ }
  const extras = [
    env.APPDATA && join(env.APPDATA, 'npm'),
    env.APPDATA && join(env.APPDATA, 'Python', 'Python313', 'Scripts'),
    env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links'),
    env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'Pandoc'),
    env.ProgramFiles && join(env.ProgramFiles, '7-Zip'),
    env.ProgramFiles && join(env.ProgramFiles, 'LibreOffice', 'program'),
    env.ProgramFiles && join(env.ProgramFiles, 'Google', 'Cloud SDK', 'google-cloud-sdk', 'bin'),
  ].filter(Boolean);
  return [...new Set([...(env.PATH ?? '').split(delimiter), ...persistedUserPath.split(delimiter), ...extras])].filter(Boolean).join(delimiter);
}

function resolveWindowsCommand(name, pathValue) {
  if (process.platform !== 'win32') return { command: name, prefix: [] };
  const extensions = ['.com', '.exe', '.cmd', '.bat', '.ps1'];
  for (const directory of pathValue.split(delimiter)) {
    for (const extension of extensions) {
      const candidate = join(directory, `${name}${extension}`);
      if (!existsSync(candidate)) continue;
      if (['.cmd', '.bat'].includes(extension)) return { command: process.env.ComSpec ?? process.env.COMSPEC ?? 'C:\\Windows\\System32\\cmd.exe', wrapper: candidate, prefix: [] };
      if (extension === '.ps1') return { command: 'powershell.exe', prefix: ['-NoProfile', '-NonInteractive', '-File', candidate] };
      return { command: candidate, prefix: [] };
    }
  }
  return { command: name, prefix: [] };
}

export function classifyProbe(name, group, args, run = spawnSync) {
  const pathValue = windowsToolPath();
  const target = run === spawnSync ? resolveWindowsCommand(name, pathValue) : { command: name, prefix: [] };
  const invokeArgs = target.wrapper
    ? ['/d', '/c', 'call', target.wrapper, ...args]
    : [...target.prefix, ...args];
  const result = run(target.command, invokeArgs, { encoding: 'utf8', timeout: 15000, windowsHide: true, shell: false, env: { ...process.env, PATH: pathValue } });
  const detail = oneLine(result.stdout) ?? oneLine(result.stderr);
  if (result.error) {
    const code = result.error.code ?? 'UNKNOWN';
    const blocked = ['EACCES', 'EPERM'].includes(code) || (process.platform === 'win32' && code === 'UNKNOWN') || /application control|애플리케이션 제어/i.test(result.error.message ?? '');
    const status = code === 'ENOENT' ? 'MISSING' : code === 'ETIMEDOUT' ? 'TIMEOUT' : blocked ? 'BLOCKED' : 'FAILED';
    return { name, group, status, detail: code };
  }
  return { name, group, status: result.status === 0 ? 'AVAILABLE' : 'FAILED', detail: detail ?? `EXIT_${result.status}` };
}

export function inspectToolchain(probes = TOOL_PROBES, run = spawnSync) {
  const tools = probes.map(([name, group, args]) => classifyProbe(name, group, args, run));
  const counts = Object.fromEntries(['AVAILABLE', 'MISSING', 'BLOCKED', 'TIMEOUT', 'FAILED'].map((status) => [status, tools.filter((tool) => tool.status === status).length]));
  return { schema: 'ai-core-local-toolchain-observation/v1', observed_at: new Date().toISOString(), authority: 'LOCAL_OBSERVATION_ONLY', counts, tools };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--json')) {
    process.stderr.write('Usage: npm run tools:doctor -- [--json]\n');
    process.exitCode = 2;
  } else {
    const report = inspectToolchain();
    if (args.includes('--json')) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else {
      for (const tool of report.tools) process.stdout.write(`${tool.status.padEnd(9)} ${tool.group.padEnd(14)} ${tool.name.padEnd(16)} ${tool.detail ?? ''}\n`);
      process.stdout.write(`\n${JSON.stringify(report.counts)}\n`);
    }
    if (report.counts.BLOCKED || report.counts.TIMEOUT || report.counts.FAILED) process.exitCode = 1;
  }
}
