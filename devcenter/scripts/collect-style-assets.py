"""Inventory local stylesheet evidence; derived catalog is never authority.

Reads development source only. Does not import or execute scanned projects.
"""
import hashlib
import json
import os
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path('C:/dev')
HERE = Path(__file__).resolve().parents[1]
OUTPUT = HERE / 'portal/public/catalog/styles.json'
EXPLICIT = HERE / 'portal/app/globals.css'
MAX_SOURCE = 200_000
SKIP = {'.git', 'node_modules', '.next', '.vercel', '.wrangler', '.firebase',
        '.venv', 'venv', 'dist', 'build', 'out', 'coverage', '__pycache__',
        'reviews', 'runs', 'sessions', 'logs', 'data', 'exports', 'uploads',
        'downloads', 'generated', 'generated_images', '고객', '계약', '사건',
        '증거', '첨부', 'private', 'secrets', 'vendor', 'vendors'}
SENSITIVE = re.compile(r'credential|secret|service.?account|private.?key|oauth|'
                       r'customer|client.?data|고객|주민|급여|소송|판결|개인정보|지분인수', re.I)
SECRET = re.compile(r'private[_ -]?key|AIza[\w-]+|gh[pousr]_[\w]+|'
                    r'Bearer\s+\S+|(?:password|api[_-]?key|access[_-]?token|'
                    r'비밀번호)\s*[:=]|-----BEGIN .*PRIVATE KEY', re.I)
URL = re.compile(r'(?:https?:)?//[^\s\)\]\}\"\'<>;]+', re.I)
EMAIL = re.compile(r'\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b')
IDENT = re.compile(r'\b(?:\d{6}-?[1-8]\d{6}|01[016789][- ]?\d{3,4}[- ]?\d{4})\b')


def linked(path):
    return path.is_symlink() or (hasattr(path, 'is_junction') and path.is_junction())


def redact(text):
    result = []
    changed = []
    for number, line in enumerate(text.splitlines(), 1):
        if SECRET.search(line):
            safe = '/* credential-like content excluded */'
        else:
            safe = URL.sub('[external-url-redacted]', line)
            safe = EMAIL.sub('[email-redacted]', safe)
            safe = IDENT.sub('[identifier-redacted]', safe)
            safe = re.sub(r'data:[^\s)\"\']+', '[embedded-data-redacted]', safe, flags=re.I)
        if safe != line:
            changed.append(number)
        result.append(safe)
    return '\n'.join(result), changed


def categories(path, text):
    result = []
    if path.name.endswith('.module.css') or path.name.endswith('.module.scss'):
        result.append('css-module')
    if path.suffix == '.scss':
        result.append('scss')
    if re.search(r'--[\w-]+\s*:', text):
        result.append('tokens')
    if re.search(r'button|\bbtn\b', text, re.I):
        result.append('buttons')
    if re.search(r'input|select|dropdown|checkbox', text, re.I):
        result.append('forms')
    if re.search(r'table|\bgrid\b', text, re.I):
        result.append('tables-layout')
    if 'global' in path.name.lower():
        result.append('global')
    return result or ['stylesheet']


