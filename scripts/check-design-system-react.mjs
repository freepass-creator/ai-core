// 본사 React 원자(design-system/react)가 «본사 정본에만» 서 있는지 본다.
//
//   1. 원자가 쓰는 CSS 변수는 전부 design-system/tokens.runtime.css 에 있어야 한다 — 없는 변수는 조용히 빈 값이 된다.
//   2. 리터럴 색(#hex · rgb/rgba)은 src/ui/tokens.ts 에만 둔다 — 원자 곳곳에 박히면 다크 모드·테마가 새어 나간다.
//   3. 패키지 밖 import 는 react · lucide-react 뿐이다 — 프로젝트 경로(@/...)가 끼면 본사 원자가 아니다.
//   4. PROVENANCE.json 이 src 의 파일을 빠짐없이, 지금 내용(sha256)으로 적고 있어야 한다.
//      EXACT_COPY 로 적힌 파일은 원본 git blob 과 한 바이트도 달라선 안 된다.
//
//   node scripts/check-design-system-react.mjs     exit 0 통과 · 1 위반
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function checkDesignSystemReact({ base = root } = {}) {
  const pkg = join(base, 'design-system/react');
  const src = join(pkg, 'src');
  const errors = [];
  const tokensCss = readFileSync(join(base, 'design-system/tokens.runtime.css'), 'utf8');
  const defined = new Set([...tokensCss.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1]));

  const walk = dir => readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
  const files = walk(src).filter(path => /\.(ts|tsx)$/.test(path));
  for (const file of files) {
    const rel = relative(pkg, file).replaceAll('\\', '/');
    const text = readFileSync(file, 'utf8');
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    for (const [, name] of code.matchAll(/var\((--[a-z0-9-]+)/g)) {
      if (!defined.has(name)) errors.push(`${rel}: CSS variable ${name} is not defined in design-system/tokens.runtime.css`);
    }
    if (rel !== 'src/ui/tokens.ts') {
      for (const [literal] of code.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g)) {
        errors.push(`${rel}: literal color ${literal} outside src/ui/tokens.ts`);
      }
    }
    for (const [, spec] of code.matchAll(/from\s+'([^']+)'/g)) {
      if (spec.startsWith('.')) continue;
      if (spec === 'react' || spec === 'lucide-react') continue;
      errors.push(`${rel}: import '${spec}' leaves the package`);
    }
  }

  const provenance = JSON.parse(readFileSync(join(pkg, 'PROVENANCE.json'), 'utf8'));
  const recorded = new Map(provenance.files.map(entry => [`src/${entry.path}`, entry]));
  const own = new Set(['src/index.ts']);
  for (const file of files) {
    const rel = relative(pkg, file).replaceAll('\\', '/');
    if (own.has(rel)) continue;
    const entry = recorded.get(rel);
    if (!entry) { errors.push(`${rel}: not recorded in PROVENANCE.json`); continue; }
    const sha = createHash('sha256').update(readFileSync(file)).digest('hex');
    if (sha !== entry.sha256) errors.push(`${rel}: content differs from PROVENANCE.json sha256`);
    if (entry.copy_kind === 'EXACT_COPY') {
      const body = readFileSync(file);
      const blob = createHash('sha1').update(`blob ${body.length}\0`).update(body).digest('hex');
      if (blob !== entry.source_git_blob) errors.push(`${rel}: marked EXACT_COPY but differs from source blob ${entry.source_git_blob}`);
    }
    recorded.delete(rel);
  }
  for (const rel of recorded.keys()) errors.push(`${rel}: recorded in PROVENANCE.json but missing`);
  return { status: errors.length ? 'FAIL' : 'PASS', files: files.length, errors };
}

/** 알려진 나쁜 표본 다섯 — 임시 사본에 하나씩 심고, 그것이 그 규칙 이유로 잡히는지 본다. */
export async function selfTest() {
  const { cpSync, mkdtempSync, readFileSync: read, writeFileSync, rmSync, mkdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const cases = [
    ['undefined CSS variable', 'src/ui/status-badge.tsx', text => text + "\nexport const _p = 'var(--text-main)';\n", 'is not defined in design-system'],
    ['literal color', 'src/ui/wizard.tsx', text => text + "\nexport const _p = '#ff0000';\n", 'literal color #ff0000'],
    ['leaking import', 'src/lib/haptics.ts', text => "import { x } from '@/lib/session';\n" + text, 'leaves the package'],
    ['unrecorded file', 'src/ui/_stray.tsx', () => 'export const stray = 1;\n', 'not recorded in PROVENANCE.json'],
    ['drifted exact copy', 'src/lib/use-mobile.ts', text => text + '\n', 'marked EXACT_COPY but differs'],
  ];
  const broken = [];
  for (const [name, rel, mutate, marker] of cases) {
    const base = mkdtempSync(join(tmpdir(), 'ds-react-self-'));
    try {
      mkdirSync(join(base, 'design-system'), { recursive: true });
      cpSync(join(root, 'design-system/tokens.runtime.css'), join(base, 'design-system/tokens.runtime.css'));
      cpSync(join(root, 'design-system/react/src'), join(base, 'design-system/react/src'), { recursive: true });
      cpSync(join(root, 'design-system/react/PROVENANCE.json'), join(base, 'design-system/react/PROVENANCE.json'));
      const file = join(base, 'design-system/react', rel);
      let before = '';
      try { before = read(file, 'utf8'); } catch {}
      writeFileSync(file, mutate(before));
      const { errors } = checkDesignSystemReact({ base });
      if (!errors.some(error => error.includes(marker))) broken.push(`missed ${name}`);
    } finally { rmSync(base, { recursive: true, force: true }); }
  }
  return broken;
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes('--self-test')) {
  const broken = await selfTest();
  if (broken.length) { console.error(`CHECKER BROKEN: ${broken.join(' · ')}`); process.exit(1); }
  console.log('PASS: self-test 5 known-bad samples caught');
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = checkDesignSystemReact();
  for (const error of result.errors) console.error(`FAIL: ${error}`);
  if (result.status === 'PASS') console.log(`PASS: design-system/react ${result.files} files bound to HQ tokens`);
  process.exit(result.status === 'PASS' ? 0 : 1);
}
