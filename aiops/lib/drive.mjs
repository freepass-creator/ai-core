/** 데이터센터(구글 드라이브) 다루는 로직 — 목록·검색·경로·다운로드·이동·내용 읽기.
 *  다른 AI가 여기 함수만 쓰면 파일을 열어볼 수 있다. 직접 fetch 하지 말 것.
 *
 *  import { drive } from '../lib/drive.mjs';
 *  const d = await drive();
 *  await d.ls('02_스위치플랜', 'C1_계약서')          // 폴더 파일 목록
 *  await d.recent(24)                                 // 최근 24시간 새 파일 (두 드라이브 전부)
 *  await d.find('가입증명서_41구1614.pdf')            // 이름으로 찾기
 *  await d.path(fileId)                               // 「02_스위치플랜 / C_차량 / C1_계약서」
 *  await d.get(fileId, 'tmp/x.pdf')                   // 내려받기
 *  await d.text(fileId)                               // PDF 텍스트 (스캔이면 '' — 이미지는 AI가 봐야 함)
 *  await d.rows(fileId)                               // 엑셀(xls/xlsx) → 배열
 *  await d.move(fileId, targetFolderId, '새이름.pdf') // 옮기고 이름 바꾸기
 */
import { token, makeCall } from './goog.mjs';
/** ★★★upload·mkdir·put 은 «맨 fetch» 라 lease 문턱을 안 탔다 — 2026-09-03 에 시험이 잡았다.
 *  ★move·rename·trash·copy 는 makeCall() 을 거쳐 막히는데, «파일을 만드는» 셋만 새고 있었다.
 *    그래서 「드라이브 잠금 없이 돌린다」 고 해 놓고 공문 70장이 올라갈 수 있었다.
 *  ★이 셋은 헤더·몸이 특별해서(multipart·raw) makeCall 을 못 쓴다. 문턱만 따로 태운다. */
import { 구글부르기 } from './googfetch.mjs';
import { DRIVE, DCF, folder } from './ids.mjs';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import { writeStreamAtomically } from './atomic-stream-write.mjs';

