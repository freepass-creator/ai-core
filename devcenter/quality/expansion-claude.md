Read-only review; I did not execute anything, so every "reproduction" below is a described procedure, not an observed run.

## 1. The collector imports and executes code from a project it inventories

`scripts/collect-toolbox.mjs` line 1 claims *"Never imports inspected projects"*, then line 6 does exactly that:

```js
import ts from '../portal/node_modules/typescript/lib/typescript.js';
```

`portal` is an inspected project — its `package.json` becomes a `manifests[]` entry and its files are inventory candidates. So the tool runs several MB of third-party code out of a dependency tree that is itself inside the audit scope, at import time, before any containment check. The header claim is false as written, and the isolation property the design rests on ("derived pointers only, nothing from the inspected tree runs") does not hold.

Secondary consequence: the hardcoded deep path bypasses resolution. Under pnpm/Yarn PnP, `portal/node_modules/typescript/lib/typescript.js` does not exist and both the collector and `verify-toolbox.mjs` fail at import with `ERR_MODULE_NOT_FOUND` — the verifier cannot even reach its assertions.

## 2. `input.projects[].name` skips the containment check that `input.modules[].path` gets

Modules are guarded:

```js
const file=path.resolve(root,m.path);
if(!file.startsWith(path.resolve(root)+path.sep)){issues.push({path:m.path,reason:'outside_root'});continue;}
```

Project names are not:

```js
for(const p of input.projects)dirs.add(path.resolve(root,p.name));
```

Reproduce: run the collector against an inventory containing `projects:[{name:'..'}]` (or any absolute path). `dirs` gains the parent of `root`; the manifest loop reads `<root>/../package.json` and publishes its dependency names, version ranges, `scriptNames`, content SHA, and `path.relative(root,file)` → `"../package.json"`. `relative.split('/')[0]` then yields `".."` as the `project` label, which surfaces verbatim in the Toolbox project dropdown. Inventories are stated to be candidates, not approved input — this path trusts them for filesystem reach.

## 3. Symlink defence covers only the final path component, and skipped links disappear from the reported numbers

```js
if(fs.lstatSync(file).isSymbolicLink()){audit.linked++;continue;}
```

`lstat` is called on the file, and the prefix check in finding 2 runs on the *unresolved* path; `realpath` is never called. Reproduce: make `app/components` a directory symlink to a target outside `root`, leave the inventory entry as `app/components/ui.tsx`. The path passes `startsWith(root+sep)`, the leaf is not itself a link, so the file is read, hashed, parsed, and its export names + `path:line` are published from outside the scope root.

Separately, the `linked` branch is silent: no `issues` entry is pushed. The UI metric `원본 변경·누락` is `coverage.changed+coverage.missing`, which excludes `linked`, so `원본 해시 재대조 {current}/{modules}` shows an unexplained shortfall with nothing in the 미수집 항목 list accounting for it, and no `limitations` string mentions symlinks. `verify-toolbox.mjs` never constructs a symlink case, so its `PASS` line does not cover any of this.

## 4. Symbol extraction is silently restricted, and JSX-in-`.js` is reported as a parse failure

```js
if(!/\.[cm]?[jt]sx?$/.test(file)||!/components\/|hooks\/|\/ui\//.test(m.path))continue;
...
const sf=ts.createSourceFile(file,source,...,/x$/.test(file)?ts.ScriptKind.TSX:ts.ScriptKind.TS)
```

Neither restriction appears in `limitations[]`, which only qualifies *candidacy* ("공개 심볼의 이름·위치에 따른 후보") and the package.json scope. A project keeping components in `src/widgets/` or `features/` contributes zero symbols while the header still reads `UI·훅 공개 심볼 {n}` and the panel promises "원본이 있는 곳으로 연결하는 창고" — the omission is invisible to the reader.

The ScriptKind heuristic keys on a trailing `x` in the filename. `.jsx`/`.tsx` are fine; a `.js` file containing JSX is parsed as `ScriptKind.TS`, where `<div>` is read as a type assertion. `sf.parseDiagnostics.length` is then non-zero and the module is filed as `reason:'parse_errors'` — a wrong cause for what is a configuration mismatch, and it drops every symbol in the file. Reproduce: add `app/components/legacy.js` containing `export function Card(){return <div/>;}` to the fixture; expect it in `issues` as `parse_errors` with no assets. (Also note `parseDiagnostics` is an `@internal` TypeScript property, not public API — it works today in JS but is not contract-stable.)

## 5. Output path may not be the served path — uncertain, needs one check

The collector defaults to reading/writing `portal/public/catalog/*.json`, and `toolbox.tsx` fetches `/catalog/toolbox.json`. The working tree in this repo carries its catalog under `portal/static/catalog/` (`acceptance.json`, `functions-summary.json`, `functions/*.json`) alongside `portal/static/app.js`. I could not open the tree to confirm which directory is the static root, so this is flagged, not asserted. If `portal/static` is the served root, the fetch 404s, the `if(!r.ok)` branch throws, and the component renders the error box permanently — the retry button re-fetches the same missing URL. Confirm by checking whether `portal/public/` exists and is served; if not, the default `out` path in the CLI block and the `functions.json` input default both point at the wrong tree.
