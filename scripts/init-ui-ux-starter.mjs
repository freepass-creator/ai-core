import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--force") args.force = true;
    else if (item.startsWith("--")) args[item.slice(2)] = argv[++index];
  }
  return args;
}

function revision() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "UNRESOLVED";
  }
}

function render(source, values) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    source,
  );
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function writeAll(outputs, force) {
  const conflicts = outputs.map(([path]) => path).filter((path) => existsSync(path));
  if (conflicts.length && !force) {
    throw new Error(`Refusing to overwrite existing starter files:\n${conflicts.map((path) => `- ${path}`).join("\n")}\nUse --force only after reviewing local changes.`);
  }
  for (const [path, content] of outputs) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, "utf8");
  }
}

export function initStarter({ target, profile, product = "New product", force = false }) {
  if (!target) throw new Error("Missing --target <directory>.");
  const profiles = JSON.parse(readFileSync(join(root, "registry", "ui-ux-starter-profiles.json"), "utf8"));
  const profileId = profile ?? profiles.default_profile;
  const selected = profiles.profiles[profileId];
  if (!selected) throw new Error(`Unknown profile '${profileId}'. Choose: ${Object.keys(profiles.profiles).join(", ")}`);

  const destination = resolve(target);
  const templateDir = join(root, "templates", "ui-starter");
  const values = {
    PRODUCT_NAME: product,
    HTML_PRODUCT_NAME: escapeHtml(product),
    PROFILE_ID: profileId,
    PROFILE_LABEL: selected.label,
    BODY_CLASS: selected.body_class,
    AI_CORE_REVISION: revision(),
  };
  const css = [
    readFileSync(join(root, "design-system", "tokens.runtime.css"), "utf8"),
    readFileSync(join(root, "design-system", "components.css"), "utf8"),
    readFileSync(join(root, "design-system", "runtime-v2.css"), "utf8"),
    readFileSync(join(templateDir, "product-profile.css"), "utf8"),
  ].join("\n\n");

  const profileJson = `${JSON.stringify({
    contract: "ai-core-ui-starter/v1",
    profile: profileId,
    product,
    body_class: selected.body_class,
    behavior_contract: selected.behavior_contract,
    feature_ids: profiles.shared_behavior_contract.feature_ids,
    states: profiles.shared_behavior_contract.states,
    viewports: profiles.shared_behavior_contract.viewports,
    ai_core_revision: values.AI_CORE_REVISION,
  }, null, 2)}\n`;
  const outputs = [
    [join(destination, "ai-core-ui.css"), css],
    [join(destination, "starter.html"), render(readFileSync(join(templateDir, "starter.html"), "utf8"), values)],
    [join(destination, "starter.js"), readFileSync(join(templateDir, "starter.js"), "utf8")],
    [join(destination, "AI_CORE_UI_STARTER.md"), render(readFileSync(join(templateDir, "README.template.md"), "utf8"), values)],
    [join(destination, "ai-core-ui.profile.json"), profileJson],
  ];
  writeAll(outputs, force);
  return { destination, profile: profileId, files: ["ai-core-ui.css", "starter.html", "starter.js", "AI_CORE_UI_STARTER.md", "ai-core-ui.profile.json"] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = initStarter(parseArgs(process.argv.slice(2)));
    console.log(`AI Core UI starter created in ${result.destination}`);
    console.log(result.files.map((file) => `- ${file}`).join("\n"));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
