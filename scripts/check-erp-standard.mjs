#!/usr/bin/env node
// ERP 표준 UI 규격 v1 검사 — design/erp-standard
//
// 규격이 «그림»으로 끝나지 않도록 아래를 기계로 확인한다.
//   1. design-system/tokens.json 의 erp_standard 블록(정본) ↔ erp.css :root(투영) 가 한 글자도 어긋나지 않는다.
//      값의 정본은 AI Core 디자인 토큰 정본 하나뿐이다(대표 2026-09-25 「v1.1로 하나로」).
//   2. erp.css 의 :root 밖에서는 색·글자 크기·굵기·모서리를 var(--erp-*) 로만 쓴다.
//   3. 템플릿(main.html·form.html)은 인라인 style 을 쓰지 않고, erp.css 에 없는 erp-* 클래스를 쓰지 않는다.
//   4. 템플릿은 화면 골격 영역(data-region)을 모두 갖고, 영역마다 Primary 버튼은 최대 1개다.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(root, 'design/erp-standard');
const read = (p) => readFileSync(resolve(dir, p), 'utf8');

const SHELL_REGIONS = ['topbar', 'sidenav', 'tabs', 'page-header', 'statusbar'];
export const TEMPLATES = {
  'main.html': [...SHELL_REGIONS, 'kpi', 'filter', 'grid-toolbar', 'grid'],
  'form.html': [...SHELL_REGIONS, 'form', 'form-footer'],
};
// 플랫폼 적용 시안(platform/*.html)도 같은 규칙을 지킨다 — 골격 영역은 공통 5개만 요구한다.
const platformDir = resolve(dir, 'platform');
if (existsSync(platformDir)) {
  for (const f of readdirSync(platformDir).filter((n) => n.endsWith('.html')).sort()) TEMPLATES[`platform/${f}`] = SHELL_REGIONS;
  for (const sub of readdirSync(platformDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const f of readdirSync(resolve(platformDir, sub.name)).filter((n) => n.endsWith('.html')).sort()) TEMPLATES[`platform/${sub.name}/${f}`] = SHELL_REGIONS;
  }
}
const themesDir = resolve(dir, 'themes');
const THEMES = existsSync(themesDir) ? readdirSync(themesDir).filter((n) => n.endsWith('.json') && n !== 'index.json').map((n) => n.replace(/\.json$/, '')).sort() : [];

