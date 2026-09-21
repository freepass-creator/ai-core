import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { initStarter, parseArgs } from "../scripts/init-ui-ux-starter.mjs";
import { DATA_STATES, matchesQuery, setDataState } from "../templates/ui-starter/starter.js";

const TEST_REVISION = "a".repeat(40);

test("parses starter arguments", () => {
  assert.deepEqual(parseArgs(["--target", "out", "--profile", "internal-work", "--force"]), {
    target: "out",
    profile: "internal-work",
    force: true,
  });
});

test("creates a revision-bound starter with established UI rules", () => {
  const target = mkdtempSync(join(tmpdir(), "ai-core-ui-"));
  const result = initStarter({ target, profile: "freepass-product", product: "Sample", coreRevision: TEST_REVISION });
  assert.equal(result.files.length, 5);

  const css = readFileSync(join(target, "ai-core-ui.css"), "utf8");
  const html = readFileSync(join(target, "starter.html"), "utf8");
  const script = readFileSync(join(target, "starter.js"), "utf8");
  const profile = JSON.parse(readFileSync(join(target, "ai-core-ui.profile.json"), "utf8"));
  assert.match(css, /\.ui-button\.secondary/);
  assert.match(css, /\.ui-search-region/);
  assert.match(css, /\.ui-card-list__item/);
  assert.match(html, /class="ui-profile-freepass"/);
  assert.match(html, /class="ui-bottom-action"/);
  assert.match(html, /data-action-layout="freepass-3-7"/);
  assert.match(script, /ui-starter:retry/);
  for (const state of DATA_STATES) assert.match(html, new RegExp(`data-ui-state="${state}"`));
  assert.deepEqual(profile.required_data_states, DATA_STATES);
  assert.equal(profile.brand_binding.on_missing, "HOLD");
  assert.equal(profile.density, "comfortable");
  assert.equal(profile.ai_core_revision, TEST_REVISION);
});

test("keeps profile-specific density and layout choices without changing shared behavior", () => {
  const target = mkdtempSync(join(tmpdir(), "ai-core-ui-"));
  initStarter({ target, profile: "internal-work", coreRevision: TEST_REVISION });
  const html = readFileSync(join(target, "starter.html"), "utf8");
  const profile = JSON.parse(readFileSync(join(target, "ai-core-ui.profile.json"), "utf8"));
  assert.match(html, /class="ui-profile-internal"/);
  assert.match(html, /data-layout="single-column"/);
  assert.equal(profile.density, "compact");
  assert.equal(profile.bottom_action_layout, "stack-on-mobile");
  assert.deepEqual(profile.required_data_states, DATA_STATES);
});

test("escapes product names in HTML while preserving the original profile value", () => {
  const target = mkdtempSync(join(tmpdir(), "ai-core-ui-"));
  initStarter({ target, product: '<FreePass & "Test">', coreRevision: TEST_REVISION });
  const html = readFileSync(join(target, "starter.html"), "utf8");
  const profile = JSON.parse(readFileSync(join(target, "ai-core-ui.profile.json"), "utf8"));
  assert.match(html, /&lt;FreePass &amp; &quot;Test&quot;&gt;/);
  assert.doesNotMatch(html, /<FreePass/);
  assert.equal(profile.product, '<FreePass & "Test">');
});

test("starter search matching is case-insensitive and state transitions are explicit", () => {
  assert.equal(matchesQuery("검토 NEEDS REVIEW", "needs review"), true);
  assert.equal(matchesQuery("첫 번째 카드", "두 번째"), false);

  const views = DATA_STATES.map((state) => ({ dataset: { uiState: state }, hidden: false }));
  const attributes = new Map();
  const surface = {
    dataset: {},
    setAttribute(name, value) { attributes.set(name, value); },
    querySelectorAll() { return views; },
  };
  setDataState(surface, "loading");
  assert.equal(surface.dataset.state, "loading");
  assert.equal(attributes.get("aria-busy"), "true");
  assert.deepEqual(views.map((view) => view.hidden), [false, true, true, true]);
  assert.throws(() => setDataState(surface, "success"), /Unknown data state/);
});

test("does not overwrite an existing starter without force", () => {
  const target = mkdtempSync(join(tmpdir(), "ai-core-ui-"));
  initStarter({ target, coreRevision: TEST_REVISION });
  assert.throws(() => initStarter({ target, coreRevision: TEST_REVISION }), /Refusing to overwrite/);
});

test("checks every destination before writing so a conflict cannot leave a partial starter", () => {
  const target = mkdtempSync(join(tmpdir(), "ai-core-ui-"));
  writeFileSync(join(target, "starter.js"), "consumer-owned", "utf8");
  assert.throws(() => initStarter({ target, coreRevision: TEST_REVISION }), /Refusing to overwrite starter\.js/);
  assert.equal(existsSync(join(target, "ai-core-ui.css")), false);
  assert.equal(readFileSync(join(target, "starter.js"), "utf8"), "consumer-owned");
});

test("requires an exact revision binding", () => {
  const target = mkdtempSync(join(tmpdir(), "ai-core-ui-"));
  assert.throws(() => initStarter({ target, coreRevision: "main" }), /exact 40-character Git SHA/);
  assert.equal(existsSync(join(target, "ai-core-ui.css")), false);
});
