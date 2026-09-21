import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { initStarter, parseArgs } from "../scripts/init-ui-ux-starter.mjs";

test("parses starter arguments", () => {
  assert.deepEqual(parseArgs(["--target", "out", "--profile", "freepass-internal", "--force"]), {
    target: "out",
    profile: "freepass-internal",
    force: true,
  });
});

test("creates a revision-bound starter with established UI rules", () => {
  const target = mkdtempSync(join(tmpdir(), "ai-core-ui-"));
  const result = initStarter({ target, profile: "freepass-public", product: "Sample" });
  assert.equal(result.files.length, 5);

  const css = readFileSync(join(target, "ai-core-ui.css"), "utf8");
  const html = readFileSync(join(target, "starter.html"), "utf8");
  const script = readFileSync(join(target, "starter.js"), "utf8");
  const profile = JSON.parse(readFileSync(join(target, "ai-core-ui.profile.json"), "utf8"));
  assert.match(css, /\.ui-button\.secondary/);
  assert.match(css, /\.ui-search-region/);
  assert.match(css, /\.ui-card-list__item/);
  assert.match(css, /\[data-state\]\[hidden\] \{ display: none; \}/);
  assert.match(html, /class="ui-profile-freepass-public"/);
  assert.match(html, /class="ui-bottom-action"/);
  assert.match(script, /sessionStorage/);
  assert.deepEqual(profile.states, ["loading", "empty", "error", "populated"]);
  assert.deepEqual(profile.viewports, [360, 390, 412, 1280, 1440]);
  assert.equal(profile.behavior_contract, "shared_behavior_contract");
  assert.match(profile.ai_core_revision, /^[a-f0-9]{40}$/);
});

test("all FreePass starter profiles bind to one behavior contract", () => {
  for (const profileId of ["freepass-public", "freepass-internal", "freepass-mobile"]) {
    const target = mkdtempSync(join(tmpdir(), `ai-core-ui-${profileId}-`));
    initStarter({ target, profile: profileId });
    const profile = JSON.parse(readFileSync(join(target, "ai-core-ui.profile.json"), "utf8"));
    assert.equal(profile.behavior_contract, "shared_behavior_contract");
    assert.equal(profile.profile, profileId);
  }
});

test("does not overwrite an existing starter without force", () => {
  const target = mkdtempSync(join(tmpdir(), "ai-core-ui-"));
  initStarter({ target });
  assert.throws(() => initStarter({ target }), /Refusing to overwrite/);
});

test("preflights every conflict before writing any starter file", () => {
  const target = mkdtempSync(join(tmpdir(), "ai-core-ui-conflict-"));
  writeFileSync(join(target, "starter.html"), "keep me", "utf8");
  assert.throws(() => initStarter({ target }), /Refusing to overwrite/);
  assert.equal(readFileSync(join(target, "starter.html"), "utf8"), "keep me");
  assert.equal(existsSync(join(target, "ai-core-ui.css")), false);
});

test("escapes a product label before placing it in HTML", () => {
  const target = mkdtempSync(join(tmpdir(), "ai-core-ui-escape-"));
  initStarter({ target, product: '<script>alert("x")</script>' });
  const html = readFileSync(join(target, "starter.html"), "utf8");
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
});