def collect():
    excluded = Counter()
    errors = []
    paths = []
    inline_paths = []
    projects = 0
    for project in sorted(ROOT.iterdir(), key=lambda p: p.name.lower()):
        if not project.is_dir():
            continue
        if linked(project) or SENSITIVE.search(project.name) or (project.name.startswith('.') and not (project / '.git').exists()):
            excluded['project_link_hidden_or_sensitive'] += 1
            continue
        projects += 1
        for base, dirs, names in os.walk(project, followlinks=False,
                                         onerror=lambda e: errors.append({'reason': type(e).__name__})):
            keep = []
            for name in dirs:
                path = Path(base) / name
                if (name.lower() in SKIP or name.startswith('.') or
                        name.lower().startswith(('backup', 'tmp', 'temp')) or
                        SENSITIVE.search(name) or linked(path)):
                    excluded['directory'] += 1
                elif path == HERE / 'portal':
                    excluded['generated_portal'] += 1
                else:
                    keep.append(name)
            dirs[:] = keep
            for name in names:
                path = Path(base) / name
                if path.suffix.lower() in {'.tsx', '.jsx', '.ts', '.js'} and not name.endswith(('.d.ts', '.min.js')):
                    if not linked(path) and not SENSITIVE.search(name):
                        inline_paths.append(path)
                if path.suffix.lower() not in {'.css', '.scss'}:
                    continue
                if linked(path) or SENSITIVE.search(name):
                    excluded['file_link_or_sensitive'] += 1
                    continue
                paths.append(path)
    if EXPLICIT.is_file() and not linked(EXPLICIT):
        paths.append(EXPLICIT)
    foundation_css = HERE / 'portal/app/foundation.css'
    if foundation_css.is_file() and not linked(foundation_css):
        paths.append(foundation_css)
    portal_app = HERE / 'portal/app'
    if portal_app.is_dir() and not linked(portal_app):
        for base, dirs, names in os.walk(portal_app, followlinks=False):
            dirs[:] = [d for d in dirs if d.lower() not in SKIP and not d.startswith('.') and not SENSITIVE.search(d) and not linked(Path(base) / d)]
            inline_paths.extend(Path(base) / n for n in names if n.endswith('.tsx') and not SENSITIVE.search(n) and not linked(Path(base) / n))
    foundation = HERE / 'portal/build-static.mjs'
    if foundation.is_file() and not linked(foundation):
        inline_paths.append(foundation)
    files = []
    hashes = defaultdict(list)
    for path in sorted(set(paths), key=lambda p: str(p).lower()):
        relative = path.relative_to(ROOT).as_posix()
        try:
            before = path.stat()
            digest = hashlib.sha256()
            chunks = []
            lines = 0
            last = b''
            with path.open('rb') as stream:
                for chunk in iter(lambda: stream.read(65536), b''):
                    digest.update(chunk)
                    lines += chunk.count(b'\n')
                    last = chunk[-1:]
                    if before.st_size <= MAX_SOURCE:
                        chunks.append(chunk)
            if before.st_size and last != b'\n':
                lines += 1
            after = path.stat()
            status = 'included'
            source = ''
            changed = []
            if before.st_size != after.st_size or before.st_mtime_ns != after.st_mtime_ns:
                status = 'excluded_changed_during_read'
            elif path.name.endswith(('.min.css', '.min.scss')) or path.name.endswith(('.generated.css', '.generated.scss')):
                status = 'excluded_generated_stylesheet'
            elif before.st_size > MAX_SOURCE:
                status = 'excluded_over_200KB'
            else:
                raw = b''.join(chunks)
                try:
                    decoded = raw.decode('utf-8-sig')
                except UnicodeDecodeError:
                    decoded = ''
                    status = 'excluded_non_utf8'
                if '\x00' in decoded:
                    decoded = ''
                    status = 'excluded_binary'
                source, changed = redact(decoded)
                if changed:
                    status = 'included_redacted'
            selectors = []
            variables = []
            for number, line in enumerate(source.splitlines(), 1):
                # Lexical excerpts, not a CSS parser or computed selector claim.
                if '{' in line and not line.lstrip().startswith(('/*', '*', '//')):
                    selectors.append({'line': number, 'text': line.split('{', 1)[0].strip()[:500]})
                if re.search(r'--[\w-]+\s*:', line):
                    variables.append({'line': number, 'text': line.strip()[:500]})
            row = {'id': hashlib.sha256(relative.encode()).hexdigest()[:16],
                   'project': relative.split('/')[0], 'path': relative,
                   'sha256': digest.hexdigest(), 'lineCount': lines,
                   'byteCount': before.st_size, 'categories': categories(path, source),
                   'selectors': selectors, 'variables': variables, 'source': source,
                   'sourceStatus': status, 'redactedLines': changed,
                   'displaySha256': hashlib.sha256(source.encode('utf-8')).hexdigest() if source else None,
                   'hashMeaning': 'sha256 hashes original file bytes; displaySha256 hashes displayed UTF-8 source after normalization and redaction',
                   'authority': 'derived_evidence_not_authority', 'runtimeVerified': False}
            files.append(row)
            hashes[row['sha256']].append(relative)
        except OSError as error:
            errors.append({'path': relative, 'reason': type(error).__name__})
    marker_patterns = [
        ('jsx-inline-style', re.compile(r'\bstyle\s*=\s*\{')),
        ('styled-component', re.compile(r'\bstyled\s*(?:\.|\()')),
        ('css-template-or-call', re.compile(r'\bcss\s*(?:`|\()')),
        ('class-variance', re.compile(r'\bcva\s*\(')),
        ('css-string-candidate', re.compile(r'(?:\b(?:css|styles?|stylesheet|globalStyles)\b\s*=\s*[`\"\']|<style\b)', re.I)),
    ]
    inline_styles = []
    inline_seen = 0
    for path in sorted(set(inline_paths), key=lambda p: str(p).lower()):
        relative = path.relative_to(ROOT).as_posix()
        try:
            before = path.stat()
            if before.st_size > 1_500_000:
                excluded['inline_over_1_5MB'] += 1
                continue
            raw = path.read_bytes()
            after = path.stat()
            if before.st_size != after.st_size or before.st_mtime_ns != after.st_mtime_ns:
                excluded['inline_changed_during_read'] += 1
                continue
            try:
                decoded = raw.decode('utf-8-sig')
            except UnicodeDecodeError:
                excluded['inline_non_utf8'] += 1
                continue
            inline_seen += 1
            markers = []
            for number, line in enumerate(decoded.splitlines(), 1):
                kinds = [kind for kind, pattern in marker_patterns if pattern.search(line)]
                if not kinds:
                    continue
                safe, changed = redact(line)
                for kind in kinds:
                    markers.append({'line': number, 'kind': kind, 'text': safe.strip()[:400],
                                    'redacted': bool(changed), 'truncated': len(safe.strip()) > 400})
            if markers:
                inline_styles.append({'id': hashlib.sha256(relative.encode()).hexdigest()[:16],
                                      'project': relative.split('/')[0], 'path': relative,
                                      'sha256': hashlib.sha256(raw).hexdigest(),
                                      'lineCount': len(decoded.splitlines()), 'markers': markers[:300],
                                      'markerCount': len(markers), 'markersTruncated': len(markers) > 300,
                                      'status': 'lexical_candidates_not_validated_styles',
                                      'authority': 'derived_evidence_not_authority'})
        except OSError as error:
            errors.append({'path': relative, 'reason': type(error).__name__})
    pointers = []
    index_path = HERE / 'portal/public/catalog/index.json'
    if index_path.exists():
        index = json.loads(index_path.read_text(encoding='utf-8-sig'))
        for symbol in index.get('symbols', []):
            if symbol.get('kind') == 'token':
                pointers.append({k: symbol[k] for k in ('name', 'project', 'path', 'line', 'sha256') if k in symbol})
    return {'capturedAt': datetime.now(timezone.utc).isoformat(),
            'coverage': {'root': str(ROOT), 'projectDirectoriesWalked': projects,
                         'stylesheets': len(files), 'statusCounts': dict(Counter(f['sourceStatus'] for f in files)),
                         'inlineSourceFilesRead': inline_seen,
                         'inlineStyleFiles': len(inline_styles),
                         'inlineStyleMarkers': sum(len(f['markers']) for f in inline_styles),
                         'inlineStyleMarkersFound': sum(f['markerCount'] for f in inline_styles),
                         'excluded': dict(excluded), 'readErrors': len(errors),
                         'maxSourceBytes': MAX_SOURCE, 'tokenModulePointers': pointers,
                         'explicitPortalSource': EXPLICIT.relative_to(ROOT).as_posix()},
            'files': files,
            'inlineStyles': inline_styles,
            'duplicates': [{'sha256': h, 'paths': p} for h, p in hashes.items() if len(p) > 1],
            'limitations': ['Derived source snapshots and hash duplicates do not determine authority or approved design.',
                            'CSS/SCSS includes module files. Inline and CSS-in-JS entries are bounded lexical candidates, not validated CSS semantics or runtime computed styles.',
                            'Inline markers cover eligible TS/TSX/JS/JSX plus explicit portal app TSX and build-static.mjs; at most 300 markers per file and 400 characters per excerpt.',
                            'Selectors and variables are line-based lexical excerpts, not a complete CSS/SCSS parser.',
                            'Sensitive, dependency, generated, linked and excluded directories are not scanned; remote-only repositories are outside scope.',
                            'Sources over 200000 bytes, generated filenames, binary and non-UTF8 content are metadata-only.',
                            'External URLs, embedded data, identifiers and credential-like lines are redacted; redacted source is for inspection, not execution.',
                            'Token pointers reuse the existing index snapshot and are not refreshed or declared authoritative here.',
                            'Archived repositories and worktrees may appear separately; identical byte hashes are grouped without merging them.'],
            'errors': errors}


if __name__ == '__main__':
    catalog = collect()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    verified = json.loads(OUTPUT.read_text(encoding='utf-8'))
    assert len({f['id'] for f in verified['files']}) == len(verified['files'])
    assert all(not URL.search(f['source']) and not SECRET.search(f['source']) for f in verified['files'])
    print(json.dumps({k: v for k, v in verified['coverage'].items() if k != 'tokenModulePointers'}, ensure_ascii=False))
