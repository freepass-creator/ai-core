#!/usr/bin/env node
// ERP 표준 UI 규격 v1 검사 — design/erp-standard
//
// 규격이 «그림»으로 끝나지 않도록 아래를 기계로 확인한다.
//   1. tokens.json(정본) ↔ erp.css :root(투영) 가 한 글자도 어긋나지 않는다.
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
}

export function checkErpStandard() {
  const errors = [];
  const tokens = JSON.parse(read('tokens.json')).tokens;
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

  // 3·4. 템플릿
  for (const [file, regions] of Object.entries(TEMPLATES)) {
    const html = read(file);
    if (!/<link[^>]+href="(?:\.\.\/)?erp\.css"/.test(html)) errors.push(`${file}: erp.css 를 불러오지 않는다`);
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
  return { ok: errors.length === 0, errors, tokenCount: Object.keys(tokens).length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { ok, errors, tokenCount } = checkErpStandard();
  if (ok) console.log(`ERP 표준 규격 검사 통과 — 토큰 ${tokenCount}개, 템플릿 ${Object.keys(TEMPLATES).length}개`);
  else { console.error(`ERP 표준 규격 위반 ${errors.length}건`); for (const e of errors) console.error(' - ' + e); process.exit(1); }
}
