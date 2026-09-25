/** 원자 읽기/저장 경계. 캐시와 색인은 원본의 존재 및 SHA-256에 종속된다. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const 원자방 = 'lib/wonja';
const 색인방 = 'lib/wonja/.칸';
const 품은것 = new Map();
const 큰칸줄 = 200;

function 길찾기(키) {
  if (!키 || path.basename(키) !== 키 || /[\\/]/.test(키) || 키 === '.' || 키 === '..') throw new Error('잘못된 원자 키');
  const paths = ['.json', '.ndjson'].map(ext => path.resolve(원자방, 키 + ext)).filter(p => fs.existsSync(p));
  if (paths.length > 1) throw new Error(`원자 형식이 중복됨: ${키}`);
  if (!paths.length) throw new Error(`원자가 없다: ${키}`);
  return paths[0];
}
const 적는다 = (한일, 키, 칸) => {
  try {
    fs.mkdirSync('state', { recursive: true });
    fs.appendFileSync('state/원자문-장부.ndjson', JSON.stringify({ 때: new Date().toISOString(), 누가: path.basename(process.argv[1] || '?'), 한일, 키, 칸: 칸 ?? null }) + '\n');
  } catch { /* 진단 장부 실패가 원본 읽기를 바꾸지는 않는다. */ }
};
const 표 = (p) => { const s = fs.statSync(p, { bigint: true }); return `${s.dev}|${s.ino}|${s.size}|${s.mtimeNs}|${s.ctimeNs}`; };
const 해시 = (b) => createHash('sha256').update(b).digest('hex');
const 풀기 = (p, b) => p.endsWith('.ndjson')
  ? b.toString('utf8').split('\n').filter(x => x.trim()).map(x => JSON.parse(x))
  : JSON.parse(b.toString('utf8'));

/** stat alone cannot establish content identity. Read bytes and hash even on a cache hit. */
function 원본읽기(키) {
  const 길 = 길찾기(키);
  const 전 = 표(길);
  const bytes = fs.readFileSync(길);
  if (표(길) !== 전 || 길찾기(키) !== 길) throw new Error(`읽는 동안 원자 변경: ${키}`);
  return { 길, bytes, sha256: 해시(bytes) };
}
function 푼값(원본) {
  const old = 품은것.get(원본.길);
  if (old?.sha256 === 원본.sha256) return structuredClone(old.값);
  const 값 = 풀기(원본.길, 원본.bytes);
  품은것.set(원본.길, { sha256: 원본.sha256, 값 });
  return structuredClone(값);
}
function 원자적저장(길, 글) {
  fs.mkdirSync(path.dirname(길), { recursive: true });
  const 임시 = `${길}.${randomUUID()}.tmp`;
  try { fs.writeFileSync(임시, 글, { encoding: 'utf8', flag: 'wx' }); fs.renameSync(임시, 길); }
  finally { if (fs.existsSync(임시)) fs.unlinkSync(임시); }
}

export function 색인만들기(키, 값, 길) {
  const 원본 = 원본읽기(키);
  if (길 && path.resolve(길) !== 원본.길) throw new Error('원자 색인 경로 불일치');
  const actual = 풀기(원본.길, 원본.bytes);
  if (JSON.stringify(actual) !== JSON.stringify(값)) throw new Error('원자와 색인 입력 불일치');
  const 색인 = { version: 2, 키, 원본경로: 원본.길, sha256: 원본.sha256, 잰날: new Date().toISOString().slice(0, 10), 칸: {} };
  if (값 && typeof 값 === 'object' && !Array.isArray(값)) {
    for (const [k, v] of Object.entries(값)) {
      const 줄 = Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : null;
      색인.칸[k] = 줄 === null || 줄 <= 큰칸줄 ? { 줄, 값: v } : { 줄 };
    }
  } else { 색인.칸 = null; 색인.줄 = Array.isArray(값) ? 값.length : null; }
  if (원본읽기(키).sha256 !== 원본.sha256) throw new Error('색인 중 원자 변경');
  원자적저장(path.join(색인방, `${키}.json`), JSON.stringify(색인) + '\n');
  return 색인;
}

export function 준다(키) {
  const 값 = 푼값(원본읽기(키));
  적는다('준다', 키);
  return 값;
}
export function 꺼낸다(키, 칸) {
  const 원본 = 원본읽기(키);
  try {
    const index = JSON.parse(fs.readFileSync(path.join(색인방, `${키}.json`), 'utf8'));
    if (index.version === 2 && index.원본경로 === 원본.길 && index.sha256 === 원본.sha256) {
      const c = index.칸?.[칸];
      if (c && Object.hasOwn(c, '값')) { 적는다('꺼낸다(색인)', 키, 칸); return c.값; }
    }
  } catch { /* Missing, corrupt, or old index: read source. */ }
  적는다('꺼낸다(원본)', 키, 칸);
  return 푼값(원본)?.[칸];
}

export function 낸다(키, 값, { 왜 = '' } = {}) {
  let 길;
  try { 길 = 길찾기(키); }
  catch (e) { if (!e.message.startsWith('원자가 없다:')) throw e; 길 = path.resolve(원자방, `${키}.json`); }
  if (길.endsWith('.ndjson') && !Array.isArray(값)) throw new Error('NDJSON 원자는 배열이어야 합니다');
  const 글 = 길.endsWith('.ndjson') ? 값.map(x => JSON.stringify(x)).join('\n') + '\n' : JSON.stringify(값, null, 1) + '\n';
  const encoded = 풀기(길, Buffer.from(글));
  if (JSON.stringify(encoded) !== JSON.stringify(값)) throw new Error('원자를 JSON으로 보존할 수 없습니다');
  품은것.delete(길);
  원자적저장(길, 글);
  색인만들기(키, 값, 길);
  적는다(`낸다${왜 ? `(${왜})` : ''}`, 키);
  return 길;
}
export function 들인다(키, 값, { 어디서 = '' } = {}) {
  return 낸다(키, 값, { 왜: `들인다${어디서 ? `←${어디서}` : ''}` });
}
