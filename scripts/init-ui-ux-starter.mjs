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

function writeNew(path, content, force) {
  if (existsSync(path) && !force) throw new Error(`Refusing to overwrite ${path}. Use --force only after reviewing local changes.`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

export function initStarter({ target, profile = "freepass-product", product = "New product", force = false }) {
  if (!target) throw new Error("Missing --target <directory>.");
  const profiles = JSON.parse(readFileSync(join(root, "registry", "ui-ux-starter-profiles.json"), "utf8"));
  const selected = profiles.profiles[profile];
  if (!selected) throw new Error(`Unknown profile '${profile}'. Choose: ${Object.keys(profiles.profiles).join(", ")}`);

  const destination = resolve(target);
  const templateDir = join(root, "templates", "ui-starter");
  const values = {
    PRODUCT_NAME: product,
    PROFILE_ID: profile,
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

  writeNew(join(destination, "ai-core-ui.css"), css, force);
  writeNew(join(destination, "starter.html"), render(readFileSync(join(templateDir, "starter.html"), "utf8"), values), force);
  writeNew(join(destination, "AI_CORE_UI_STARTER.md"), render(readFileSync(join(templateDir, "README.template.md"), "utf8"), values), force);
  writeNew(join(destination, "ai-core-ui.profile.json"), `${JSON.stringify({ contract: "ai-core-ui-starter/v1", profile, product, body_class: selected.body_class, ai_core_revision: values.AI_CORE_REVISION }, null, 2)}\n`, force);
  return { destination, profile, files: ["ai-core-ui.css", "starter.html", "AI_CORE_UI_STARTER.md", "ai-core-ui.profile.json"] };
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
