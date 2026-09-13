import fs from 'node:fs';
import { orchestrate } from './core.mjs';

const input = JSON.parse(
  fs.readFileSync(new URL('../examples/freepass-product-detail.json', import.meta.url), 'utf8')
);
const output = orchestrate(input);
const escapeHtml = value => String(value).replace(
  /[&<>"']/g,
  character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]
);
const rows = [
  ['상태', output.status],
  ['프로젝트', output.task.project],
  ['도메인', output.task.domain],
  ['실행 경로', output.execution.route],
  ['이유', output.execution.reason],
  ['실행 권한', output.execution_authorized ? '허용' : '미부여']
];
const sourcePills = output.source_bindings.map(binding => (
  `<span class="pill">${escapeHtml(`${binding.system}:${binding.kind} · ${binding.status}`)}</span>`
)).join('');
const capabilityPills = output.capability_bindings.map(binding => (
  `<span class="pill">${escapeHtml(`${binding.scope} · ${binding.status}`)}</span>`
)).join('');
const holds = output.holds.length
  ? output.holds.map(item => `<li>${escapeHtml(item)}</li>`).join('')
  : '<li>없음</li>';
const html = `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI Core Demo</title>
<style>
body{font-family:system-ui,sans-serif;max-width:920px;margin:40px auto;padding:0 20px;line-height:1.55;color:#171717}
h1{margin-bottom:4px}.sub{color:#666}.card{border:1px solid #ddd;border-radius:16px;padding:20px;margin:18px 0}
table{border-collapse:collapse;width:100%}td{padding:9px;border-bottom:1px solid #eee}td:first-child{font-weight:700;width:150px}
code,pre{background:#f6f6f6;border-radius:10px}pre{padding:16px;overflow:auto}.pill{display:inline-block;border:1px solid #bbb;border-radius:999px;padding:4px 10px;margin:3px}
</style>
<body>
<h1>AI Core ${escapeHtml(output.core_version)}</h1>
<div class="sub">AIOPS × DevCenter orchestration — offline planning demo</div>
<div class="card"><h2>입력</h2><p>${escapeHtml(output.task.goal)}</p></div>
<div class="card"><h2>판정</h2><table>${rows.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join('')}</table><h3>보류 사유</h3><ul>${holds}</ul></div>
<div class="card"><h2>정본 연결</h2>${sourcePills}<h3>DevCenter capability</h3>${capabilityPills}</div>
<div class="card"><h2>Work Packet</h2><pre>${escapeHtml(JSON.stringify(output.work_packet, null, 2))}</pre></div>
<p class="sub">오프라인 데모의 HOLD는 실제 SHA가 주입되지 않았다는 뜻이다. 이 페이지는 운영 실행 권한을 부여하지 않는다.</p>
</body>
</html>`;

fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
console.log(JSON.stringify({
  generated: 'dist/index.html',
  status: output.status,
  route: output.execution.route
}, null, 2));
