import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  getUiUxRequiredBoundSourcePaths,
  validateUiUxEntrypointSemantics,
  validateUiUxTargetBinding
} from '../src/engine/ui-ux-entrypoint.mjs';

const entryPath = 'registry/ui-ux-entrypoint.json';
const entry = JSON.parse(
  await readFile(new URL(`../${entryPath}`, import.meta.url), 'utf8')
);

function sourceKey(path) {
  const machineSource = Object.entries(entry.machine_sources).find(([, value]) => value === path);
  if (machineSource) return machineSource[0];
  if (path === entryPath) return 'entrypoint';
  if (path === entry.start_document) return 'start_here';

  const productProfile = Object.entries(entry.product_profiles).find(([, value]) => value === path);
  if (productProfile) return `${productProfile[0].toLowerCase()}_product_profile`;

  return `normative_${path.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase()}`;
}

function makeBinding(revision = 'a'.repeat(40)) {
  const requiredPaths = getUiUxRequiredBoundSourcePaths(entry, { entryPath });
  return {
    contract: 'devcenter-design-core-binding/v1',
    ai_core: {
      repository: 'freepass-creator/ai-core',
      revision
    },
    sources: Object.fromEntries(
      requiredPaths.map((path, index) => [
        sourceKey(path),
        { path, blob_sha: String((index % 9) + 1).repeat(40) }
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

test('canonical UI/UX source-set binding check is mandatory before implementation claims', () => {
  const broken = structuredClone(entry);
  broken.fail_closed_rules = broken.fail_closed_rules.filter(
    (item) => item !== 'DESIGN_HUB_BINDING_MUST_MATCH_CANONICAL_UIUX_SOURCE_SET'
  );
  assert.throws(
    () => validateUiUxEntrypointSemantics(broken),
    /UIUX_ENTRY_FAIL_CLOSED_MISSING:DESIGN_HUB_BINDING_MUST_MATCH_CANONICAL_UIUX_SOURCE_SET/
  );
});

test('target preflight allows unrelated Core HEAD movement when canonical UI/UX source blobs are unchanged', () => {
  const designHubBinding = makeBinding('a'.repeat(40));
  const result = validateUiUxTargetBinding(entry, {
    currentCoreRevision: 'b'.repeat(40),
    currentSourceBlobs: sourceBlobsFrom(designHubBinding),
    designHubBinding,
    entryPath
  });

  assert.equal(result.status, 'VALID');
  assert.equal(result.currentCoreRevision, 'b'.repeat(40));
  assert.equal(result.designHubBaselineRevision, 'a'.repeat(40));
  assert.equal(result.verifiedSourceCount, 12);
});

test('target preflight fails closed when interaction contract drifts', () => {
  const designHubBinding = makeBinding();
  const currentSourceBlobs = sourceBlobsFrom(designHubBinding);
  currentSourceBlobs['design-system/interaction.contract.json'] = 'f'.repeat(40);

  assert.throws(
    () => validateUiUxTargetBinding(entry, {
      currentCoreRevision: 'b'.repeat(40),
      currentSourceBlobs,
      designHubBinding,
      entryPath
    }),
    /UIUX_DESIGN_HUB_SOURCE_BLOB_STALE:interaction_contract/
  );
});

test('target preflight fails closed when Design Hub omits a normative entrypoint source', () => {
  const designHubBinding = makeBinding();
  const missingPath = 'docs/UI_UX_CONSTITUTION.md';
  delete designHubBinding.sources[sourceKey(missingPath)];

  assert.throws(
    () => validateUiUxTargetBinding(entry, {
      currentCoreRevision: 'b'.repeat(40),
      currentSourceBlobs: sourceBlobsFrom(designHubBinding),
      designHubBinding,
      entryPath
    }),
    /UIUX_DESIGN_HUB_REQUIRED_SOURCE_MISSING:docs\/UI_UX_CONSTITUTION\.md/
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
