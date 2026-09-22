"""Read-only development-rule index. Output is derived evidence, never authority."""
import os, re, json, hashlib, subprocess
from pathlib import Path
from datetime import datetime, timezone
from collections import Counter

ROOT=Path('C:/dev')
HERE=Path(__file__).resolve().parents[1]
OUT=HERE/'portal/public/catalog'
OUT.mkdir(parents=True,exist_ok=True)
REGISTERED={d['source']['locator'] for d in json.loads((HERE/'registry.json').read_text(encoding='utf-8-sig'))['datasets'] if d.get('source',{}).get('kind')=='markdown_doc'}
SKIP={'.git','node_modules','.next','.vercel','.wrangler','.firebase','.venv','venv','dist','build','out','coverage','__pycache__','reviews','runs','sessions','logs','data','exports','uploads','downloads','generated','generated_images','고객','계약','사건','증거','첨부','private','secrets'}
CODE={'.ts','.tsx','.js','.jsx','.mjs','.cjs','.mts','.cts','.py','.vue','.svelte','.css','.scss'}
DOC={'.md','.mdc','.rst'}
RULE=re.compile(r'spec|design|standard|architect|atomic|atomiz|token|component|convention|playbook|원자|규격|규칙|개발|설계|매뉴얼',re.I)
SENSITIVE=re.compile(r'credential|secret|service.?account|private.?key|oauth|customer|고객|주민|급여|소송|판결|개인정보|지분인수',re.I)
ACTIVE={'aiops','teamjpkwork','freepasserp4','casemap','chakhandeal','workcontrol','billincar','devcenter','ssot-hub'}
ARCHIVE={'_base','_wt-base','_wt-verify','_fp4-baseline','freepasserp4-esign-hotfix','jpkerp','worknavi','worknavi-security','jpkerp-v4','jpkerp2','freepasserp','freeepasserp2','freepasserp3','rentsafe','welrixtable','welrix-proposal'}
def sha(b):return hashlib.sha256(b).hexdigest()
def clean(line):
    line=re.sub(r'\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b','[이메일 제외]',line)
    line=re.sub(r'\b(?:\d{6}-?[1-8]\d{6}|01[016789][- ]?\d{3,4}[- ]?\d{4})\b','[식별정보 제외]',line)
    line=re.sub(r'https?://\S+','[외부 주소]',line)
    if re.search(r'private_key|AIza|gh[pousr]_|Bearer |password\s*[:=]|비밀번호\s*[:=]',line,re.I):return '[민감 가능 내용 제외]'
    return line[:320]
def git(path,*args):
    try:
        p=subprocess.run(['git','-C',str(path),*args],capture_output=True,text=True,encoding='utf8',errors='replace',timeout=10)
        return p.stdout.strip() if p.returncode==0 else None
    except Exception:return None
def cats(path,text):
    s=(str(path)+' '+text[:5000]).lower();c=[]
    for key,terms in {'ssot':['ssot','정본','single source'],'design':['design','디자인','토큰','tokens','ui '],'atoms':['원자','atomic','atomization','components'],'workflow':['협업','agents','claude','cursor','인계','오더'],'quality':['test','검증','검수','회귀'],'architecture':['architecture','아키텍처','구조','설계']}.items():
        if any(t in s for t in terms):c.append(key)
    return c or ['other']

