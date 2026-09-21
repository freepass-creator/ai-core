import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

async function text(path) {
  return readFile(resolve(root, path), "utf8");
}

function fail(code) {
  throw new Error(code);
}

function equalList(actual, expected, code) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(code);
}

try {
  const [profilesText, featuresText, html, script, css, readme] = await Promise.all([
    text("registry/ui-ux-starter-profiles.json"),
    text("registry/ui-ux-features.json"),
    text("templates/ui-starter/starter.html"),
    text("templates/ui-starter/starter.js"),
    text("templates/ui-starter/product-profile.css"),
    text("templates/ui-starter/README.template.md"),
  ]);
  const profiles = JSON.parse(profilesText);
  const features = JSON.parse(featuresText);
  const expectedProfiles = ["freepass-public", "freepass-internal", "freepass-mobile"];
  const expectedStates = ["loading", "empty", "error", "populated"];
  const expectedViewports = [360, 390, 412, 1280, 1440];

  equalList(Object.keys(profiles.profiles), expectedProfiles, "UIUX_STARTER_PROFILE_SET_DRIFT");
  equalList(profiles.shared_behavior_contract.states, expectedStates, "UIUX_STARTER_STATE_SET_DRIFT");
  equalList(profiles.shared_behavior_contract.viewports, expectedViewports, "UIUX_STARTER_VIEWPORT_SET_DRIFT");

  const canonicalFeatures = new Set(features.features.map((feature) => feature.id));
  for (const featureId of profiles.shared_behavior_contract.feature_ids) {
    if (!canonicalFeatures.has(featureId)) fail(`UIUX_STARTER_UNKNOWN_FEATURE:${featureId}`);
  }

  const bodyClasses = new Set();
  for (const profileId of expectedProfiles) {
    const profile = profiles.profiles[profileId];
    if (profile.behavior_contract !== "shared_behavior_contract") fail(`UIUX_STARTER_BEHAVIOR_FORK:${profileId}`);
    if (bodyClasses.has(profile.body_class)) fail(`UIUX_STARTER_BODY_CLASS_DUPLICATE:${profile.body_class}`);
    bodyClasses.add(profile.body_class);
    if (!html.includes(`data-profile="{{PROFILE_ID}}"`)) fail("UIUX_STARTER_PROFILE_BINDING_MISSING");
    if (!css.includes(`.${profile.body_class}`)) fail(`UIUX_STARTER_PROFILE_CSS_MISSING:${profileId}`);
  }

  for (const state of expectedStates) {
    if (!html.includes(`data-state="${state}"`)) fail(`UIUX_STARTER_STATE_TEMPLATE_MISSING:${state}`);
    if (!script.includes(`"${state}"`)) fail(`UIUX_STARTER_STATE_RUNTIME_MISSING:${state}`);
  }

  const requiredHtml = [
    "data-search-toggle",
    "class=\"ui-search\"",
    "class=\"ui-card-list__link\"",
    "class=\"ui-bottom-action\"",
    "data-selection-status",
  ];
  for (const marker of requiredHtml) {
    if (!html.includes(marker)) fail(`UIUX_STARTER_HTML_MARKER_MISSING:${marker}`);
  }
  const header = html.match(/<header[\s\S]*?<\/header>/i)?.[0] ?? "";
  if (/<button/i.test(header)) fail("UIUX_STARTER_HEADER_ACTION_FORBIDDEN");
  const footer = html.match(/<footer class="ui-bottom-action">([\s\S]*?)<\/footer>/)?.[1] ?? "";
  const primaryCount = [...footer.matchAll(/class="ui-button"/g)].length;
  if (primaryCount !== 1) fail(`UIUX_STARTER_PRIMARY_ACTION_COUNT:${primaryCount}`);

  for (const marker of ["sessionStorage", "state.query", "state.note", "state.selected", "applySearchExpanded"]) {
    if (!script.includes(marker)) fail(`UIUX_STARTER_PRESERVATION_MISSING:${marker}`);
  }
  if (!css.includes("[data-state][hidden] { display: none; }")) fail("UIUX_STARTER_HIDDEN_STATE_CSS_MISSING");
  if (!css.includes("margin-inline: 0;")) fail("UIUX_STARTER_MOBILE_OVERFLOW_GUARD_MISSING");
  for (const viewport of expectedViewports) {
    if (!readme.includes(String(viewport))) fail(`UIUX_STARTER_README_VIEWPORT_MISSING:${viewport}`);
  }

  console.log(
    `PASS: UI/UX starter ${expectedProfiles.length} profiles / ${expectedStates.length} states / ` +
      `${expectedViewports.length} viewports / one shared behavior contract`,
  );
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
}
