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
    const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    if (status) throw new Error("dirty worktree");
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    throw new Error("AI Core revision is unresolved or dirty. Generate from a clean, committed AI Core checkout.");
  }
}

function render(source, values) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    source,
  );
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function writeNew(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

export function initStarter({ target, profile = "freepass-product", product = "New product", force = false, coreRevision }) {
  if (!target) throw new Error("Missing --target <directory>.");
  const profiles = JSON.parse(readFileSync(join(root, "registry", "ui-ux-starter-profiles.json"), "utf8"));
  const selected = profiles.profiles[profile];
  if (!selected) throw new Error(`Unknown profile '${profile}'. Choose: ${Object.keys(profiles.profiles).join(", ")}`);
  if (typeof product !== "string" || product.trim() === "") throw new Error("--product must be a non-empty name.");
  const resolvedRevision = coreRevision ?? revision();
  if (!/^[a-f0-9]{40}$/.test(resolvedRevision)) throw new Error("coreRevision must be an exact 40-character Git SHA.");

  const destination = resolve(target);
  const templateDir = join(root, "templates", "ui-starter");
  const values = {
    PRODUCT_NAME: product,
    PRODUCT_NAME_HTML: escapeHtml(product),
    PROFILE_ID: profile,
    PROFILE_LABEL: selected.label,
    BODY_CLASS: selected.body_class,
    CARD_LAYOUT: selected.card_layout,
    BOTTOM_ACTION_LAYOUT: selected.bottom_action_layout,
    AI_CORE_REVISION: resolvedRevision,
  };
  const css = [
    readFileSync(join(root, "design-system", "tokens.runtime.css"), "utf8"),
    readFileSync(join(root, "design-system", "components.css"), "utf8"),
    readFileSync(join(root, "design-system", "runtime-v2.css"), "utf8"),
    readFileSync(join(templateDir, "product-profile.css"), "utf8"),
  ].join("\n\n");

  const outputs = {
    "ai-core-ui.css": css,
    "starter.html": render(readFileSync(join(templateDir, "starter.html"), "utf8"), values),
    "starter.js": readFileSync(join(templateDir, "starter.js"), "utf8"),
    "AI_CORE_UI_STARTER.md": render(readFileSync(join(templateDir, "README.template.md"), "utf8"), values),
    "ai-core-ui.profile.json": `${JSON.stringify({
      contract: "ai-core-ui-starter/v1",
      profile,
      product,
      body_class: selected.body_class,
      density: selected.density,
      card_layout: selected.card_layout,
      bottom_action_layout: selected.bottom_action_layout,
      brand_binding: selected.brand_binding,
      product_profile_source: selected.product_profile_source,
      required_feature_ids: profiles.required_feature_ids,
      required_data_states: profiles.required_data_states,
      ai_core_revision: values.AI_CORE_REVISION,
    }, null, 2)}\n`,
  };

  const existing = Object.keys(outputs).filter((file) => existsSync(join(destination, file)));
  if (existing.length > 0 && !force) {
    throw new Error(`Refusing to overwrite ${existing.join(", ")} in ${destination}. Use --force only after reviewing local changes.`);
  }

  for (const [file, content] of Object.entries(outputs)) writeNew(join(destination, file), content);
  return { destination, profile, files: Object.keys(outputs) };
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
