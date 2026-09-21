import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { initStarter, parseArgs } from "../scripts/init-ui-ux-starter.mjs";

test("parses starter arguments", () => {
  assert.deepEqual(parseArgs(["--target", "out", "--profile", "internal-work", "--force"]), {
    target: "out",
    profile: "internal-work",
    force: true,
  });
});

test("creates a revision-bound starter with established UI rules", () => {
  const target = mkdtempSync(join(tmpdir(), "ai-core-ui-"));
  const result = initStarter({ target, profile: "freepass-product", product: "Sample" });
  assert.equal(result.files.length, 4);

  const css = readFileSync(join(target, "ai-core-ui.css"), "utf8");
  const html = readFileSync(join(target, "starter.html"), "utf8");
  const profile = JSON.parse(readFileSync(join(target, "ai-core-ui.profile.json"), "utf8"));
  assert.match(css, /\.ui-button\.secondary/);
  assert.match(css, /\.ui-search-region/);
  assert.match(css, /\.ui-card-list__item/);
  assert.match(html, /class="ui-profile-freepass"/);
  assert.match(html, /class="ui-bottom-action"/);
  assert.match(profile.ai_core_revision, /^[a-f0-9]{40}$/);
});

test("does not overwrite an existing starter without force", () => {
  const target = mkdtempSync(join(tmpdir(), "ai-core-ui-"));
  initStarter({ target });
  assert.throws(() => initStarter({ target }), /Refusing to overwrite/);
});
