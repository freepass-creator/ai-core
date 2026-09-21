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
  assert.equal(result.files.length, 5);

  const css = readFileSync(join(target, "ai-core-ui.css"), "utf8");
  const html = readFileSync(join(target, "starter.html"), "utf8");
  const javascript = readFileSync(join(target, "starter.js"), "utf8");
  const readme = readFileSync(join(target, "AI_CORE_UI_STARTER.md"), "utf8");
  const profile = JSON.parse(readFileSync(join(target, "ai-core-ui.profile.json"), "utf8"));
  assert.match(css, /\.ui-button\.secondary/);
  assert.match(css, /\.ui-search-region/);
  assert.match(css, /\.ui-card-list__item/);
  assert.match(css, /\.ui-card-list__item \+ \.ui-card-list__item/);
  assert.match(css, /border: 1px solid var\(--color-border\)/);
  assert.doesNotMatch(css, /\.ui-card-list\[data-layout="responsive-grid"\]/);
  assert.match(html, /class="ui-profile-freepass"/);
  assert.match(html, /class="ui-bottom-action starter-page-action"/);
  assert.match(html, /aria-label="현재 페이지 실행"/);
  assert.doesNotMatch(html, /data-layout="responsive-grid"/);
  assert.match(html, /data-state="populated"/);
  assert.match(html, /id="draft-note"/);
  assert.match(javascript, /setSearchOpen/);
  assert.match(javascript, /showState/);
  assert.match(javascript, /aria-pressed/);
  assert.match(readme, /상단은 상태와 제목, 하단은 이동과 실행/);
  assert.match(readme, /버튼과 선택은 테두리 없이, 입력과 표는 테두리 있게, 목록은 카드 하나/);
  assert.match(readme, /하단 이동은 아이콘, 페이지 실행은 테두리 없는 박스 버튼/);
  assert.match(profile.ai_core_revision, /^[a-f0-9]{40}$/);
});

test("does not overwrite an existing starter without force", () => {
  const target = mkdtempSync(join(tmpdir(), "ai-core-ui-"));
  initStarter({ target });
  assert.throws(() => initStarter({ target }), /Refusing to overwrite/);
});
