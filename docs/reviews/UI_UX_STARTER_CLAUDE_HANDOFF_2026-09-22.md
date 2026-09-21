# Claude UI/UX starter review handoff

Do not invoke Claude before **2026-09-22 13:00 KST**.

## Subject

- repository: `freepass-creator/ai-core`
- branch: `codex/ui-ux-new-project-starter`
- implementation baseline: `608efbd2cabf1c277cf54476011bad1d1804c039`
- review current branch HEAD when the review starts
- scope: `templates/ui-starter/**`, `registry/ui-component-catalog.json`, `scripts/init-ui-ux-starter.mjs`, `test/ui-ux-starter.test.mjs`

## Original requirement

Six copy-ready models must cover LIST, DETAIL, FORM, HOME, SELECT/STEP and RESULT/RECEIPT. They must preserve the three user rules, responsive widths 360/390/412/1280/1440, state semantics, accessibility, safe area and virtual keyboard behavior. Component IDs and SET IDs are permanent after publication.

## Review questions

1. Does each model match its stated use and avoid case?
2. Can a developer start from `SET-01` or a model without learning the internal registry first?
3. Are requested, processing, success, failure and hold kept semantically distinct?
4. Find contradictions, missing states, nested-card drift and navigation/action mixing.
5. Identify any catalog ID whose meaning is too broad to remain permanent.

## Reproduction

```powershell
node --test test/ui-ux-starter.test.mjs
npm run uiux:validate
npm run uiux:runtime
node scripts/init-ui-ux-starter.mjs --target <temp> --profile freepass-product --product "검토 화면"
python -m http.server 4321 --directory <temp>
```

Review desktop 1280/1440 and mobile 360/390/412. Report PASS or HOLD with file-level evidence. Do not edit files.
