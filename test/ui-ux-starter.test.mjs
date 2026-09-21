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
  assert.equal(result.files.length, 15);

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

  const models = ["list", "detail", "form", "home", "select-step", "result-receipt"];
  for (const model of models) {
    const markup = readFileSync(join(target, "models", `${model}.html`), "utf8");
    assert.match(markup, new RegExp(`data-model="${model}"`));
    assert.match(markup, /data-region="header"/);
    assert.match(markup, /data-region="main"/);
    assert.match(markup, /언제 사용/);
    assert.match(markup, /사용하지 않을 때/);
    assert.match(markup, /data-supported-states="loading empty error populated selected disabled busy"/);
    assert.match(markup, /class="model-state"/);
    assert.match(markup, /models\.js/);
  }
  const modelIndex = readFileSync(join(target, "models", "index.html"), "utf8");
  assert.match(modelIndex, /여러 항목을 찾고 고름/);
  assert.match(modelIndex, /처리 결과를 확인/);
  assert.match(modelIndex, /SET-01/);
  assert.match(modelIndex, /검색창만 S02로 바꿔/);
  const modelScript = readFileSync(join(target, "models", "models.js"), "utf8");
  assert.match(modelScript, /aria-busy/);
  assert.match(modelScript, /dataset\.previewState/);
  const modelCss = readFileSync(join(target, "models", "models.css"), "utf8");
  for (const width of [360, 390, 412, 1280, 1440]) assert.match(modelCss, new RegExp(`${width}px`));
  const form = readFileSync(join(target, "models", "form.html"), "utf8");
  assert.match(form, /aria-describedby="phone-error"/);
  const catalog = JSON.parse(readFileSync(join(target, "ui-component-catalog.json"), "utf8"));
  assert.deepEqual(catalog.sets["SET-01"].components, ["H01", "S01", "L01", "M01", "B01"]);
  assert.equal(catalog.components.B01.name, "주 실행 버튼");
  assert.deepEqual(catalog.recipes["RENMAN-PENALTY-01"].sequence.map((step) => step.set), ["SET-03", "SET-02"]);
  assert.match(catalog.recipes["RENMAN-PENALTY-01"].mobile_rule, /M02/);
});

test("does not overwrite an existing starter without force", () => {
  const target = mkdtempSync(join(tmpdir(), "ai-core-ui-"));
  initStarter({ target });
  assert.throws(() => initStarter({ target }), /Refusing to overwrite/);
});