export function checkErpStandard() {
  const errors = [];
  const ssot = JSON.parse(readFileSync(resolve(root, 'design-system/tokens.json'), 'utf8')).erp_standard;
  if (!ssot?.tokens) return { ok: false, errors: ['design-system/tokens.json: erp_standard 블록이 없다'], tokenCount: 0, themeCount: 0 };
  const ev = ssot.evidence ?? {};
  if (!Array.isArray(ev.refs) || ev.refs.length === 0 || !ev.decision) errors.push('design-system/tokens.json erp_standard: 근거(evidence.refs · decision) 없는 값은 정본이 아니다');
  if (existsSync(resolve(dir, 'tokens.json'))) errors.push('design/erp-standard/tokens.json: 두 번째 정본 금지 — 값은 design-system/tokens.json#erp_standard 에만');
  const tokens = ssot.tokens;
  const css = read('erp.css');

  // 1. 정본 ↔ 투영
  const rootMatch = css.match(/:root\s*\{([\s\S]*?)\}/);
  if (!rootMatch) errors.push('erp.css: :root 블록이 없다');
  const rootBody = rootMatch?.[1] ?? '';
  for (const [k, v] of Object.entries(tokens)) {
    if (!rootBody.includes(`--erp-${k}: ${v};`)) errors.push(`erp.css :root 투영 누락/불일치: --erp-${k}: ${v};`);
  }
  for (const [, name] of rootBody.matchAll(/--erp-([\w-]+)\s*:/g)) {
    if (!(name in tokens)) errors.push(`erp.css :root 에 정본에 없는 토큰: --erp-${name}`);
  }

  // 2. :root 밖은 토큰만
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/:root\s*\{[\s\S]*?\}/, '');
  for (const m of rules.matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g)) errors.push(`erp.css: 토큰 밖 날것 색 «${m[0]}»`);
  for (const m of rules.matchAll(/(font-size|font-weight|border-radius)\s*:\s*([^;}]+)/g)) {
    const parts = m[2].trim().split(/\s+(?![^(]*\))/);
    if (parts.some((p) => !p.startsWith('var(--erp-') && p !== '0')) errors.push(`erp.css: ${m[1]} 는 토큰만 — «${m[0].trim()}»`);
  }
  for (const m of rules.matchAll(/var\(--erp-([\w-]+)\)/g)) {
    if (!(m[1] in tokens)) errors.push(`erp.css: 정의되지 않은 토큰 참조 --erp-${m[1]}`);
  }
  const defined = new Set([...rules.matchAll(/\.(erp-[\w-]+)/g)].map((m) => m[1]));

  // 테마 등록부 — 등록된 테마만 쓴다. 기본 테마는 정본(erp_standard) 자체, 나머지는 themes/<id>.json + .css
  const registry = existsSync(resolve(themesDir, 'index.json')) ? JSON.parse(read('themes/index.json')) : null;
  if (!registry) errors.push('themes/index.json: 테마 등록부가 없다');
  else {
    const ids = registry.themes.map((t) => t.id);
    if (!ids.includes(registry.default)) errors.push(`themes/index.json: 기본 테마 ${registry.default} 가 목록에 없다`);
    for (const t of registry.themes) {
      if (!['ADOPTED', 'CANDIDATE', 'RETIRED'].includes(t.status)) errors.push(`themes/index.json: ${t.id} 상태값 ${t.status}`);
      for (const f of [t.source, t.stylesheet, ...(t.preview ?? [])]) if (!existsSync(resolve(themesDir, f))) errors.push(`themes/index.json: ${t.id} 파일 없음 ${f}`);
      if (t.id !== registry.default && !THEMES.includes(t.id)) errors.push(`themes/index.json: ${t.id} 의 정본 themes/${t.id}.json 이 없다`);
    }
    for (const name of THEMES) if (!ids.includes(name)) errors.push(`themes/${name}.json: 등록부(index.json)에 없는 테마`);
  }

  // 테마 — themes/<name>.json(정본) ↔ themes/<name>.css [data-theme] 블록(투영).
  //   덮어쓰기는 기본 토큰에 있는 이름만, 추가 변수는 --<name>-* 만. 블록 밖은 기본 규칙과 같이 토큰만.
  for (const name of THEMES) {
    const theme = JSON.parse(read(`themes/${name}.json`));
    const tcss = read(`themes/${name}.css`);
    const block = tcss.match(new RegExp(`\\[data-theme="${name}"\\]\\s*\\{([\\s\\S]*?)\\}`))?.[1];
    if (block === undefined) { errors.push(`themes/${name}.css: [data-theme="${name}"] 블록이 없다`); continue; }
    const extra = theme.extra ?? {};
    for (const [k, v] of Object.entries(theme.overrides ?? {})) {
      if (!(k in tokens)) errors.push(`themes/${name}.json: 기본 토큰에 없는 덮어쓰기 ${k}`);
      if (!block.includes(`--erp-${k}: ${v};`)) errors.push(`themes/${name}.css 투영 누락/불일치: --erp-${k}: ${v};`);
    }
    for (const [k, v] of Object.entries(extra)) {
      if (!k.startsWith(`${name}-`)) errors.push(`themes/${name}.json: 추가 변수는 ${name}- 로 시작해야 한다 — ${k}`);
      if (!block.includes(`--${k}: ${v};`)) errors.push(`themes/${name}.css 투영 누락/불일치: --${k}: ${v};`);
    }
    for (const [, n] of block.matchAll(/--([\w-]+)\s*:/g)) {
      const known = n.startsWith('erp-') ? (n.slice(4) in (theme.overrides ?? {})) : (n in extra);
      if (!known) errors.push(`themes/${name}.css: 정본에 없는 변수 --${n}`);
    }
    const trules = tcss.replace(/\/\*[\s\S]*?\*\//g, '').replace(block, '');
    for (const m of trules.matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g)) errors.push(`themes/${name}.css: 토큰 밖 날것 색 «${m[0]}»`);
    for (const m of trules.matchAll(/(font-size|font-weight|border-radius)\s*:\s*([^;}]+)/g)) {
      const parts = m[2].trim().split(/\s+(?![^(]*\))/);
      if (parts.some((p) => !p.startsWith('var(--erp-') && p !== '0')) errors.push(`themes/${name}.css: ${m[1]} 는 토큰만 — «${m[0].trim()}»`);
    }
    for (const m of trules.matchAll(/var\(--([\w-]+)\)/g)) {
      const n = m[1];
      if (n.startsWith('erp-') ? !(n.slice(4) in tokens) : !(n in extra)) errors.push(`themes/${name}.css: 정의되지 않은 변수 참조 --${n}`);
    }
    for (const m of trules.matchAll(/\.(erp-[\w-]+)/g)) if (!defined.has(m[1])) errors.push(`themes/${name}.css: erp.css 에 없는 클래스 .${m[1]}`);
  }

  // 3·4. 템플릿
  for (const [file, regions] of Object.entries(TEMPLATES)) {
    const html = read(file);
    if (!/<link[^>]+href="(?:\.\.\/)*erp\.css"/.test(html)) errors.push(`${file}: erp.css 를 불러오지 않는다`);
    if (/\sstyle\s*=/.test(html)) errors.push(`${file}: 인라인 style 금지 — erp.css 클래스를 쓴다`);
    if (/<style[\s>]/.test(html)) errors.push(`${file}: <style> 블록 금지 — 공통 규칙은 erp.css 에 둔다`);
    for (const m of html.matchAll(/class="([^"]+)"/g)) {
      for (const c of m[1].split(/\s+/)) if (c.startsWith('erp-') && !defined.has(c)) errors.push(`${file}: erp.css 에 없는 클래스 .${c}`);
    }
    for (const r of regions) if (!html.includes(`data-region="${r}"`)) errors.push(`${file}: 화면 골격 영역 누락 data-region="${r}"`);
    // 영역별 Primary 수 — 영역 시작점부터 다음 영역 시작점까지를 한 영역으로 본다.
    const marks = [...html.matchAll(/data-region="([\w-]+)"/g)].map((m) => ({ name: m[1], at: m.index }));
    marks.forEach((mk, i) => {
      const chunk = html.slice(mk.at, marks[i + 1]?.at ?? html.length);
      const n = (chunk.match(/erp-btn--primary/g) ?? []).length;
      if (n > 1) errors.push(`${file}: 영역 ${mk.name} 에 Primary 버튼 ${n}개 — 영역마다 최대 1개`);
    });
  }
  return { ok: errors.length === 0, errors, tokenCount: Object.keys(tokens).length, themeCount: THEMES.length + 1 };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { ok, errors, tokenCount, themeCount } = checkErpStandard();
  if (ok) console.log(`ERP 표준 규격 검사 통과 — 토큰 ${tokenCount}개, 테마 ${themeCount}개, 템플릿 ${Object.keys(TEMPLATES).length}개`);
  else { console.error(`ERP 표준 규격 위반 ${errors.length}건`); for (const e of errors) console.error(' - ' + e); process.exit(1); }
}