projects=[];documents=[];symbols=[];excluded=Counter();errors=[];imports=Counter();files_seen=0;code_read=0
for project in sorted(ROOT.iterdir(),key=lambda p:p.name.lower()):
    if not project.is_dir():continue
    row={'name':project.name,'path':project.name,'lifecycle':'active' if project.name in ACTIVE else 'archived' if project.name in ARCHIVE else 'unconfirmed','files':0,'codeFiles':0,'documents':0,'symbols':0}
    if project.is_symlink() or project.is_junction() or (project.name.startswith('.') and not (project/'.git').exists()):
        row['excluded']='link_or_hidden_non_project';excluded[row['excluded']]+=1;projects.append(row);continue
    row['head']=git(project,'rev-parse','HEAD');row['gitGroup']=git(project,'rev-parse','--path-format=absolute','--git-common-dir') if (project/'.git').exists() else None
    def onerror(e):errors.append({'project':project.name,'reason':str(e)})
    for base,dirs,files in os.walk(project,onerror=onerror,followlinks=False):
        keep=[]
        for d in dirs:
            q=Path(base)/d
            if d in SKIP or (d.startswith('.') and d not in {'.cursor','.claude','.github'}) or d.lower().startswith(('backup','tmp','temp')) or SENSITIVE.search(d) or q.is_symlink() or q.is_junction():excluded['excluded_directory']+=1
            elif q==HERE/'portal':excluded['generated_portal']+=1
            else:keep.append(d)
        dirs[:]=keep
        for name in files:
            p=Path(base)/name;rel=p.relative_to(ROOT).as_posix();files_seen+=1;row['files']+=1
            if p.is_symlink() or SENSITIVE.search(name):excluded['sensitive_name_or_link']+=1;continue
            ext=p.suffix.lower()
            isdoc=ext in DOC or name=='.cursorrules'
            iscode=ext in CODE and not name.endswith(('.min.js','.d.ts'))
            if not(isdoc or iscode):continue
            try:
                if p.stat().st_size>1500000:excluded['over_1_5MB']+=1;continue
                b=p.read_bytes();txt=b.decode('utf-8-sig',errors='replace')
            except Exception as e:errors.append({'path':rel,'reason':type(e).__name__});continue
            if iscode:
                row['codeFiles']+=1;code_read+=1
                for m in re.finditer(r'(?:import|export)\s+[^;\n]*?\bfrom\s*[\'"]([^\'"]+)[\'"]',txt):imports[(project.name,m.group(1))]+=1
                if any(x in p.parts for x in ('components','ui')) or 'token' in name.lower():
                    for m in re.finditer(r'^export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class)\s+(\w+)',txt,re.M):
                        nm=m.group(1)
                        symbols.append({'name':nm,'project':project.name,'path':rel,'line':txt[:m.start()].count('\n')+1,'sha256':sha(b),'kind':'token' if 'token' in name.lower() else 'component','inspection':'export declaration','runtimeVerified':False})
                        row['symbols']+=1
            # Discover developer documents by filename OR explicit rule heading; only extracted lines are published.
            if isdoc and (rel in REGISTERED or RULE.search(name) or name.upper() in {'AGENTS.MD','CLAUDE.MD','DESIGN.MD','.CURSORRULES'} or re.search(r'^#{1,3}\s+.*(?:개발 규격|디자인 규격|원자화|코딩 규칙|SSOT)',txt,re.M)):
                lines=txt.splitlines();headings=[{'line':i+1,'text':clean(t.lstrip('# ').strip())} for i,t in enumerate(lines) if re.match(r'^#{1,4} ',t)]
                rules=[{'line':i+1,'text':clean(t.strip())} for i,t in enumerate(lines) if re.search(r'금지|반드시|정본|SSOT|해야|원자|규격|MUST|must not',t) and 8<len(t)<500]
                documents.append({'id':sha(rel.encode())[:12],'project':project.name,'path':rel,'sha256':sha(b),'title':headings[0]['text'] if headings else name,'categories':cats(rel,txt),'lineCount':len(lines),'headings':headings[:25],'rules':rules[:10],'ruleLinesFound':len(rules),'status':'indexed_not_adjudicated','lifecycle':row['lifecycle']})
                row['documents']+=1
    projects.append(row);print(project.name,row['documents'],row['codeFiles'],flush=True)

# Import-string evidence is not a runtime usage claim.
for s in symbols:
    suffix=Path(s['path']).with_suffix('').as_posix().split('/',1)[1]
    s['moduleReferences']=sum(v for (pr,key),v in imports.items() if pr==s['project'] and (key.endswith(suffix) or key.endswith('/'+Path(suffix).name)))

groups={x['gitGroup'] for x in projects if x.get('gitGroup')}
data={'capturedAt':datetime.now(timezone.utc).isoformat(),'scope':'C:/dev 아래 일반 디렉터리의 개발 규격 문서·코드, 깊이 제한 없음','coverage':{'projectDirectories':len(projects),'walkedFiles':files_seen,'codeFilesRead':code_read,'documents':len(documents),'exports':len(symbols),'gitGroups':len(groups),'readErrors':len(errors),'excluded':dict(excluded)},'limitations':['제외 폴더·민감 가능 파일·1.5MB 초과 파일은 확인 범위 밖','문서 내용 색인과 개별 규격의 의미/승인 검토는 다름','import 문자열 참조 수는 실제 실행·사용 가능 판정이 아님','worktree·사본은 별도 원본으로 승격하지 않음','원격 전용·다른 드라이브는 별도 범위'],'projects':projects,'documents':documents,'symbols':symbols,'errors':errors,'authorityMap':'aiops/docs/저장소지도.md'}
(OUT/'index.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf8')
audit=HERE/'reviews/2026-09-09-browser-center/atomic-audit.json'
if audit.exists():(OUT/'atomic-audit.json').write_bytes(audit.read_bytes())
print(json.dumps(data['coverage'],ensure_ascii=False))
