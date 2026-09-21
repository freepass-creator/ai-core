import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

async function json(path) {
  return JSON.parse(await readFile(resolve(root, path), "utf8"));
}

const [schema, starter, features] = await Promise.all([
  json("contracts/ui-ux-starter-profiles.schema.json"),
  json("registry/ui-ux-starter-profiles.json"),
  json("registry/ui-ux-features.json"),
]);

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(schema);

if (!validate(starter)) {
  console.error("FAIL: UIUX_STARTER_SCHEMA");
  console.error(JSON.stringify(validate.errors, null, 2));
  process.exit(1);
}

const featureIds = new Set(features.features.map((feature) => feature.id));
const missingFeatures = starter.required_feature_ids.filter((id) => !featureIds.has(id));
if (missingFeatures.length > 0) {
  console.error(`FAIL: UIUX_STARTER_UNKNOWN_FEATURE ${missingFeatures.join(", ")}`);
  process.exit(1);
}

if (!(starter.default_profile in starter.profiles)) {
  console.error(`FAIL: UIUX_STARTER_DEFAULT_PROFILE ${starter.default_profile}`);
  process.exit(1);
}

const sources = [
  ...starter.normative_sources,
  ...Object.values(starter.profiles)
    .map((profile) => profile.product_profile_source)
    .filter(Boolean),
];

try {
  await Promise.all(sources.map((source) => access(resolve(root, source))));
} catch (error) {
  console.error(`FAIL: UIUX_STARTER_SOURCE ${error.message}`);
  process.exit(1);
}

console.log(
  `PASS: UI/UX starter ${Object.keys(starter.profiles).length} profiles / ` +
  `${starter.required_feature_ids.length} feature bindings / ${starter.required_data_states.length} data states`,
);
