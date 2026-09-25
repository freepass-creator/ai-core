/** 데이터센터 공유드라이브 최근 업로드 확인 (읽기만). 사용: node dc-recent.mjs [시간h=24] */
import { token, makeCall } from './lib-goog.mjs';
import { readFileSync, existsSync } from 'node:fs';
const call = makeCall(await token());
const DRIVE = '0ALp5cUm1kqTvUk9PVA';
const hours = Number(process.argv[2] || 24);
const since = new Date(Date.now() - hours * 3600e3).toISOString();
const q = encodeURIComponent(`modifiedTime > '${since}' and trashed = false and mimeType != 'application/vnd.google-apps.folder'`);
const fields = encodeURIComponent('nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,parents,size,lastModifyingUser(displayName,emailAddress),owners(emailAddress))');
let files = [], pageToken = '';
do {
  const r = await call(`https://www.googleapis.com/drive/v3/files?corpora=drive&driveId=${DRIVE}&includeItemsFromAllDrives=true&supportsAllDrives=true&q=${q}&orderBy=modifiedTime desc&pageSize=200&fields=${fields}${pageToken ? '&pageToken=' + pageToken : ''}`);
  files.push(...(r.files || [])); pageToken = r.nextPageToken || '';
} while (pageToken);
// 폴더 경로 해석 (캐시)
const cache = new Map();
async function pathOf(id, depth = 0) {
  if (!id || depth > 8) return '';
  if (cache.has(id)) return cache.get(id);
  const f = await call(`https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true&fields=id,name,parents`);
  const p = f.parents?.[0] && f.parents[0] !== DRIVE ? await pathOf(f.parents[0], depth + 1) : '';
  const full = (p ? p + ' / ' : '') + f.name; cache.set(id, full); return full;
}
const kst = (t) => new Date(new Date(t).getTime() + 9 * 3600e3).toISOString().slice(5, 16).replace('T', ' ');
console.log(`데이터센터 최근 ${hours}시간 · 파일 ${files.length}건 (KST)`);
for (const f of files) {
  const path = await pathOf(f.parents?.[0]);
  const who = f.lastModifyingUser?.emailAddress || f.owners?.[0]?.emailAddress || '?';
  const kb = f.size ? `${Math.round(f.size / 1024)}KB` : (f.mimeType.includes('google-apps') ? 'gdoc' : '-');
  console.log(`${kst(f.createdTime)}  ${who.padEnd(22)} ${path}  ›  ${f.name}  (${kb})`);
}
