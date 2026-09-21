import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  validateUiUxEntrypointSemantics,
  validateUiUxTargetBinding
} from '../src/engine/ui-ux-entrypoint.mjs';

const entry = JSON.parse(
  await readFile(new URL('../registry/ui-ux-entrypoint.json', import.meta.url), 'utf8')
);

test('UI/UX work has one canonical start-here route', () => {
  const result = validateUiUxEntrypointSemantics(entry);
  assert.equal(result.status, 'VALID');
  assert.equal(entry.entry_read_order[0], 'docs/UI_UX_START_HERE.md');
  assert.equal(entry.product_profiles.FREEPASS, 'docs/FREEPASS_PRODUCT_UI_PROFILE.md');
});

test('FreePass work cannot silently drop the product profile', () => {
  const broken = structuredClone(entry);
  delete broken.product_profiles.FREEPASS;
  assert.throws(
    () => validateUiUxEntrypointSemantics(broken),
    /UIUX_ENTRY_FREEPASS_PROFILE_MISSING/
  );
});

test('Design Hub binding check is mandatory before implementation claims', () => {
  const broken = structuredClone(entry);
  broken.fail_closed_rules = broken.fail_closed_rules.filter(
    (item) => item !== 'DESIGN_HUB_BINDING_MUST_MATCH_INTENDED_CORE_REVISION'
  );
  assert.throws(
    () => validateUiUxEntrypointSemantics(broken),
    /UIUX_ENTRY_FAIL_CLOSED_MISSING:DESIGN_HUB_BINDING_MUST_MATCH_INTENDED_CORE_REVISION/
  );
});

test('target preflight accepts an exact Design Hub Core revision binding', () => {
  const coreRevision = 'a'.repeat(40);
  const designHubBinding = {
    contract: 'devcenter-design-core-binding/v1',
    ai_core: {
      repository: 'freepass-creator/ai-core',
      revision: coreRevision
    }
  };

  const result = validateUiUxTargetBinding(entry, {
    coreRevision,
    designHubBinding
  });

  assert.equal(result.status, 'VALID');
  assert.equal(result.designHubRevision, coreRevision);
});

test('target preflight fails closed when Design Hub pins a stale Core revision', () => {
  const designHubBinding = {
    contract: 'devcenter-design-core-binding/v1',
    ai_core: {
      repository: 'freepass-creator/ai-core',
      revision: 'a'.repeat(40)
    }
  };

  assert.throws(
    () => validateUiUxTargetBinding(entry, {
      coreRevision: 'b'.repeat(40),
      designHubBinding
    }),
    /UIUX_DESIGN_HUB_CORE_REVISION_STALE/
  );
});

test('preview cannot be promoted to conformance without evidence', () => {
  const broken = structuredClone(entry);
  broken.fail_closed_rules = broken.fail_closed_rules.filter(
    (item) => item !== 'PREVIEW_IS_NOT_CONFORMANCE'
  );
  assert.throws(
    () => validateUiUxEntrypointSemantics(broken),
    /UIUX_ENTRY_FAIL_CLOSED_MISSING:PREVIEW_IS_NOT_CONFORMANCE/
  );
});