const FIELDS = 'id,name,mimeType,size,createdTime,modifiedTime,parents,driveId,lastModifyingUser(displayName,emailAddress)';
export const kst = (t) => t ? new Date(new Date(t).getTime() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') : '';
const isFolder = (f) => f.mimeType === 'application/vnd.google-apps.folder';

// 동시 읽기도 고정 tmp 파일을 쓰면 다른 AI가 내려받은 파일을 분석하게 된다.
// 호출자가 tmp를 지정하지 않으면 agent/task/run별 경로를 만든다.
function runTmp(name, extension) {
  const part = (value, fallback) => String(value || fallback).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const agent = part(process.env.AIOPS_AGENT, 'read');
  const task = part(process.env.AIOPS_TASK_ID, 'adhoc');
  const root = process.env.AIOPS_TMP_DIR || join('tmp', agent, task);
  mkdirSync(root, { recursive: true });
  return join(root, `${name}-${randomUUID()}${extension}`);
}

export async function drive() {
  /** ★★토큰은 «한 시간» 짜리다 — 오래 도는 일은 반드시 만료된다 (2026-09-03)
   *
   *  실측 — 데이터센터 33,501개를 훑는데 **「다운로드 실패 401」 이 34,508건** 났다.
   *  자료가 없어서가 아니라 «인증이 끊겨서» 였다. 그런데 로그에는 「못 읽음」 으로만 남아
   *  하마터면 「이 파일들은 못 읽는다」 로 결론 낼 뻔했다.
   *  ★`token()` 은 부를 때마다 새로 받아 준다. 그런데 여기서 «한 번만» 받아 끝까지 썼다.
   *    call() 은 makeCall 이 다시 받지만, `get`·`export`·업로드는 이 `tk` 를 그대로 썼다.
   *  ★그래서 «쓸 때마다» 살아 있는 토큰을 받는다. 50분 지나면 새로 받는다. */
  let 토큰 = await token();
  let 받은때 = Date.now();
  const 산토큰 = async () => {
    if (Date.now() - 받은때 > 50 * 60 * 1000) { 토큰 = await token(); 받은때 = Date.now(); }
    return 토큰;
  };
  const tk = 토큰;
  const call = makeCall(tk);
  const pathCache = new Map();
  const q = (s) => encodeURIComponent(s);
  const common = 'includeItemsFromAllDrives=true&supportsAllDrives=true';

  async function listQuery(query, { driveId = null, limit = 0, fields = FIELDS } = {}) {
    const out = []; let pt = '';
    const corpora = driveId ? `corpora=drive&driveId=${driveId}` : 'corpora=allDrives';
    do {
      const r = await call(`https://www.googleapis.com/drive/v3/files?${corpora}&${common}&q=${q(query)}&pageSize=1000&fields=nextPageToken,files(${fields})${pt ? '&pageToken=' + pt : ''}`);
      out.push(...(r.files || [])); pt = r.nextPageToken || '';
      if (limit && out.length >= limit) break;
    } while (pt);
    return limit ? out.slice(0, limit) : out;
  }

  const api = {
    call,
    /** 폴더 안 파일 목록. ls(폴더id) 또는 ls('02_스위치플랜','C1_계약서'). recursive=true 면 하위폴더까지 */
    async ls(a, b, { recursive = false, depth = 0 } = {}) {
      const id = b ? folder(a, b) : a;
      if (!id) throw new Error(`폴더를 못 찾음: ${a} / ${b}`);
      const all = await listQuery(`'${id}' in parents and trashed = false`);
      const files = all.filter((f) => !isFolder(f));
      if (recursive && depth < 3) for (const sub of all.filter(isFolder)) files.push(...(await api.ls(sub.id, null, { recursive, depth: depth + 1 })).map((f) => ({ ...f, sub: sub.name })));
      return files;
    },
    /** 폴더 안 하위폴더 */
    async subs(a, b) { const id = b ? folder(a, b) : a; return (await listQuery(`'${id}' in parents and trashed = false`)).filter(isFolder); },
    /** 이름으로 찾기 (전 드라이브). exact=false 면 contains */
    async find(name, { exact = true, limit = 50 } = {}) {
      const esc = String(name).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return listQuery(exact ? `name = '${esc}' and trashed = false` : `name contains '${esc}' and trashed = false`, { limit });
    },
    /** 최근 N시간 안에 생성된 파일 (기본: 데이터센터+옛 드라이브). createdTime 기준 — 동기화 업로드는 수정시각이 옛날일 수 있다 */
    async recent(hours = 24, { drives = [DRIVE.데이터센터, DRIVE.여기에업로드], by = 'createdTime' } = {}) {
      const since = new Date(Date.now() - hours * 3600e3).toISOString();
      const out = [];
      for (const d of drives) out.push(...(await listQuery(`${by} > '${since}' and trashed = false and mimeType != 'application/vnd.google-apps.folder'`, { driveId: d })).map((f) => ({ ...f, drive: d === DRIVE.데이터센터 ? '데이터센터' : '여기에 업로드' })));
      return out.sort((a, b) => String(a[by]).localeCompare(String(b[by])));
    },
    /** 기간으로 (KST 날짜 문자열 'YYYY-MM-DD') */
    async between(fromKST, toKST, { drives = [DRIVE.데이터센터, DRIVE.여기에업로드] } = {}) {
      const f = new Date(fromKST + 'T00:00:00+09:00').toISOString(), t = new Date(toKST + 'T00:00:00+09:00').toISOString();
      const out = [];
      for (const d of drives) out.push(...(await listQuery(`createdTime >= '${f}' and createdTime < '${t}' and trashed = false and mimeType != 'application/vnd.google-apps.folder'`, { driveId: d })));
      return out;
    },
    /** 파일의 폴더 경로 문자열 */
    async path(fileOrId, depth = 0) {
      const id = typeof fileOrId === 'string' ? fileOrId : fileOrId.parents?.[0];
      if (!id || depth > 8) return '';
      if (pathCache.has(id)) return pathCache.get(id);
      let f; try { f = await call(`https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true&fields=id,name,parents,driveId`); } catch { return '?'; }
      const parent = f.parents?.[0] && f.parents[0] !== f.driveId ? await api.path(f.parents[0], depth + 1) : '';
      const full = (parent ? parent + ' / ' : '') + f.name;
      pathCache.set(id, full); return full;
    },
    /** 목록에 who·path 붙이기 (느리니 필요할 때만) */
    async decorate(files) { for (const f of files) { f.who = f.lastModifyingUser?.displayName || ''; f.pathStr = await api.path(f); } return files; },
    /** 내려받기 */
    async get(fileId, destPath, { maxBytes = null } = {}) {
      mkdirSync(dirname(destPath), { recursive: true });
      const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${await 산토큰()}` } });
      /** ★401 은 «자료가 없는» 게 아니라 «토큰이 죽은» 것이다 — 한 번은 새 토큰으로 다시 두드린다 */
      if (r.status === 401) {
        토큰 = await token(); 받은때 = Date.now();
        const r2 = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${토큰}` } });
        if (!r2.ok) throw new Error(`다운로드 실패 ${r2.status}`);
        await writeStreamAtomically(destPath, r2.body, { maxBytes });
        return destPath;
      }
      if (!r.ok) throw new Error(`다운로드 실패 ${r.status}`);
      const declared = Number(r.headers.get('content-length'));
      if (Number.isFinite(maxBytes) && maxBytes >= 0 && Number.isFinite(declared) && declared > maxBytes) throw new Error('다운로드 크기 상한 초과');
      // arrayBuffer()로 전체 파일을 먼저 메모리에 올리지 않는다. 실패·상한초과면 기존 목적지도 보존한다.
      await writeStreamAtomically(destPath, r.body, { maxBytes });
      return destPath;
    },
    /** 구글 문서를 내보내기 (스프레드시트 → csv 등) */
    async export(fileId, mimeType, destPath) {
      const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(mimeType)}`, { headers: { Authorization: `Bearer ${await 산토큰()}` } });
      if (!r.ok) throw new Error(`export 실패 ${r.status}`);
      mkdirSync(dirname(destPath), { recursive: true }); writeFileSync(destPath, Buffer.from(await r.arrayBuffer())); return destPath;
    },
    /** PDF 텍스트. 스캔 이미지면 '' 를 돌려준다 → 그때는 get() 으로 받아 AI가 이미지를 직접 본다 */
    async text(fileId, { tmp = null } = {}) {
      const dest = tmp || runTmp('read', '.pdf');
      await api.get(fileId, dest);
      return runPy(['import sys,re',
        'from pypdf import PdfReader',
        'try: t="".join((p.extract_text() or "") for p in PdfReader(sys.argv[1]).pages[:5])',
        'except Exception: t=""',
        'print(re.sub(r"[ \\t]+"," ",t))'], [dest]);
    },
    /** 엑셀 → 행 배열 (xls·xlsx 자동 판별, 첫 시트 또는 전체) */
    async rows(fileId, { all = false, tmp = null } = {}) {
      const dest = tmp || runTmp('read', '.xls');
      await api.get(fileId, dest);
      const out = runPy(['import sys,json,re',
        'p=sys.argv[1]; raw=open(p,"rb").read(); res={}',
        'def add(name,rows): res[name]=[[("" if c is None else c) for c in r] for r in rows]',
        'if raw[:4]==b"\\xd0\\xcf\\x11\\xe0":',
        '    import xlrd; wb=xlrd.open_workbook(p)',
        '    for ws in wb.sheets(): add(ws.name,[ws.row_values(i) for i in range(ws.nrows)])',
        'elif raw[:2]==b"PK":',
        '    import openpyxl,io; wb=openpyxl.load_workbook(io.BytesIO(raw),data_only=True)',   // 파일 «이름»이 아니라 내용으로 연다 — tmp 확장자가 .xls 라서 openpyxl 이 거부하던 문제(2026-08-21)
        '    for ws in wb.worksheets: add(ws.title,[list(r) for r in ws.iter_rows(values_only=True)])',
        'else:',
        '    txt=raw.decode("utf-8","ignore") if b"<" in raw[:400] else raw.decode("cp949","ignore")',
        '    rows=[[re.sub(r"<[^>]+>","",c).strip() for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>",tr,flags=re.S)] for tr in re.findall(r"<tr[^>]*>(.*?)</tr>",txt,flags=re.S)]',
        '    add("html",rows)',
        'print(json.dumps(res,ensure_ascii=False,default=str))'], [dest]);
      const j = JSON.parse(out);
      return all ? j : (Object.values(j)[0] || []);
    },
    /** 옮기기(+개명). 사본을 만들지 않는다 */
    async move(fileId, targetFolderId, newName = null) {
      const f = await call(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true&fields=parents,name`);
      return call(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true&addParents=${targetFolderId}&removeParents=${f.parents[0]}&fields=id,name`, { method: 'PATCH', body: JSON.stringify(newName && newName !== f.name ? { name: newName } : {}) });
    },
    /** 사본 (옛 드라이브 → 데이터센터처럼 원본을 남겨야 할 때) */
    async copy(fileId, targetFolderId, newName) { return call(`https://www.googleapis.com/drive/v3/files/${fileId}/copy?supportsAllDrives=true&fields=id,name`, { method: 'POST', body: JSON.stringify({ name: newName, parents: [targetFolderId] }) }); },
    /** 파일 올리기 (multipart). 같은 이름이 이미 있으면 안 올리고 그 파일을 돌려준다 */
    async upload(localPath, targetFolderId, { name = null, mime = 'application/pdf', 덮어쓰기 = false } = {}) {
      const 이름 = name || basename(localPath);
      if (!덮어쓰기) {
        const 있 = (await listQuery(`'${targetFolderId}' in parents and name = '${이름.replace(/'/g, "\'")}' and trashed = false`))[0];
        if (있) return { ...있, 이미있음: true };
      }
      // ★multipart 는 «CRLF» 다. LF 로 쓰거나 빈 줄이 하나보다 많으면
      //   Content-Type 이 안 읽혀 Drive 가 「Unsupported content with type: application/octet-stream」 을 낸다.
      //   (2026-08-26 에 원자 json 을 못 올려 찾았다 — pdf 는 우연히 넘어가고 있었다)
      // ★multipart 는 «CRLF» 다. LF 로 쓰거나 헤더와 본문 사이 빈 줄이 하나보다 많으면
      //   Content-Type 이 안 읽혀 Drive 가 「Unsupported content with type: application/octet-stream」 을 낸다.
      //   (2026-08-26 에 원자 json 을 못 올려 찾았다 — pdf 는 우연히 넘어가고 있었다)
      const 경계 = '----aiops' + String(localPath).length;
      const 머리 = `--${경계}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`
        + JSON.stringify({ name: 이름, parents: [targetFolderId] })
        + `\r\n--${경계}\r\nContent-Type: ${mime}\r\n\r\n`;
      const 꼬리 = `\r\n--${경계}--`;
      const 몸 = Buffer.concat([Buffer.from(머리, 'utf8'), readFileSync(localPath), Buffer.from(꼬리, 'utf8')]);
      const r = await 구글부르기('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tk}`, 'Content-Type': `multipart/related; boundary=${경계}` },
        body: 몸,
      });
      if (!r.ok) throw new Error(`업로드 실패 ${r.status} ${(await r.text()).slice(0, 200)}`);
      return { ...(await r.json()), 이미있음: false };
    },
    /** ★폴더를 만든다 — 이미 같은 이름이 있으면 «그것을 쓴다» (두 번 돌려도 안 늘어난다).
     *
     *  대표(2026-08-27): 「폴더가 «날짜랑 연동»해서 그거까지는 새로 만들어야 한다는 거야」
     *  ★데이터센터는 「폴더를 새로 만들지 않는다」 가 규칙이지만, 날짜 작업폴더는 예외다 —
     *    대표가 시킨 것이고, 만들어진 것을 «사람이 옮겨서» 없앤다 (보내면 C7 로 옮긴다) */
    async mkdir(name, parentFolderId) {
      const 있 = (await listQuery(
        `'${parentFolderId}' in parents and name = '${String(name).replace(/'/g, "\'")}' `
        + `and mimeType = 'application/vnd.google-apps.folder' and trashed = false`))[0];
      if (있) return { ...있, 이미있음: true };
      const r = await 구글부르기('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parents: [parentFolderId], mimeType: 'application/vnd.google-apps.folder' }),
      });
      if (!r.ok) throw new Error(`폴더 못 만듦 ${r.status} ${(await r.text()).slice(0, 200)}`);
      return { ...(await r.json()), 이미있음: false };
    },

    /** ★같은 이름이 있으면 «내용만» 갈아끼운다. 없으면 새로 만든다.
     *  upload 의 `덮어쓰기:true` 는 «중복 검사를 건너뛴다» 는 뜻이라 매번 새 파일이 쌓인다 —
     *  날마다 도는 것(원자 올리기 같은)은 이걸 써야 파일이 하나로 유지된다. (2026-08-26) */
    async put(localPath, targetFolderId, { name = null, mime = 'application/json' } = {}) {
      const 이름 = name || basename(localPath);
      const 있 = (await listQuery(`'${targetFolderId}' in parents and name = '${이름.replace(/'/g, "\\'")}' and trashed = false`))[0];
      if (!있) return { ...(await api.upload(localPath, targetFolderId, { name: 이름, mime, 덮어쓰기: true })), 새것: true };
      const r = await 구글부르기(`https://www.googleapis.com/upload/drive/v3/files/${있.id}?uploadType=media&supportsAllDrives=true&fields=id,name`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tk}`, 'Content-Type': mime },
        body: readFileSync(localPath),
      });
      if (!r.ok) throw new Error(`갈아끼우기 실패 ${r.status} ${(await r.text()).slice(0, 200)}`);
      return { ...(await r.json()), 새것: false };
    },
    async rename(fileId, newName) { return call(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true&fields=id,name`, { method: 'PATCH', body: JSON.stringify({ name: newName }) }); },
    async trash(fileId) { return call(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true&fields=id,trashed`, { method: 'PATCH', body: JSON.stringify({ trashed: true }) }); },
    /** 폴더별 파일 수 (회사 전체 스캔)
     *  ★밑줄로 시작하는 칸(`_root`·`_길`·`_겹침`)은 «폴더 id 가 아니다» — 건너뛴다.
     *    `_길` 은 객체고 `_겹침` 은 배열이라, 그냥 훑으면 그것을 폴더 id 인 줄 알고 조회한다 */
    async census(co) {
      const out = {};
      /** ★`_` 로 시작하는 칸은 폴더 id 가 아니고, `/` 가 든 칸은 «같은 폴더를 길로 한 번 더» 적어 둔 것이다.
       *  둘 다 건너뛴다 — 안 그러면 같은 폴더를 두 번 세고 API 도 두 배로 부른다 */
      for (const [leaf, id] of Object.entries(DCF[co] || {})) { if (leaf.startsWith('_') || leaf.includes('/')) continue; out[leaf] = (await api.ls(id)).length; }
      return out;
    },
  };
  return api;
}

function runPy(lines, args) {
  return execFileSync('python', ['-c', lines.join('\n'), ...args], { encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONWARNINGS: 'ignore' } });
}
export const CAR = /([0-9]{2,3}[가-힣][0-9]{4})/;   // 차량번호 정규식 (파일명에서 뽑을 때)
