/** ZIP/XLSX 패키지의 메타데이터를 bounded read로만 관측한다. 셀값·파일명은 반환하지 않는다. */
import { execFileSync } from 'node:child_process';
import { assessTaxContainer } from './tax-container-safety.mjs';

const METADATA_ENTRY_LIMIT = 256 * 1024;

const python = String.raw`
import json,os,sys,zipfile
p=sys.argv[1]; lim=int(sys.argv[2])
with zipfile.ZipFile(p) as z:
    names=set(z.namelist())
    def read_small(name):
        if name not in names: return (b'',False)
        info=z.getinfo(name)
        if info.file_size>lim: return (b'',True)
        with z.open(info) as f: return (f.read(lim+1),False)
    content,content_big=read_small('[Content_Types].xml')
    rels,rels_big=read_small('xl/_rels/workbook.xml.rels')
    entries=[]
    for i,info in enumerate(z.infolist()):
        member=info.filename.replace('\\','/')
        base=os.path.basename(member)
        entries.append({'index':i,'isDirectory':info.is_dir(),'isXlsx':base.lower().endswith('.xlsx'),
          'unsafePath':member.startswith('/') or '..' in member.split('/') or not base,
          'encrypted':bool(info.flag_bits&0x1),'fileSize':info.file_size,'compressedSize':info.compress_size})
    print(json.dumps({'entries':entries,'hasContentTypes':'[Content_Types].xml' in names,
      'hasWorkbookXml':'xl/workbook.xml' in names,
      'hasMacroPayload':('xl/vbaProject.bin' in names or any(n.startswith('xl/macrosheets/') for n in names) or b'vbaProject' in content),
      'hasExternalDependency':(any(n.startswith('xl/externalLinks/') for n in names) or 'xl/connections.xml' in names or b'TargetMode="External"' in rels),
      'hasOversizedMetadataEntry':content_big or rels_big},ensure_ascii=False))
`;

export function inspectTaxContainerFile(path, { timeoutMs = 15_000 } = {}) {
  return JSON.parse(execFileSync('python', ['-c', python, path, String(METADATA_ENTRY_LIMIT)], {
    encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: timeoutMs,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  }));
}

export function preflightTaxContainer(path, kind, options = {}) {
  try {
    const manifest = inspectTaxContainerFile(path, options);
    return { ...assessTaxContainer({ kind, ...manifest }), readable: true };
  } catch {
    return { readable: false, holds: [kind === 'XLSX' ? 'HOLD_XLSX_CONTAINER_UNREADABLE' : 'HOLD_ARCHIVE_UNREADABLE'], safeXlsxMemberIndexes: [] };
  }
}
