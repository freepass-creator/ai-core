import fs from 'node:fs';
import path from 'node:path';
import { evaluateUiMachineConformance } from '../src/engine/ui-ux-machine-conformance.mjs';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function resolveFiles(baseDir, files) {
  return files.map((entry) => {
    const rel = typeof entry === 'string' ? entry : entry.path;
    const full = path.resolve(baseDir, rel);
    return { id: rel, path: rel, content: fs.readFileSync(full, 'utf8') };
  });
}

function selfTest() {
  const manifest = {
    contract: 'ai-core-ui-machine-conformance/v1',
    version: '1.0.0',
    style_files: ['self.css'],
    usage_files: ['self.tsx'],
    rules: [{
      id: 'control.height',
      target_classes: ['ui-button'],
      property: 'height',
      allowed_values: ['var(--control-height)'],
      require_match: true
    }]
  };
  const pass = evaluateUiMachineConformance({
    manifest,
    styleSources: [{ id: 'self.css', content: '.ui-button{height:43px}.ui-button{height:var(--control-height)}.legacy{height:17px}' }],
    usageSources: [{ id: 'self.tsx', content: '<button className="ui-button">Save</button>' }]
  });
  const fail = evaluateUiMachineConformance({
    manifest,
    styleSources: [{ id: 'self.css', content: '.ui-button{height:43px}' }],
    usageSources: [{ id: 'self.tsx', content: '<button className="ui-button">Save</button>' }]
  });
  if (pass.status !== 'PASS' || fail.status !== 'FAIL') throw new Error('UIUX_MACHINE_SELF_TEST_FAILED');
  console.log(JSON.stringify({ status: 'VALID', pass_checked: pass.checked.length, negative_violations: fail.violations.length }, null, 2));
}

const args = process.argv.slice(2);
if (args.includes('--self-test')) {
  selfTest();
  process.exit(0);
}

const index = args.indexOf('--manifest');
if (index < 0 || !args[index + 1]) {
  console.error('usage: node scripts/validate-ui-ux-machine-conformance.mjs --manifest <path> | --self-test');
  process.exit(2);
}

const manifestPath = path.resolve(args[index + 1]);
const manifest = readJson(manifestPath);
const baseDir = path.dirname(manifestPath);
const result = evaluateUiMachineConformance({
  manifest,
  styleSources: resolveFiles(baseDir, manifest.style_files),
  usageSources: resolveFiles(baseDir, manifest.usage_files)
});

console.log(JSON.stringify(result, null, 2));
if (result.status !== 'PASS') process.exit(1);
