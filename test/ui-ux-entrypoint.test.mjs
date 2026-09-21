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

const boundSources = {
  feature_registry: 'registry/ui-ux-features.json',
  tokens: 'design-system/tokens.json',
  components: 'design-system/components.registry.json',
  patterns: 'design-system/patterns.registry.json',
  runtime_css: 'design-system/runtime-v2.css',
  entrypoint: 'registry/ui-ux-entrypoint.json',
  freepass_product_profile: 'docs/FREEPASS_PRODUCT_UI_PROFILE.md',
  start_here: 'docs/UI_UX_START_HERE.md'
};

function makeBinding(revision = 'a'.repeat(40)) {
  return {
    contract: 'devcenter-design-core-binding/v1',
    ai_core: {
      repository: 'freepass-creator/ai-core',
      revision
    },
    sources: Object.fromEntries(
      Object.entries(boundSources).map(([key, path], index) => [
        key,
        { path, blob_sha: String(index + 1).repeat(40) }
      ])
    )
  };
}

function sourceBlobsFrom(binding) {
  return Object.fromEntries(
    Object.values(binding.sources).map(({ path, blob_sha }) => [path, blob_sha])
  );
}

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

test('target preflight allows unrelated Core HEAD movement when bound UI/UX source blobs are unchanged', () => {
  const designHubBinding = makeBinding('a'.repeat(40));
  const result = validateUiUxTargetBinding(entry, {
    currentCoreRevision: 'b'.repeat(40),
    currentSourceBlobs: sourceBlobsFrom(designHubBinding),
    designHubBinding
  });

  assert.equal(result.status, 'VALID');
  assert.equal(result.currentCoreRevision, 'b'.repeat(40));
  assert.equal(result.designHubBaselineRevision, 'a'.repeat(40));
  assert.equal(result.verifiedSourceCount, 8);
});

test('target preflight fails closed when a bound UI/UX source blob drifts', () => {
  const designHubBinding = makeBinding();
  const currentSourceBlobs = sourceBlobsFrom(designHubBinding);
  currentSourceBlobs['design-system/tokens.json'] = 'f'.repeat(40);

  assert.throws(
    () => validateUiUxTargetBinding(entry, {
      currentCoreRevision: 'b'.repeat(40),
      currentSourceBlobs,
      designHubBinding
    }),
    /UIUX_DESIGN_HUB_SOURCE_BLOB_STALE:tokens/
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
