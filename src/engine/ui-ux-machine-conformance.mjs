function stripComments(css) {
  return String(css ?? '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function splitSelectors(raw) {
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function parseDeclarations(body) {
  const out = new Map();
  for (const part of body.split(';')) {
    const idx = part.indexOf(':');
    if (idx <= 0) continue;
    const property = part.slice(0, idx).trim().toLowerCase();
    const value = part.slice(idx + 1).trim();
    if (property && value) out.set(property, value);
  }
  return out;
}

function lastClass(selector) {
  const matches = [...selector.matchAll(/\.([A-Za-z_][A-Za-z0-9_-]*)/g)];
  return matches.length ? matches[matches.length - 1][1] : null;
}

export function collectUsedClasses(sourceText) {
  const used = new Set();
  const text = String(sourceText ?? '');
  const patterns = [
    /\bclass(?:Name)?\s*=\s*"([^"]*)"/g,
    /\bclass(?:Name)?\s*=\s*'([^']*)'/g,
    /\bclassName\s*=\s*\{\s*`([\s\S]*?)`\s*\}/g
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      for (const token of String(match[1] ?? '').split(/[^A-Za-z0-9_-]+/)) {
        if (/^[A-Za-z_][A-Za-z0-9_-]*$/.test(token)) used.add(token);
      }
    }
  }
  return used;
}

export function parseEffectiveCss(styleSources) {
  const effective = new Map();
  let order = 0;
  for (const source of styleSources ?? []) {
    const css = stripComments(source.content);
    for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const rawSelector = match[1].trim();
      if (!rawSelector || rawSelector.startsWith('@')) continue;
      const declarations = parseDeclarations(match[2]);
      if (!declarations.size) continue;
      for (const selector of splitSelectors(rawSelector)) {
        const key = String(source.id ?? source.path ?? 'style') + '::' + selector;
        effective.set(key, {
          source: source.id ?? source.path ?? 'style',
          selector,
          className: lastClass(selector),
          declarations,
          order: order++
        });
      }
    }
  }
  return [...effective.values()].sort((a, b) => a.order - b.order);
}

function validateManifestShape(manifest) {
  if (manifest?.contract !== 'ai-core-ui-machine-conformance/v1') throw new Error('UIUX_MACHINE_CONTRACT_INVALID');
  if (!/^1\.[0-9]+\.[0-9]+$/.test(manifest?.version ?? '')) throw new Error('UIUX_MACHINE_VERSION_INVALID');
  if (!Array.isArray(manifest.style_files) || manifest.style_files.length === 0) throw new Error('UIUX_MACHINE_STYLE_FILES_REQUIRED');
  if (!Array.isArray(manifest.usage_files) || manifest.usage_files.length === 0) throw new Error('UIUX_MACHINE_USAGE_FILES_REQUIRED');
  if (!Array.isArray(manifest.rules) || manifest.rules.length === 0) throw new Error('UIUX_MACHINE_RULES_REQUIRED');
  const ids = new Set();
  for (const rule of manifest.rules) {
    if (!rule?.id || ids.has(rule.id)) throw new Error('UIUX_MACHINE_RULE_ID_INVALID');
    ids.add(rule.id);
    if (!rule.property || !Array.isArray(rule.target_classes) || rule.target_classes.length === 0) {
      throw new Error('UIUX_MACHINE_RULE_INVALID:' + rule.id);
    }
    if ((!Array.isArray(rule.allowed_values) || rule.allowed_values.length === 0) &&
        (!Array.isArray(rule.allowed_patterns) || rule.allowed_patterns.length === 0)) {
      throw new Error('UIUX_MACHINE_ALLOWED_SET_REQUIRED:' + rule.id);
    }
  }
}

function valueAllowed(value, rule) {
  if ((rule.allowed_values ?? []).includes(value)) return true;
  return (rule.allowed_patterns ?? []).some((pattern) => new RegExp(pattern).test(value));
}

export function evaluateUiMachineConformance({ manifest, styleSources, usageSources }) {
  validateManifestShape(manifest);
  const used = new Set();
  for (const source of usageSources ?? []) {
    for (const cls of collectUsedClasses(source.content)) used.add(cls);
  }

  const cssRules = parseEffectiveCss(styleSources);
  const violations = [];
  const checked = [];

  for (const policy of manifest.rules) {
    const targets = new Set(policy.target_classes);
    let matches = 0;
    for (const rule of cssRules) {
      if (!rule.className || !used.has(rule.className) || !targets.has(rule.className)) continue;
      const value = rule.declarations.get(policy.property.toLowerCase());
      if (value == null) continue;
      matches += 1;
      const record = {
        rule_id: policy.id,
        source: rule.source,
        selector: rule.selector,
        class_name: rule.className,
        property: policy.property.toLowerCase(),
        value
      };
      checked.push(record);
      if (!valueAllowed(value, policy)) violations.push(record);
    }
    if (policy.require_match === true && matches === 0) {
      violations.push({
        rule_id: policy.id,
        source: null,
        selector: null,
        class_name: null,
        property: policy.property.toLowerCase(),
        value: null,
        code: 'REQUIRED_EFFECTIVE_DECLARATION_MISSING'
      });
    }
  }

  return {
    status: violations.length ? 'FAIL' : 'PASS',
    used_classes: [...used].sort(),
    checked,
    violations
  };
}
