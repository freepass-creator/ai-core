import fs from 'node:fs';
import { orchestrate } from './core.mjs';

const input = JSON.parse(fs.readFileSync(new URL('../examples/freepass-product-detail.json', import.meta.url), 'utf8'));
const out = orchestrate(input);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rows = [
 ['상태', out.status], ['프로젝트', out.task.project], ['도메인', out.task.domain], ['실행 경로', out.execution.route], ['이유', out.execution.reason], ['실행 권한', out.execution_authorized ? '허용' : '미부여']
];
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI Core Demo</title><style>body{font-family:system-ui,sans-serif;max-width:920px;margin:40px auto;padding:0 20px;line-height:1.55}h1{margin-bottom:4px}.sub{color:#666}.card{border:1px solid #ddd;border-radius:16px;padding:20px;margin:18px 0}table{border-collapse:collapse;width:100%}td{padding:9px;border-bottom:1px solid #eee}td:first-child{font-weight:700;width:150px}code,pre{background:#f6f6f6;border-radius:10px}pre{padding:16px;overflow:auto}.pill{display:inline-block;border:1px solid #bbb;border-radius:999px;padding:4px 10px;margin:3px}</style><body><h1>AI Core v0.1</h1><div class="sub">AIOPS × DevCenter orchestration — generated from a real task envelope</div><div class="card"><h2>입력</h2><p>${esc(out.task.goal)}</p></div><div class="card"><h2>판정</h2><table>${rows.map(([a,b])=>`<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</table></div><div class="card"><h2>참조 계획</h2>${out.source_plan.map(x=>`<span class="pill">${esc(x.owner_system)}${x.required?' · required':''}</span>`).join('')}<h3>DevCenter capability</h3>${out.capability_plan.map(x=>`<span class="pill">${esc(x.scope)}</span>`).join('')}</div><div class="card"><h2>Work Packet</h2><pre>${esc(JSON.stringify(out.work_packet,null,2))}</pre></div><p class="sub">이 페이지는 데모 출력이다. 운영 실행 권한을 부여하지 않는다.</p></body></html>`;
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
console.log(JSON.stringify({ generated: 'dist/index.html', status: out.status, route: out.execution.route }, null, 2));
